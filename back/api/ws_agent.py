from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from core.security import ws_get_current_user
from services.ws_manager import ws_agent_manager, AgentConnection,  ControlConnection
import uuid

router = APIRouter()

@router.websocket("/ws/agent")
async def ws_agent(websocket: WebSocket):
    token = websocket.query_params.get("token")
    user = ws_get_current_user(token)

    await websocket.accept()

    client_id = None
    try:
        hello = await websocket.receive_json()
        if hello.get("type") != "hello":
            await websocket.close(code=1008)
            return

        client_id = str(hello.get("clientId", "")).strip()
        if not client_id:
            await websocket.close(code=1008)
            return

        await ws_agent_manager.connect(
            AgentConnection(
                websocket=websocket,
                user_id=user.id,
                nickname=user.nickname,
                client_id=client_id
            )
        )

        await websocket.send_json({
            "type": "hello_ok",
            "clientId": client_id,
            "user": {
                "id": user.id,
                "nickname": user.nickname,
                "role": user.role,
            }
        })

        while True:
            msg = await websocket.receive_json()

            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            # тут позже будут команды/ивенты
            await websocket.send_json({"type": "ack"})

    except WebSocketDisconnect:
        pass
    finally:
        if client_id:
            await ws_agent_manager.disconnect(client_id)


@router.websocket("/ws/control")
async def ws_control(websocket: WebSocket):
    token = (websocket.query_params.get("token") or "").strip()
    user = ws_get_current_user(token)

    # если хочешь только админам:
    if user.role != "admin":
        await websocket.close(code=1008)
        return

    await websocket.accept()

    control_id = str(uuid.uuid4())
    await ws_agent_manager.connect_control(
        ControlConnection(
            websocket=websocket,
            user_id=user.id,
            nickname=user.nickname,
            control_id=control_id
        )
    )

    try:
        await websocket.send_json({"type": "hello_ok", "controlId": control_id})

        while True:
            msg = await websocket.receive_json()
            t = msg.get("type")

            if t == "list_agents":
                agents = await ws_agent_manager.list_agents()
                await websocket.send_json({"type": "list_agents_ok", "reqId": msg.get("reqId"), "agents": agents})
                continue

            if t == "send":
                client_id = msg.get("clientId")
                payload = msg.get("payload")
                agent = await ws_agent_manager.get_agent(client_id)
                if not agent:
                    await websocket.send_json({"type": "error", "reqId": msg.get("reqId"), "message": "agent_not_found"})
                    continue

                # пересылаем агенту команду
                await agent.websocket.send_json({
                    "type": "command",
                    "reqId": msg.get("reqId"),
                    "fromControlId": control_id,
                    "payload": payload
                })

                await websocket.send_json({"type": "send_ok", "reqId": msg.get("reqId")})
                continue

            await websocket.send_json({"type": "error", "message": "unknown_type"})

    except WebSocketDisconnect:
        pass
    finally:
        await ws_agent_manager.disconnect_control(control_id)