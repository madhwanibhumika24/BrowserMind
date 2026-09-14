// Google Form creation happens entirely client-side (see googleForms.js) and
// the backend never learns the resulting formId/links - so without this,
// reopening a form from "My Forms" would have no way to know a Google Form
// was already created for it, and clicking "Create Google Form" again would
// silently spawn a duplicate in Drive every time. This persists the created
// record locally, keyed by BrowserMind's own form id, so reopening shows the
// existing link straight away instead of re-creating it.
const STORAGE_PREFIX = "browsermindGform_";

export async function saveGoogleFormRecord(browserMindFormId, record) {
  await chrome.storage.local.set({ [STORAGE_PREFIX + browserMindFormId]: record });
}

export async function getGoogleFormRecord(browserMindFormId) {
  const key = STORAGE_PREFIX + browserMindFormId;
  const result = await chrome.storage.local.get(key);
  return result[key] || null;
}
