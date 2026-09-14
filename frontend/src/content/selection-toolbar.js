if (!window.browsermindToolbarLoaded) {
  window.browsermindToolbarLoaded = true;

  let toolbarEl = null;
  let morePanelEl = null;
  let moreBtnEl = null;

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
    grammar:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>',
    translate:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h7M9 3v2c0 4.5-2 8-6 10"/><path d="M5 9c0 2 2.5 4.5 6 6"/><path d="M13 21l5-11 5 11"/><path d="M14.5 17.5h7"/></svg>',
  };

  // Kept short on purpose - only the two or three actions someone reaches
  // for most often. Everything else lives one tap away behind "+", so the
  // toolbar itself never gets wide or cluttered.
  const PRIMARY_ACTIONS = [
    { action: "explain", label: "Explain" },
    { action: "summarize", label: "Summarize" },
    { action: "quiz", label: "Quiz me" },
  ];

  const MORE_ACTIONS = [
    { action: "simplify", label: "Simplify" },
    { action: "define", label: "Define" },
    { action: "grammar", label: "Fix Grammar" },
    { action: "translate", label: "Translate" },
  ];

  function removeMorePanel() {
    morePanelEl?.remove();
    morePanelEl = null;
    if (moreBtnEl) {
      moreBtnEl.style.background = "transparent";
      moreBtnEl.style.borderColor = "rgba(255, 255, 255, 0.14)";
    }
  }

  function removeToolbar() {
    removeMorePanel();
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

  function styleActionButton(btn, iconWrap, labelEl) {
    btn.addEventListener("mouseenter", () => {
      btn.style.background = "rgba(255, 255, 255, 0.07)";
      btn.style.borderColor = "rgba(255, 255, 255, 0.1)";
      iconWrap.style.color = "#a78bfa";
      if (labelEl) labelEl.style.color = "#eceef1";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "transparent";
      btn.style.borderColor = "transparent";
      iconWrap.style.color = "#b9a8ff";
      if (labelEl) labelEl.style.color = "#8b909c";
    });
  }

  function makeActionButton({ action, label }, selectedText) {
    const btn = document.createElement("button");
    Object.assign(btn.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "2px",
      width: "50px",
      padding: "6px 2px",
      background: "transparent",
      border: "1px solid transparent",
      color: "#eceef1",
      borderRadius: "9px",
      cursor: "pointer",
      transition: "background 0.15s ease, border-color 0.15s ease",
      fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    });

    const iconWrap = document.createElement("span");
    iconWrap.innerHTML = ICONS[action];
    iconWrap.querySelector("svg").style.width = "16px";
    iconWrap.querySelector("svg").style.height = "16px";
    iconWrap.style.color = "#b9a8ff";
    iconWrap.style.transition = "color 0.15s ease";
    btn.appendChild(iconWrap);

    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    Object.assign(labelEl.style, {
      fontSize: "9.5px",
      color: "#8b909c",
      lineHeight: "1",
      textAlign: "center",
    });
    btn.appendChild(labelEl);

    styleActionButton(btn, iconWrap, labelEl);
    btn.addEventListener("click", () => {
      fireQuickAsk(action, selectedText);
      removeToolbar();
    });
    return btn;
  }

  function addSeparator(container) {
    const sep = document.createElement("div");
    Object.assign(sep.style, {
      width: "1px",
      height: "26px",
      background: "rgba(255, 255, 255, 0.08)",
      margin: "0 2px",
      flexShrink: "0",
    });
    container.appendChild(sep);
  }

  function toggleMorePanel(selectedText) {
    if (morePanelEl) {
      removeMorePanel();
      return;
    }

    const btnRect = moreBtnEl.getBoundingClientRect();
    const PANEL_WIDTH = 168;

    morePanelEl = document.createElement("div");
    morePanelEl.className = "browsermind-more-panel";
    Object.assign(morePanelEl.style, {
      position: "fixed",
      zIndex: "2147483647",
      width: `${PANEL_WIDTH}px`,
      background: "rgba(19, 20, 26, 0.97)",
      backdropFilter: "blur(12px) saturate(140%)",
      WebkitBackdropFilter: "blur(12px) saturate(140%)",
      border: "1px solid rgba(139, 122, 255, 0.28)",
      borderRadius: "10px",
      boxShadow: "0 10px 24px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)",
      padding: "5px",
      fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    });

    MORE_ACTIONS.forEach(({ action, label }) => {
      const row = document.createElement("button");
      Object.assign(row.style, {
        display: "flex",
        alignItems: "center",
        gap: "9px",
        width: "100%",
        padding: "7px 9px",
        background: "transparent",
        border: "none",
        color: "#eceef1",
        borderRadius: "7px",
        cursor: "pointer",
        fontSize: "12.5px",
        fontFamily: "inherit",
        textAlign: "left",
      });

      const iconWrap = document.createElement("span");
      iconWrap.innerHTML = ICONS[action];
      iconWrap.querySelector("svg").style.width = "14px";
      iconWrap.querySelector("svg").style.height = "14px";
      Object.assign(iconWrap.style, {
        color: "#b9a8ff",
        display: "flex",
        flexShrink: "0",
      });
      row.appendChild(iconWrap);

      const labelEl = document.createElement("span");
      labelEl.textContent = label;
      row.appendChild(labelEl);

      row.addEventListener("mouseenter", () => {
        row.style.background = "rgba(255, 255, 255, 0.08)";
      });
      row.addEventListener("mouseleave", () => {
        row.style.background = "transparent";
      });
      row.addEventListener("click", () => {
        fireQuickAsk(action, selectedText);
        removeToolbar();
      });

      morePanelEl.appendChild(row);
    });

    document.documentElement.appendChild(morePanelEl);

    // Position after appending so we know its real height; prefer opening
    // below the toolbar, flip above if that would run off-screen.
    const panelHeight = morePanelEl.getBoundingClientRect().height;
    let top = btnRect.bottom + 6;
    if (top + panelHeight > window.innerHeight - 8) {
      top = btnRect.top - panelHeight - 6;
    }
    top = Math.max(8, top);
    let left = Math.min(btnRect.left, window.innerWidth - PANEL_WIDTH - 8);
    left = Math.max(8, left);

    morePanelEl.style.top = `${top}px`;
    morePanelEl.style.left = `${left}px`;

    moreBtnEl.style.background = "rgba(139, 122, 255, 0.22)";
    moreBtnEl.style.borderColor = "rgba(168, 148, 255, 0.5)";
  }

  function makeMoreButton(selectedText) {
    moreBtnEl = document.createElement("button");
    moreBtnEl.title = "More actions";
    Object.assign(moreBtnEl.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "30px",
      height: "30px",
      flexShrink: "0",
      background: "transparent",
      border: "1px solid rgba(255, 255, 255, 0.14)",
      borderRadius: "50%",
      color: "#eceef1",
      cursor: "pointer",
      fontSize: "16px",
      lineHeight: "1",
      transition: "background 0.15s ease, border-color 0.15s ease",
    });
    moreBtnEl.textContent = "+";

    moreBtnEl.addEventListener("mouseenter", () => {
      if (!morePanelEl) moreBtnEl.style.background = "rgba(255, 255, 255, 0.08)";
    });
    moreBtnEl.addEventListener("mouseleave", () => {
      if (!morePanelEl) moreBtnEl.style.background = "transparent";
    });
    moreBtnEl.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMorePanel(selectedText);
    });

    return moreBtnEl;
  }

  function showToolbarNear(rect, selectedText) {
    removeToolbar();

    // Belt-and-suspenders: if an older version of this script is still
    // attached to the page (extension reloaded without refreshing the tab),
    // its toolbar/panel won't be in our local variables above, but it will
    // still be in the DOM under these same element IDs/classes - so this
    // catches it by direct lookup instead of relying on shared JS state.
    document.getElementById("browsermind-selection-toolbar")?.remove();
    document.querySelectorAll(".browsermind-more-panel").forEach((el) => el.remove());

    const TOOLBAR_HEIGHT = 58;
    const TOOLBAR_WIDTH = 230; // 3 primary actions + the "+" button

    // rect is the bounding box of the WHOLE selection, which can start above
    // or extend below the visible viewport (e.g. selecting to the bottom of
    // a long page). Clamp so the toolbar always lands on-screen: prefer just
    // above the selection, fall back to just below, then clamp both axes.
    let top = rect.top - TOOLBAR_HEIGHT;
    if (top < 8) {
      top = rect.bottom + 8;
    }
    top = Math.max(8, Math.min(top, window.innerHeight - TOOLBAR_HEIGHT - 8));

    let left = Math.max(8, Math.min(rect.left, window.innerWidth - TOOLBAR_WIDTH - 8));

    toolbarEl = document.createElement("div");
    toolbarEl.id = "browsermind-selection-toolbar";
    Object.assign(toolbarEl.style, {
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      zIndex: "2147483647",
      background: "rgba(19, 20, 26, 0.97)",
      backdropFilter: "blur(12px) saturate(140%)",
      WebkitBackdropFilter: "blur(12px) saturate(140%)",
      border: "1px solid rgba(139, 122, 255, 0.28)",
      borderTop: "1px solid rgba(168, 148, 255, 0.55)",
      borderRadius: "12px",
      boxShadow:
        "0 10px 24px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.25), 0 0 18px rgba(147, 112, 255, 0.55), 0 0 38px rgba(147, 112, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
      padding: "6px 5px",
      display: "flex",
      alignItems: "center",
      gap: "2px",
      fontFamily: "-apple-system, 'Segoe UI', sans-serif",
      opacity: "0",
      transform: "translateY(4px) scale(0.97)",
      transition: "opacity 0.12s ease, transform 0.12s ease",
    });

    PRIMARY_ACTIONS.forEach((entry, index) => {
      if (index > 0) addSeparator(toolbarEl);
      toolbarEl.appendChild(makeActionButton(entry, selectedText));
    });

    addSeparator(toolbarEl);
    toolbarEl.appendChild(makeMoreButton(selectedText));

    document.documentElement.appendChild(toolbarEl);
    requestAnimationFrame(() => {
      toolbarEl.style.opacity = "1";
      toolbarEl.style.transform = "translateY(0) scale(1)";
    });
  }

  document.addEventListener("mouseup", (e) => {
    // Clicking the toolbar or its "+" panel also fires mouseup on document,
    // and it can clear the text selection - don't let that destroy them out
    // from under a button before its click handler runs.
    if (toolbarEl && toolbarEl.contains(e.target)) return;
    if (morePanelEl && morePanelEl.contains(e.target)) return;

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
    if (morePanelEl && !morePanelEl.contains(e.target) && !moreBtnEl.contains(e.target)) {
      removeMorePanel();
    }
    if (toolbarEl && !toolbarEl.contains(e.target) && !morePanelEl?.contains(e.target)) {
      removeToolbar();
    }
  });

  // The toolbar is `position: fixed`, so it already stays put on screen
  // while the page scrolls underneath it - no need to close it on scroll.
  // (Previously we did, which made it vanish the moment you scrolled to
  // check it.) It still closes on click-away, new selection, or Escape.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") removeToolbar();
  });
}
