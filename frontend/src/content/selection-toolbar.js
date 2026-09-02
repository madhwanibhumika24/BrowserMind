if (!window.browsermindToolbarLoaded) {
  window.browsermindToolbarLoaded = true;

  let toolbarEl = null;

  const ICONS = {
    explain:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.3 1 2.5h6c0-1.2.4-1.9 1-2.5A6 6 0 0 0 12 3z"/></svg>',
    summarize:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="6" r="1.3" fill="currentColor" stroke="none"/><line x1="9" y1="6" x2="20" y2="6"/><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none"/><line x1="9" y1="12" x2="20" y2="12"/><circle cx="5" cy="18" r="1.3" fill="currentColor" stroke="none"/><line x1="9" y1="18" x2="16" y2="18"/></svg>',
    simplify:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H8.5l-5-5a2 2 0 0 1 0-2.8l9-9a2 2 0 0 1 2.8 0l6 6a2 2 0 0 1 0 2.8L13 20"/><path d="M8.5 20L15 13.5"/></svg>',
    define:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4C10 2.5 6.5 2 4 2v17c2.5 0 6 .5 8 2 2-1.5 5.5-2 8-2V2c-2.5 0-6 .5-8 2z"/><line x1="12" y1="4" x2="12" y2="21"/></svg>',
    quiz:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.5 2.5 3 6 3s6-1.5 6-3v-5"/></svg>',
  };

  const ACTIONS = [
    { action: "explain", label: "Explain" },
    { action: "summarize", label: "Summarize" },
    { action: "simplify", label: "Simplify" },
    { action: "define", label: "Define" },
    { action: "quiz", label: "Quiz me", divider: true },
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
      top: `${rect.top - 58}px`,
      left: `${rect.left}px`,
      zIndex: "2147483647",
      background: "#171a20",
      border: "1px solid #262a33",
      borderRadius: "10px",
      boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
      padding: "5px 4px",
      display: "flex",
      alignItems: "center",
      gap: "2px",
      fontFamily: "-apple-system, 'Segoe UI', sans-serif",
      opacity: "0",
      transform: "translateY(4px) scale(0.97)",
      transition: "opacity 0.12s ease, transform 0.12s ease",
    });

    ACTIONS.forEach(({ action, label, divider }) => {
      if (divider) {
        const sep = document.createElement("div");
        Object.assign(sep.style, {
          width: "1px",
          height: "28px",
          background: "#262a33",
          margin: "0 4px",
        });
        toolbarEl.appendChild(sep);
      }

      const btn = document.createElement("button");
      Object.assign(btn.style, {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2px",
        width: "50px",
        padding: "5px 2px",
        background: "transparent",
        border: "none",
        color: "#eceef1",
        borderRadius: "8px",
        cursor: "pointer",
      });

      const iconWrap = document.createElement("span");
      iconWrap.innerHTML = ICONS[action];
      iconWrap.querySelector("svg").style.width = "16px";
      iconWrap.querySelector("svg").style.height = "16px";
      btn.appendChild(iconWrap);

      const labelEl = document.createElement("span");
      labelEl.textContent = label;
      Object.assign(labelEl.style, {
        fontSize: "9.5px",
        color: "#8b909c",
        lineHeight: "1",
      });
      btn.appendChild(labelEl);

      btn.addEventListener("mouseenter", () => {
        btn.style.background = "#20242c";
        labelEl.style.color = "#eceef1";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.background = "transparent";
        labelEl.style.color = "#8b909c";
      });
      btn.addEventListener("click", () => {
        fireQuickAsk(action, selectedText);
        removeToolbar();
      });
      toolbarEl.appendChild(btn);
    });

    document.documentElement.appendChild(toolbarEl);
    requestAnimationFrame(() => {
      toolbarEl.style.opacity = "1";
      toolbarEl.style.transform = "translateY(0) scale(1)";
    });
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
