// Turns the handful of markdown the model actually uses (headers, bold,
// italics, inline code, bullet/numbered lists, --- rules) into real HTML
// instead of dumping literal "###"/"**"/"* " characters into a chat bubble.
// Deliberately small and regex-based rather than pulling in a markdown
// library - extensions can't load remotely-hosted code, and this covers
// everything the assistant's replies (summaries, definitions, explanations,
// quiz feedback, document answers, etc.) actually produce.
//
// Shared by sidebar.js and document-chat.js so both chat surfaces render
// assistant replies the same way instead of keeping two copies in sync.

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// The model answers document questions (physics/image-processing formulas,
// etc.) in inline LaTeX like "$s = c \cdot \log(1 + r)$" - dumped raw that's
// dollar signs and backslashes in the middle of a sentence. This is not a
// LaTeX engine (no KaTeX/MathJax - extensions can't load remotely-hosted
// code, and vendoring one is overkill for a handful of simple formulas).
// Instead it covers the macros that actually show up: operators/Greek
// letters -> their Unicode character, \frac{a}{b} -> a stacked fraction,
// ^/_ -> real sup/sub, and known function names (log, sin, ...) set upright
// instead of italic - enough to make a formula read cleanly without dollar
// signs or backslash commands.
const MATH_SYMBOLS = {
  cdot: "·", times: "×", div: "÷", pm: "±", mp: "∓",
  leq: "≤", geq: "≥", neq: "≠", approx: "≈", equiv: "≡",
  infty: "∞", partial: "∂", nabla: "∇",
  pi: "π", theta: "θ", alpha: "α", beta: "β", gamma: "γ",
  delta: "δ", Delta: "Δ", sigma: "σ", Sigma: "Σ", mu: "μ",
  lambda: "λ", Lambda: "Λ", omega: "ω", Omega: "Ω",
  phi: "φ", psi: "ψ", rho: "ρ", tau: "τ",
  sum: "∑", int: "∫", prod: "∏", forall: "∀", exists: "∃",
  in: "∈", notin: "∉", subset: "⊂", cup: "∪", cap: "∩",
  rightarrow: "→", to: "→", Rightarrow: "⇒", leftarrow: "←",
};

const MATH_FUNCTIONS = ["log", "ln", "exp", "sin", "cos", "tan", "min", "max", "det", "lim"];

// Plain string split/join instead of building regexes from macro names -
// avoids any backslash-escaping mistakes, and these macro names never
// overlap as substrings of each other.
function replaceAllLiteral(text, search, replacement) {
  return text.split(search).join(replacement);
}

function renderFormula(raw) {
  let expr = escapeHtml(raw.trim());
  if (!expr) return "";

  // \frac{a}{b} -> a stacked fraction (one level of nesting covers every
  // formula a college-level document actually uses).
  expr = expr.replace(
    /\\frac\{([^{}]*)\}\{([^{}]*)\}/g,
    (_, num, den) =>
      `<span class="bm-frac"><span class="bm-frac-num">${num}</span><span class="bm-frac-den">${den}</span></span>`
  );

  // \sqrt{...}
  expr = expr.replace(/\\sqrt\{([^{}]*)\}/g, '<span class="bm-sqrt">&radic;<span class="bm-sqrt-bar">$1</span></span>');

  // \left( \right) etc. - drop the sizing command, keep the bracket itself
  expr = expr.replace(/\\(?:left|right)([(){}[\]|])/g, "$1");
  expr = expr.replace(/\\(?:left|right)\./g, "");

  // superscripts / subscripts, braced or single-character
  expr = expr.replace(/\^\{([^{}]*)\}/g, "<sup>$1</sup>");
  expr = expr.replace(/\^([A-Za-z0-9])/g, "<sup>$1</sup>");
  expr = expr.replace(/_\{([^{}]*)\}/g, "<sub>$1</sub>");
  expr = expr.replace(/_([A-Za-z0-9])/g, "<sub>$1</sub>");

  // known function names -> upright (non-italic) label
  for (const fn of MATH_FUNCTIONS) {
    expr = replaceAllLiteral(expr, `\\${fn}`, `<span class="bm-fn">${fn}</span>`);
  }

  // operators / Greek letters -> Unicode
  for (const [name, symbol] of Object.entries(MATH_SYMBOLS)) {
    expr = replaceAllLiteral(expr, `\\${name}`, symbol);
  }

  // spacing commands
  expr = expr.replace(/\\[,;:]/g, " ");

  // anything else with a stray backslash command - drop the backslash,
  // keep the word, so nothing renders with a literal "\" in it
  expr = expr.replace(/\\([a-zA-Z]+)/g, "$1");

  return `<span class="bm-formula">${expr}</span>`;
}

// Pulls "$...$" inline math out before escaping/markdown so the formula
// regexes above never collide with the **bold**/*italic* ones below, then
// splices the rendered HTML back in via a placeholder token that survives
// escapeHtml untouched (it isn't a special character in HTML or Markdown).
function extractMath(text) {
  const formulas = [];
  const replaced = text.replace(/\$([^$\n]+)\$/g, (_, expr) => {
    const index = formulas.length;
    formulas.push(renderFormula(expr));
    return `${index}`;
  });
  return { text: replaced, formulas };
}

function formatInline(text) {
  const { text: withPlaceholders, formulas } = extractMath(text);
  let html = escapeHtml(withPlaceholders);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  html = html.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
  html = html.replace(/(\d+)/g, (_, i) => formulas[Number(i)]);
  return html;
}

export function formatReply(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let listType = null;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${paragraph.join("<br>")}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeList();
      out.push(`<div class="msg-h${heading[1].length}">${formatInline(heading[2])}</div>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line)) {
      flushParagraph();
      closeList();
      out.push("<hr>");
      continue;
    }

    const bullet = line.match(/^[*-]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${formatInline(bullet[1])}</li>`);
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${formatInline(numbered[1])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(formatInline(line));
  }
  flushParagraph();
  closeList();

  return out.join("");
}
