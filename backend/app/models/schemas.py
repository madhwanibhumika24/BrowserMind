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


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str


class MessageResponse(BaseModel):
    message: str


class AuthResponse(BaseModel):
    token: str
    email: str
    name: str


class User(BaseModel):
    id: str
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
    # Still sent by the client and replayed to the LLM each call (simplest
    # way to give the model conversation context) - but now ALSO saved
    # server-side (see documents.py's chat route) so the thread can be
    # reopened later from the history sidebar, even after the tab closes.
    history: list[ChatTurn] = []


class DocumentChatResponse(BaseModel):
    reply: str


class DocumentChatMessage(BaseModel):
    """One saved turn, returned when reopening a past chat thread."""
    role: Literal["user", "assistant"]
    content: str
    created_at: str


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


class CompanyInfo(BaseModel):
    """What JobFit could tell about the hiring company - built from whatever
    the page itself says plus the model's own general knowledge. Every
    field is optional and left blank rather than guessed when unknown, so
    an unfamiliar startup just shows less, not made-up facts."""
    name: str = ""
    overview: str = ""  # what the company actually does, 1-2 sentences
    industry: str = ""
    notable_facts: str = ""  # history / focus areas / recent news, from general knowledge only


class RoleInfo(BaseModel):
    """The job itself, separate from the skills match below - title, what
    kind of role it is, and the headline responsibilities."""
    title: str = ""
    employment_type: str = ""  # e.g. Internship, Full-time, Contract
    location: str = ""  # e.g. "Pune, India (On-site)" or "Remote"
    responsibilities: list[str] = []


class JobFitResponse(BaseModel):
    """Result of analyzing a job posting: what the company and role are,
    and how a resume's skills compare against what's required. Stateless
    like the PDF tools - nothing here is stored server-side. resume_text is
    echoed back so the frontend can cache it (in the browser only) and skip
    re-uploading/re-parsing the resume on the next job page.
    """
    fit_score: int  # 0-100, matched_skills / required_skills
    required_skills: list[str]
    matched_skills: list[str]
    missing_skills: list[str]
    summary: str
    resume_text: str = ""
    company: CompanyInfo = CompanyInfo()
    role: RoleInfo = RoleInfo()
