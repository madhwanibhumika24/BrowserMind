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


class QuizItem(BaseModel):
    question: str
    options: list[str]
    answer: str


class QuizResponse(BaseModel):
    category: str
    items: list[QuizItem]


class SummaryResponse(BaseModel):
    summary: str
    questions: list[str]


class GoogleAuthRequest(BaseModel):
    access_token: str


class AuthResponse(BaseModel):
    token: str
    email: str
    name: str


class User(BaseModel):
    google_id: str
    email: str
    name: str
    created_at: str


class FormQuestion(BaseModel):
    question: str
    options: list[str]
    answer: str | None = None  # only present for "quiz" kind; stripped before
    # being sent to the public GET /forms/{id} endpoint so respondents can't
    # see it before answering.


class FormGenerateRequest(BaseModel):
    description: str
    question_count: int | None = None  # None = infer from text, or default
    kind: str = "survey"  # "survey" (opinions, no right answer) or "quiz"


class FormPublic(BaseModel):
    """What anyone with the link sees - no owner-only info in here."""
    id: str
    title: str
    description: str
    kind: str
    questions: list[FormQuestion]
    created_at: str


class FormAnswerSubmission(BaseModel):
    answers: list[str]


class FormSubmissionResult(BaseModel):
    """Returned right after someone submits - safe to reveal correct
    answers/score here since they've already committed their attempt."""
    id: str
    submitted_at: str
    score: int | None = None
    total: int | None = None
    correct_answers: list[str] | None = None


class FormResponseRecord(BaseModel):
    id: str
    answers: list[str]
    score: int | None = None
    total: int | None = None
    submitted_at: str


class FormResultsResponse(BaseModel):
    form: FormPublic
    responses: list[FormResponseRecord]


class FormSummary(BaseModel):
    """One row in the creator's 'My Forms' list - lighter than FormPublic,
    no need to ship every question just to render a list."""
    id: str
    title: str
    kind: str
    created_at: str
    response_count: int


class DocumentInfo(BaseModel):
    """What the frontend gets back after uploading a document - never the
    full extracted text, just enough to reference it in later chat calls."""
    id: str
    filename: str
    created_at: str


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class DocumentChatRequest(BaseModel):
    message: str
    history: list[ChatTurn] = []  # kept client-side, replayed each call - no
    # server-side chat history storage needed for this feature.


class DocumentChatResponse(BaseModel):
    reply: str


class GrammarCheckRequest(BaseModel):
    text: str


class GrammarCheckResponse(BaseModel):
    corrected: str


class TranslateRequest(BaseModel):
    text: str
    target_language: str


class TranslateResponse(BaseModel):
    translated: str


class MindmapRequest(BaseModel):
    topic: str


class MindmapNode(BaseModel):
    title: str
    children: list["MindmapNode"] = []


MindmapNode.model_rebuild()  # resolves the self-reference above


class MindmapResponse(BaseModel):
    root: MindmapNode
