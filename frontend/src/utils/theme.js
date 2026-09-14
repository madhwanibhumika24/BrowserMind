// Applies the user's saved light/dark theme preference (set via the toggle
// in the sidebar) to a standalone tool tab - Forms, Quiz, Mindmap, PDF
// Tools, Text Tools, and Chat with Document all open as their own browser
// tab (see background.js), so without this they'd always fall back to the
// tokens.css default (dark) instead of matching whatever the sidebar is
// currently set to.
const THEME_KEY = "browsermindTheme";

export function applyStoredTheme() {
  chrome.storage.local.get(THEME_KEY, (result) => {
    document.documentElement.setAttribute("data-theme", result[THEME_KEY] || "dark");
  });

  // Keep this tab in sync if the user flips the toggle in the sidebar while
  // this tab is already open in another window.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[THEME_KEY]) {
      document.documentElement.setAttribute("data-theme", changes[THEME_KEY].newValue || "dark");
    }
  });
}
