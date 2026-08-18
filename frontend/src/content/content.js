// Injected into every page. Responsible for mounting/unmounting the
// BrowserMind sidebar iframe and extracting a lightweight page excerpt.

let sidebarFrame = null;

function getPageExcerpt(maxLen = 2000) {
  return document.body ? document.body.innerText.slice(0, maxLen) : "";
}

function toggleSidebar() {
  if (sidebarFrame) {
    sidebarFrame.remove();
    sidebarFrame = null;
    return;
  }
  sidebarFrame = document.createElement("iframe");
  sidebarFrame.id = "browsermind-sidebar";
  sidebarFrame.src = chrome.runtime.getURL("src/sidebar/sidebar.html");
  Object.assign(sidebarFrame.style, {
    position: "fixed",
    top: "0",
    right: "0",
    width: "380px",
    height: "100vh",
    border: "none",
    zIndex: "2147483647",
    boxShadow: "-2px 0 12px rgba(0,0,0,0.15)",
  });
  document.documentElement.appendChild(sidebarFrame);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "TOGGLE_SIDEBAR") toggleSidebar();
  if (message.type === "GET_PAGE_EXCERPT") return getPageExcerpt();
});
