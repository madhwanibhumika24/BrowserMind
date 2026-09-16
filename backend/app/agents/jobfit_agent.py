"""JobFit - reads a job posting (LinkedIn, Internshala, Indeed, Naukri,
Glassdoor, or literally any other page) and gives the user a full picture:
what the company does, what the role actually involves, and how well their
resume's skills line up with what's required.

Stateless, like pdf_tools.py: a job description and a resume text come in,
an analysis goes out, nothing is persisted server-side.

Two LLM calls, not one per fact:
  1. One structured call over the job page text - company snapshot, role
     snapshot, and required skills all in a single JSON response, since the
     model needs the same context (the whole page) for all three anyway.
  2. One call over the resume text - just the skills list, same extractor
     used for the job side.
Matching the two skill lists is then a deterministic, explainable Python
step rather than something the model could get subtly wrong or
inconsistent between runs.
"""
import asyncio
import json

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage

from app.core.llm import get_llm
from app.models.schemas import CompanyInfo, JobFitResponse, RoleInfo

# Substrings that show up in Gemini's error messages for things worth one
# automatic retry - a temporary blip, not a real problem with the request.
# Matched case-insensitively against str(exception) rather than importing
# google.api_core's specific exception classes, since the exact exception
# type can shift between langchain-google-genai versions. Same approach as
# document_chat.py's _ask_llm.
_TRANSIENT_ERROR_HINTS = (
    "429", "resource_exhausted", "resource has been exhausted", "rate limit",
    "quota", "503", "unavailable", "overloaded", "deadline exceeded", "timeout",
)
_RETRY_DELAY_SECONDS = 2


async def _invoke_llm(messages: list[BaseMessage]) -> str:
    """Calls the LLM, retrying once after a short delay if the failure looks
    transient. Raises a clean, user-facing RuntimeError on final failure
    instead of leaking the raw provider exception up to the API response -
    without this, an exhausted quota or a timeout was surfacing as a bare
    500 Internal Server Error with no explanation."""
    llm = get_llm()
    last_error: Exception | None = None

    for attempt in range(2):
        try:
            response = await llm.ainvoke(messages)
            return response.content
        except Exception as exc:
            last_error = exc
            is_transient = any(hint in str(exc).lower() for hint in _TRANSIENT_ERROR_HINTS)
            if attempt == 0 and is_transient:
                await asyncio.sleep(_RETRY_DELAY_SECONDS)
                continue
            if is_transient:
                raise RuntimeError(
                    "The AI provider is rate-limited or temporarily unavailable "
                    "right now - wait a few seconds and try again."
                ) from exc
            raise RuntimeError(f"Could not analyze this job: {exc}") from exc

    raise RuntimeError(f"Could not analyze this job: {last_error}")

# Sanity caps - keeps both LLM calls fast, cheap, and within a page's
# actually-useful content even when the raw capture includes nav/sidebar
# clutter alongside the posting.
MAX_JOB_TEXT_CHARS = 20_000
MAX_RESUME_TEXT_CHARS = 20_000

# How many skills/responsibilities we'll ever keep from one extraction -
# long postings can list dozens of "nice to have"s, but a chip list or
# bullet list past this stops being readable anyway.
MAX_SKILLS = 40
MAX_RESPONSIBILITIES = 6

_JOB_DETAILS_SYSTEM_PROMPT = (
    "You read a job posting page (captured as plain text, so it may include "
    "unrelated clutter like navigation links, \"similar jobs\", or "
    "notification counts mixed in - ignore all of that and focus only on "
    "the actual job posting and company description content).\n\n"
    "Reply with ONLY a single JSON object, no prose, no markdown fences, "
    "shaped exactly like this:\n"
    "{\n"
    '  "company": {\n'
    '    "name": "company name, or empty string if not shown",\n'
    '    "overview": "1-2 plain sentences on what the company actually does, '
    'based on the page",\n'
    '    "industry": "short industry label, e.g. \\"Fintech\\" or \\"Healthcare '
    'AI\\", or empty string",\n'
    '    "notable_facts": "1-2 sentences of genuinely known history, focus '
    'areas, or recent news about this company FROM YOUR OWN GENERAL '
    'KNOWLEDGE - leave this as an empty string if you do not actually '
    'recognize the company or are not confident, DO NOT invent or guess "\n'
    "  },\n"
    '  "role": {\n'
    '    "title": "job title as posted",\n'
    '    "employment_type": "e.g. Internship, Full-time, Part-time, '
    'Contract, or empty string if unclear",\n'
    '    "location": "e.g. \\"Pune, India (On-site)\\" or \\"Remote\\", or '
    'empty string",\n'
    '    "responsibilities": ["short bullet", "short bullet", "..."] - up '
    "to 5 of the most important, in the poster's own words where possible\n"
    "  },\n"
    '  "required_skills": ["short skill/tech/qualification", "..."] - the '
    "skills, technologies, tools, and qualifications this role actually "
    "asks for, 1-4 words each, deduplicated\n"
    "}\n\n"
    "Every field is required in the JSON shape above, but string fields may "
    "be empty (\"\") and list fields may be empty ([]) when the information "
    "genuinely isn't available or isn't confidently known - never fabricate "
    "a company fact to fill a field."
)

