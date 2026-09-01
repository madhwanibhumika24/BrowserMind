// Injected into every page. Responsible for mounting/unmounting the
// BrowserMind sidebar iframe, animating it in/out, and letting the user
// drag it around the page.

let sidebarFrame = null;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

const PANEL_WIDTH = 360;
const MARGIN = 16;

function getPageExcerpt(maxLen = 2000) {
  return document.body ? document.body.innerText.slice(0, maxLen) : "";
}

function openSidebar() {
  sidebarFrame = document.createElement("iframe");
  sidebarFrame.id = "browsermind-sidebar";
  sidebarFrame.src = chrome.runtime.getURL("src/sidebar/sidebar.html");

  Object.assign(sidebarFrame.style, {
    position: "fixed",
    left: `${window.innerWidth - PANEL_WIDTH - MARGIN}px`,
    top: `${MARGIN}px`,
    width: `${PANEL_WIDTH}px`,
    height: `calc(100vh - ${MARGIN * 2}px)`,
    border: "none",
    borderRadius: "16px",
    zIndex: "2147483647",
    boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
    transition: "transform 0.25s ease, opacity 0.25s ease",
    transform: "translateX(20px)",
    opacity: "0",
  });

  document.documentElement.appendChild(sidebarFrame);

  // Animate in on the next frame (so the transition actually plays).
  requestAnimationFrame(() => {
    sidebarFrame.style.transform = "translateX(0)";
    sidebarFrame.style.opacity = "1";
  });
}

function closeSidebar() {
  if (!sidebarFrame) return;
  const frameToRemove = sidebarFrame;
  sidebarFrame = null;

  frameToRemove.style.transform = "translateX(20px)";
  frameToRemove.style.opacity = "0";
  setTimeout(() => frameToRemove.remove(), 250);
}

function toggleSidebar() {
  if (sidebarFrame) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "TOGGLE_SIDEBAR") toggleSidebar();
  if (message.type === "GET_PAGE_EXCERPT") return getPageExcerpt();
});

// Messages from inside the sidebar iframe (it's a separate document, so it
// talks to us via postMessage instead of calling functions directly).
window.addEventListener("message", (event) => {
  if (event.data?.type === "BROWSERMIND_CLOSE") {
    closeSidebar();
  }

  if (event.data?.type === "BROWSERMIND_DRAG_START") {
    isDragging = true;
    dragOffsetX = event.data.offsetX;
    dragOffsetY = event.data.offsetY;
    // While dragging, let mouse events pass through the iframe to the page
    // underneath - otherwise we'd stop getting mousemove once the cursor
    // is over the iframe itself.
    if (sidebarFrame) sidebarFrame.style.pointerEvents = "none";
  }
});

window.addEventListener("mousemove", (e) => {
  if (!isDragging || !sidebarFrame) return;
  sidebarFrame.style.left = `${e.clientX - dragOffsetX}px`;
  sidebarFrame.style.top = `${e.clientY - dragOffsetY}px`;
});

window.addEventListener("mouseup", () => {
  if (!isDragging) return;
  isDragging = false;
  if (sidebarFrame) sidebarFrame.style.pointerEvents = "auto";
});
