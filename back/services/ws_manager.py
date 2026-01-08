from dataclasses import dataclass
from typing import Dict, Optional
import asyncio
from fastapi import WebSocket


@dataclass
class AgentConnection:
    websocket: WebSocket
    user_id: str
    nickname: str
    client_id: str


class WSAgentManager:
    def __init__(self):
        self._agents: Dict[str, AgentConnection] = {}
        self._lock = asyncio.Lock()

    async def connect(self, conn: AgentConnection):
        async with self._lock:
            self._agents[conn.client_id] = conn

    async def disconnect(self, client_id: str):
        async with self._lock:
            self._agents.pop(client_id, None)

    async def send(self, client_id: str, payload: dict) -> bool:
        async with self._lock:
            agent = self._agents.get(client_id)
        if not agent:
            return False

        await agent.websocket.send_json(payload)
        return True

    async def list_agents(self):
        async with self._lock:
            return list(self._agents.keys())


ws_agent_manager = WSAgentManager()
