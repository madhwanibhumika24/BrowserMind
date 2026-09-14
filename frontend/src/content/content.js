if (!window.browsermindLoaded) {
  window.browsermindLoaded = true;

  let sidebarFrame = null;
  let resizeHandle = null;
  let currentWidth = 380;
  let isResizing = false;
  let resizeStartX = 0;
  let resizeStartWidth = 0;

  const MIN_WIDTH = 280;
  const MAX_WIDTH = 600;
  const MARGIN = 16;

  function getPageExcerpt(maxLen = 2000) {
    return document.body ? document.body.innerText.slice(0, maxLen) : "";
  }

  function positionHandle() {
    resizeHandle.style.left = `${window.innerWidth - MARGIN - currentWidth - 3}px`;
  }

  function sendQueryToSidebar(query, label) {
    sidebarFrame.contentWindow.postMessage(
      { type: "BROWSERMIND_QUICK_ASK", query, label },
      "*"
    );
  }

  function openSidebar(initialQuery, initialLabel) {
    sidebarFrame = document.createElement("iframe");
    sidebarFrame.id = "browsermind-sidebar";
    sidebarFrame.src = chrome.runtime.getURL("src/sidebar/sidebar.html");

    if (initialQuery) {
      sidebarFrame.addEventListener("load", () => sendQueryToSidebar(initialQuery, initialLabel));
    }

    Object.assign(sidebarFrame.style, {
      position: "fixed",
      right: `${MARGIN}px`,
      top: `${MARGIN}px`,
      width: `${currentWidth}px`,
      height: `calc(100vh - ${MARGIN * 2}px)`,
      border: "none",
      borderRadius: "16px",
      zIndex: "2147483647",
      boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
      transition: "transform 0.25s ease, opacity 0.25s ease",
      transform: "translateX(20px)",
      opacity: "0",
    });

    resizeHandle = document.createElement("div");
    Object.assign(resizeHandle.style, {
      position: "fixed",
      top: `${MARGIN}px`,
      height: `calc(100vh - ${MARGIN * 2}px)`,
      width: "6px",
      cursor: "ew-resize",
      zIndex: "2147483647",
    });
    positionHandle();

    resizeHandle.addEventListener("mousedown", (e) => {
      isResizing = true;
      resizeStartX = e.clientX;
      resizeStartWidth = currentWidth;
      sidebarFrame.style.pointerEvents = "none";
    });

    document.documentElement.appendChild(sidebarFrame);
    document.documentElement.appendChild(resizeHandle);

    requestAnimationFrame(() => {
      sidebarFrame.style.transform = "translateX(0)";
      sidebarFrame.style.opacity = "1";
    });
  }

  function closeSidebar() {
    if (!sidebarFrame) return;
    const frameToRemove = sidebarFrame;
    const handleToRemove = resizeHandle;
    sidebarFrame = null;
    resizeHandle = null;

    frameToRemove.style.transform = "translateX(20px)";
    frameToRemove.style.opacity = "0";
    setTimeout(() => {
      frameToRemove.remove();
      handleToRemove?.remove();
    }, 250);
  }

  function toggleSidebar() {
    if (sidebarFrame) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  window.addEventListener("mousemove", (e) => {
    if (!isResizing) return;
    const delta = resizeStartX - e.clientX;
    currentWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeStartWidth + delta));
    sidebarFrame.style.width = `${currentWidth}px`;
    positionHandle();
  });

  window.addEventListener("mouseup", () => {
    if (!isResizing) return;
    isResizing = false;
    if (sidebarFrame) sidebarFrame.style.pointerEvents = "auto";
  });

  function focusChatInput() {
    sidebarFrame.contentWindow.postMessage({ type: "BROWSERMIND_FOCUS_INPUT" }, "*");
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TOGGLE_SIDEBAR") toggleSidebar();
    if (message.type === "GET_PAGE_EXCERPT") return getPageExcerpt();
    if (message.type === "OPEN_QUICK_ASK") {
      if (sidebarFrame) {
        focusChatInput();
      } else {
        openSidebar();
        sidebarFrame.addEventListener("load", focusChatInput, { once: true });
      }
    }
  });

  window.addEventListener("message", (event) => {
    if (event.data?.type === "BROWSERMIND_CLOSE") closeSidebar();
  });

  // `query` is the full prompt sent to the backend (includes the selected
  // text, for context). `label` is the short bubble shown in the chat, so
  // the whole selected paragraph doesn't get echoed back at the user.
  const QUICK_ASK_PROMPTS = {
    explain: (text) => `Explain this: "${text}"`,
    summarize: (text) => `Summarize this: "${text}"`,
    simplify: (text) => `Rewrite this in simple, plain terms: "${text}"`,
    define: (text) => `Define this term/concept: "${text}"`,
    grammar: (text) =>
      `Fix the grammar, spelling, and punctuation of this text, keeping its meaning and tone. Reply with ONLY the corrected text, no explanation: "${text}"`,
    translate: (text) =>
      `Translate this text to English. Reply with ONLY the translation, no explanation: "${text}"`,
  };

  const QUICK_ASK_LABELS = {
    explain: "Explain selected text",
    summarize: "Summarize selected text",
    simplify: "Simplify selected text",
    define: "Define selected text",
    grammar: "Fix grammar",
    translate: "Translate to English",
  };

  document.addEventListener("browsermind:quick-ask", (e) => {
    const { text, action } = e.detail;
    const query = QUICK_ASK_PROMPTS[action](text);
    const label = QUICK_ASK_LABELS[action];

    if (sidebarFrame) {
      sendQueryToSidebar(query, label);
    } else {
      openSidebar(query, label);
    }
  });

  document.addEventListener("browsermind:quiz-selection", (e) => {
    chrome.runtime.sendMessage({
      type: "OPEN_QUIZ_FROM_SELECTION",
      text: e.detail.text,
      url: location.href,
      title: document.title,
    });
  });
}