_SKILLS_ONLY_SYSTEM_PROMPT = (
    "You extract a clean list of skills, technologies, tools, and "
    "qualifications from the text below. Reply with ONLY a JSON array of "
    'short strings, e.g. ["Python", "React", "AWS", "Team leadership"] - no '
    "prose, no markdown fences, no explanation, just the array. Keep each "
    "entry to 1-4 words, remove duplicates and near-duplicates, and skip "
    "generic filler (like \"hard worker\" or \"good communication\") unless "
    "it's explicitly listed as a requirement."
)


def _strip_json_fence(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`").strip()
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    return raw


def _dedupe(items: list, limit: int) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        text = str(item).strip()
        if text and text.lower() not in seen:
            seen.add(text.lower())
            out.append(text)
    return out[:limit]


async def _extract_skills_only(text: str) -> list[str]:
    """Fallback path (also used for the resume side, which only ever needs
    a skills list, not a full company/role breakdown)."""
    if not text.strip():
        return []
    messages = [SystemMessage(content=_SKILLS_ONLY_SYSTEM_PROMPT), HumanMessage(content=text)]
    raw = _strip_json_fence(await _invoke_llm(messages))
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []
    return _dedupe(parsed, MAX_SKILLS)


async def _extract_job_details(job_text: str) -> tuple[CompanyInfo, RoleInfo, list[str]]:
    """The main extraction - company snapshot, role snapshot, and required
    skills in one call. Falls back to a skills-only extraction (still
    useful on its own) if the model's response doesn't parse as the
    expected JSON shape, so a formatting slip doesn't sink the whole
    analysis."""
    if not job_text.strip():
        return CompanyInfo(), RoleInfo(), []

    messages = [SystemMessage(content=_JOB_DETAILS_SYSTEM_PROMPT), HumanMessage(content=job_text)]
    raw = _strip_json_fence(await _invoke_llm(messages))

    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            raise ValueError("expected a JSON object")

        company_raw = parsed.get("company") or {}
        role_raw = parsed.get("role") or {}

        company = CompanyInfo(
            name=str(company_raw.get("name", "")).strip(),
            overview=str(company_raw.get("overview", "")).strip(),
            industry=str(company_raw.get("industry", "")).strip(),
            notable_facts=str(company_raw.get("notable_facts", "")).strip(),
        )
        role = RoleInfo(
            title=str(role_raw.get("title", "")).strip(),
            employment_type=str(role_raw.get("employment_type", "")).strip(),
            location=str(role_raw.get("location", "")).strip(),
            responsibilities=_dedupe(role_raw.get("responsibilities") or [], MAX_RESPONSIBILITIES),
        )
        required_skills = _dedupe(parsed.get("required_skills") or [], MAX_SKILLS)
        return company, role, required_skills

    except (json.JSONDecodeError, ValueError, AttributeError, TypeError):
        # Structured extraction didn't come back clean - still give the
        # user the skills match rather than failing the whole request.
        required_skills = await _extract_skills_only(job_text)
        return CompanyInfo(), RoleInfo(), required_skills


def _match_skills(required: list[str], have: list[str]) -> tuple[list[str], list[str]]:
    """Case-insensitive, substring-tolerant matching - "React" in the resume
    should still count against a job requirement of "React.js", and vice
    versa, without needing a full fuzzy-matching dependency for that."""
    have_lower = [h.lower() for h in have]
    matched, missing = [], []
    for skill in required:
        skill_lower = skill.lower()
        if any(skill_lower in h or h in skill_lower for h in have_lower):
            matched.append(skill)
        else:
            missing.append(skill)
    return matched, missing


def _build_summary(role_title: str, company_name: str, fit_score: int, missing: list[str]) -> str:
    where = f' at {company_name}' if company_name else ""
    role = f' for "{role_title}"' if role_title else ""

    if fit_score >= 80:
        verdict = "a strong match"
    elif fit_score >= 50:
        verdict = "a reasonable match"
    else:
        verdict = "a bit of a stretch right now"

    summary = f"You're {verdict}{role}{where} - {fit_score}% of the listed skills show up in your resume."
    if missing:
        preview = ", ".join(missing[:6])
        summary += f" Consider highlighting or picking up: {preview}."
    return summary


async def analyze_job_fit(job_title_hint: str, job_text: str, resume_text: str) -> JobFitResponse:
    job_text = job_text.strip()[:MAX_JOB_TEXT_CHARS]
    resume_text = resume_text.strip()[:MAX_RESUME_TEXT_CHARS]

    company, role, required_skills = await _extract_job_details(job_text)
    resume_skills = await _extract_skills_only(resume_text)

    matched, missing = _match_skills(required_skills, resume_skills)
    fit_score = round(len(matched) / len(required_skills) * 100) if required_skills else 0

    # The tab title (e.g. the browser tab's own title) is a reasonable
    # fallback if the model couldn't confidently pull a role title out of
    # the page text itself.
    role_title = role.title or job_title_hint

    return JobFitResponse(
        fit_score=fit_score,
        required_skills=required_skills,
        matched_skills=matched,
        missing_skills=missing,
        summary=_build_summary(role_title, company.name, fit_score, missing),
        company=company,
        role=role if role.title else RoleInfo(**{**role.model_dump(), "title": role_title}),
    )
