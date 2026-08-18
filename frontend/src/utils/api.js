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
