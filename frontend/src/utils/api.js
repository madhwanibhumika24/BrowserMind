// Small wrapper around the BrowserMind backend API.
const BASE_URL = "http://localhost:8000";

export async function sendChatMessage({ sessionId, message, activeTab, openTabs }) {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const res = await fetch(`${BASE_URL}/memory/${sessionId}`);
  if (!res.ok) throw new Error(`Memory fetch failed: ${res.status}`);
  return res.json();
}

export async function deleteMemory(memoryId) {
  const res = await fetch(`${BASE_URL}/memory`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memory_id: memoryId }),
  });
  if (!res.ok) throw new Error(`Memory delete failed: ${res.status}`);
  return res.json();
}

export async function summarizeTabs(tabs) {
  const res = await fetch(`${BASE_URL}/tabs/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tabs),
  });
  if (!res.ok) throw new Error(`Tab summarize failed: ${res.status}`);
  return res.json();
}

export async function generateQuiz(tab) {
  const res = await fetch(`${BASE_URL}/quiz/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tab),
  });
  if (!res.ok) throw new Error(`Quiz generation failed: ${res.status}`);
  return res.json();
}

export async function generateSummary(tab) {
  const res = await fetch(`${BASE_URL}/summary/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tab),
  });
  if (!res.ok) throw new Error(`Summary generation failed: ${res.status}`);
  return res.json();
}
