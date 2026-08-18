"""Pydantic request/response models shared across API routes."""
from typing import Literal, Optional
from pydantic import BaseModel


class TabInfo(BaseModel):
    tab_id: int
    url: str
    title: str
    content_excerpt: Optional[str] = None


class ChatRequest(BaseModel):
    session_id: str
    message: str
    active_tab: TabInfo
    open_tabs: list[TabInfo] = []


class ChatResponse(BaseModel):
    reply: str
    agent_used: str
    requires_approval: bool = False
    proposed_action: Optional[dict] = None


class ActionApproval(BaseModel):
    session_id: str
    action_id: str
    approved: bool


class MemoryItem(BaseModel):
    id: str
    session_id: str
    content: str
    source: Literal["user", "assistant"]
    created_at: str


class MemoryDeleteRequest(BaseModel):
    memory_id: str
