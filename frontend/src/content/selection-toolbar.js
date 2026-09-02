if (!window.browsermindToolbarLoaded) {
  window.browsermindToolbarLoaded = true;

  let toolbarEl = null;

  const ICONS = {
    explain:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.3 1 2.5h6c0-1.2.4-1.9 1-2.5A6 6 0 0 0 12 3z"/></svg>',
    summarize:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="10" y2="18"/></svg>',
    simplify:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M4 6h10M4 18h6"/></svg>',
    define:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17z"/><line x1="8" y1="7" x2="15" y2="7"/><line x1="8" y1="11" x2="15" y2="11"/></svg>',
    quiz:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.5 2.5 3 6 3s6-1.5 6-3v-5"/></svg>',
  };

  const ACTIONS = [
    { action: "explain", label: "Explain" },
    { action: "summarize", label: "Summarize" },
    { action: "simplify", label: "Simplify" },
    { action: "define", label: "Define" },
    { action: "quiz", label: "Quiz me" },
  ];

  function removeToolbar() {
    toolbarEl?.remove();
    toolbarEl = null;
  }

  function fireQuickAsk(action, text) {
    if (action === "quiz") {
      document.dispatchEvent(
        new CustomEvent("browsermind:quiz-selection", { detail: { text } })
      );
    } else {
      document.dispatchEvent(
        new CustomEvent("browsermind:quick-ask", { detail: { text, action } })
      );
    }
  }

  function showToolbarNear(rect, selectedText) {
    removeToolbar();

    toolbarEl = document.createElement("div");
    toolbarEl.id = "browsermind-selection-toolbar";
    Object.assign(toolbarEl.style, {
      position: "fixed",
      top: `${rect.top - 46}px`,
      left: `${rect.left}px`,
      zIndex: "2147483647",
      background: "#171a20",
      border: "1px solid #262a33",
      borderRadius: "10px",
      boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
      padding: "5px",
      display: "flex",
      gap: "2px",
      fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    });

    ACTIONS.forEach(({ action, label }) => {
      const btn = document.createElement("button");
      btn.title = label;
      btn.innerHTML = ICONS[action];
      Object.assign(btn.style, {
        width: "32px",
        height: "32px",
        background: "transparent",
        border: "none",
        color: "#eceef1",
        borderRadius: "7px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      });
      btn.querySelector("svg").style.width = "16px";
      btn.querySelector("svg").style.height = "16px";

      btn.addEventListener("mouseenter", () => (btn.style.background = "#20242c"));
      btn.addEventListener("mouseleave", () => (btn.style.background = "transparent"));
      btn.addEventListener("click", () => {
        fireQuickAsk(action, selectedText);
        removeToolbar();
      });
      toolbarEl.appendChild(btn);
    });

    document.documentElement.appendChild(toolbarEl);
  }

  document.addEventListener("mouseup", () => {
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : "";

    if (!selectedText) {
      removeToolbar();
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    showToolbarNear(rect, selectedText);
  });

  document.addEventListener("mousedown", (e) => {
    if (toolbarEl && !toolbarEl.contains(e.target)) removeToolbar();
  });
  document.addEventListener("scroll", removeToolbar, true);
}
