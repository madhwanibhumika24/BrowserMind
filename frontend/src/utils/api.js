// Small wrapper around the BrowserMind backend API.
export const BASE_URL = "http://localhost:8000";
export const AUTH_STORAGE_KEY = "browsermindAuth"; // { token, email, name }

async function authHeaders() {
  const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  const auth = result[AUTH_STORAGE_KEY];
  return auth?.token ? { Authorization: `Bearer ${auth.token}` } : {};
}

export async function sendChatMessage({ sessionId, message, activeTab, openTabs }) {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({
      session_id: sessionId,
      message,
      active_tab: activeTab,
      open_tabs: openTabs,
    }),
  });
  if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);
  return res.json();
}

export async function getMemory(sessionId) {
  const res = await fetch(`${BASE_URL}/memory/${sessionId}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Memory fetch failed: ${res.status}`);
  return res.json();
}

export async function deleteMemory(memoryId) {
  const res = await fetch(`${BASE_URL}/memory`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ memory_id: memoryId }),
  });
  if (!res.ok) throw new Error(`Memory delete failed: ${res.status}`);
  return res.json();
}

export async function summarizeTabs(tabs) {
  const res = await fetch(`${BASE_URL}/tabs/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(tabs),
  });
  if (!res.ok) throw new Error(`Tab summarize failed: ${res.status}`);
  return res.json();
}

export async function generateQuiz(tab) {
  const res = await fetch(`${BASE_URL}/quiz/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(tab),
  });
  if (!res.ok) throw new Error(`Quiz generation failed: ${res.status}`);
  return res.json();
}

export async function generateSummary(tab) {
  const res = await fetch(`${BASE_URL}/summary/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(tab),
  });
  if (!res.ok) throw new Error(`Summary generation failed: ${res.status}`);
  return res.json();
}

export async function generateForm(description, questionCount, kind) {
  const res = await fetch(`${BASE_URL}/forms/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ description, question_count: questionCount || null, kind }),
  });
  if (!res.ok) throw new Error(`Form generation failed: ${res.status}`);
  return res.json();
}

export async function generateFormFromDocument(file, questionCount, kind) {
  const body = new FormData();
  body.append("file", file);
  body.append("question_count", String(questionCount || 0));
  body.append("kind", kind);

  const res = await fetch(`${BASE_URL}/forms/generate-from-document`, {
    method: "POST",
    headers: await authHeaders(), // no Content-Type - browser sets the multipart boundary
    body,
  });
  if (!res.ok) throw new Error(`Form generation failed: ${res.status}`);
  return res.json();
}

export async function getFormResults(formId) {
  const res = await fetch(`${BASE_URL}/forms/${formId}/results`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Form results fetch failed: ${res.status}`);
  return res.json();
}

export function formShareLink(formId) {
  return `${BASE_URL}/forms/${formId}/view`;
}

export async function listMyForms() {
  const res = await fetch(`${BASE_URL}/forms/mine`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Forms list fetch failed: ${res.status}`);
  return res.json();
}

// The CSV endpoint is owner-only (needs the Authorization header), so a
// plain <a href> download won't carry auth - fetch it as a blob instead and
// trigger the save via a throwaway object URL. Filename is built client-side
// rather than read from Content-Disposition, since that header isn't
// guaranteed to be exposed to fetch() across origins.
// Most backend errors here come back as FastAPI's {"detail": "..."} JSON -
// surfacing that instead of just the status code is the difference between
// the user seeing "Document not found" / "rate-limited, try again" and
// always seeing the same generic message no matter what actually failed.
export async function errorMessage(res, fallback) {
  try {
    const body = await res.json();
    if (body?.detail) return body.detail;
  } catch {
    // Response wasn't JSON - fall through to the generic message below.
  }
  return `${fallback}: ${res.status}`;
}

// `files` is an array (or FileList) - one or more documents to chat with
// together in a single session. Each goes under the same "files" field
// name, matching the backend's list[UploadFile] (same convention as the
// PDF merge tool's multi-file upload).
export async function uploadDocument(files) {
  const body = new FormData();
  for (const file of files) body.append("files", file);

  const res = await fetch(`${BASE_URL}/documents/upload`, {
    method: "POST",
    headers: await authHeaders(), // no Content-Type - browser sets the multipart boundary
    body,
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Document upload failed"));
  return res.json();
}

export async function chatWithDocument(documentId, message, history) {
  const res = await fetch(`${BASE_URL}/documents/${documentId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Document chat failed"));
  return res.json();
}

export async function downloadResponsesCsv(formId, fallbackName) {
  const res = await fetch(`${BASE_URL}/forms/${formId}/responses.csv`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`CSV export failed: ${res.status}`);

  const safeName = (fallbackName || "form").replace(/[^a-zA-Z0-9_-]+/g, "_");
  const filename = `${safeName}_responses.csv`;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// JobFit is stateless and unauthenticated like the PDF tools - no
// authHeaders() needed. Pass either `resumeFile` (first use) or
// `resumeText` (reusing a previously-cached extraction) - not both.
export async function analyzeJobFit({ jobTitle, jobText, resumeFile, resumeText }) {
  const body = new FormData();
  body.append("job_title", jobTitle || "");
  body.append("job_text", jobText || "");
  if (resumeFile) body.append("resume", resumeFile);
  if (resumeText) body.append("resume_text", resumeText);

  const res = await fetch(`${BASE_URL}/jobfit/analyze`, { method: "POST", body });
  if (!res.ok) throw new Error(await errorMessage(res, "JobFit analysis failed"));
  return res.json();
}
