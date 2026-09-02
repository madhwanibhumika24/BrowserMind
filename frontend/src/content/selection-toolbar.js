if (!window.browsermindToolbarLoaded) {
  window.browsermindToolbarLoaded = true;

  let toolbarEl = null;

  function removeToolbar() {
    toolbarEl?.remove();
    toolbarEl = null;
  }

  function showToolbarNear(rect, selectedText) {
    removeToolbar();

    toolbarEl = document.createElement("div");
    toolbarEl.id = "browsermind-selection-toolbar";
    Object.assign(toolbarEl.style, {
      position: "fixed",
      top: `${rect.top - 42}px`,
      left: `${rect.left}px`,
      zIndex: "2147483647",
      background: "#181b21",
      border: "1px solid #2a2e37",
      borderRadius: "8px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
      padding: "4px",
      display: "flex",
      gap: "4px",
      fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    });

    const makeButton = (label, action) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      Object.assign(btn.style, {
        background: "transparent",
        border: "none",
        color: "#e6e7ea",
        padding: "6px 10px",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "12px",
      });
      btn.addEventListener("mouseenter", () => (btn.style.background = "#2a2e37"));
      btn.addEventListener("mouseleave", () => (btn.style.background = "transparent"));
      btn.addEventListener("click", () => {
        document.dispatchEvent(
          new CustomEvent("browsermind:quick-ask", {
            detail: { text: selectedText, action },
          })
        );
        removeToolbar();
      });
      return btn;
    };

    toolbarEl.appendChild(makeButton("Explain", "explain"));
    toolbarEl.appendChild(makeButton("Summarize", "summarize"));
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
