from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from core.security import ws_get_current_user
from services.ws_manager import ws_agent_manager, AgentConnection

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
