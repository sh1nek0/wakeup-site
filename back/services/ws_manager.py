# services/ws_manager.py
import asyncio
from dataclasses import dataclass
from typing import Dict, Optional
from fastapi import WebSocket

@dataclass
class AgentConnection:
    websocket: WebSocket
    user_id: str
    nickname: str
    client_id: str

@dataclass
class ControlConnection:
    websocket: WebSocket
    user_id: str
    nickname: str
    control_id: str

class WSAgentManager:
    def __init__(self):
        self._agents: Dict[str, AgentConnection] = {}
        self._controls: Dict[str, ControlConnection] = {}
        self._lock = asyncio.Lock()

    # --- алиасы под роутер ---
    async def connect(self, conn: AgentConnection):
        return await self.connect_agent(conn)

    async def disconnect(self, client_id: str):
        return await self.disconnect_agent(client_id)

    # --- твои методы ---
    async def connect_agent(self, conn: AgentConnection):
        async with self._lock:
            self._agents[conn.client_id] = conn

    async def disconnect_agent(self, client_id: str):
        async with self._lock:
            self._agents.pop(client_id, None)

    async def connect_control(self, conn: ControlConnection):
        async with self._lock:
            self._controls[conn.control_id] = conn

    async def disconnect_control(self, control_id: str):
        async with self._lock:
            self._controls.pop(control_id, None)

    async def get_agent(self, client_id: str) -> Optional[AgentConnection]:
        async with self._lock:
            return self._agents.get(client_id)

    async def list_agents(self):
        async with self._lock:
            return [
                {"clientId": a.client_id, "nickname": a.nickname, "userId": a.user_id}
                for a in self._agents.values()
            ]

ws_agent_manager = WSAgentManager()
