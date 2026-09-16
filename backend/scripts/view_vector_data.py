"""Shows what's actually stored in the Chroma vector database - useful
for a live demo, since Chroma is a local embedded store (backend/data/chroma)
with no GUI like MySQL Workbench to browse it visually.

Prints a short grouped summary to the terminal (counts per document/session,
not a wall of text), and writes a polished, browsable report to
backend/data/vector_report.html - styled to match BrowserMind's own dark
theme, with summary stat cards, one card per document/session, metadata
shown as small chips, and click-to-expand full text per chunk - then opens
it in your default browser automatically.

Usage (from the backend/ folder):
    python scripts/view_vector_data.py
"""
import os
import sys
import webbrowser
from collections import defaultdict
from html import escape
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.vectorstore.client import document_chunks_collection, memory_items_collection

# Same per-tool accent palette already used for icon tiles elsewhere in the
# extension's UI (pdf-tools.html, the sidebar's home screen) - reused here
# so a group's color means the same thing it would anywhere else in the app.
_GROUP_COLORS = ["#a78bfa", "#7dd3fc", "#6ee7b7", "#fbbf24", "#5eead4", "#f9a8d4"]

REPORT_PATH = Path(__file__).resolve().parent.parent / "data" / "vector_report.html"

# Standard install locations for Brave on Windows - a per-machine install
# lands under Program Files, a per-user install under LocalAppData. Trying
# both means this works without the user having to configure anything.
_BRAVE_CANDIDATES = [
    Path(os.environ.get("PROGRAMFILES", "")) / "BraveSoftware" / "Brave-Browser" / "Application" / "brave.exe",
    Path(os.environ.get("PROGRAMFILES(X86)", "")) / "BraveSoftware" / "Brave-Browser" / "Application" / "brave.exe",
    Path(os.environ.get("LOCALAPPDATA", "")) / "BraveSoftware" / "Brave-Browser" / "Application" / "brave.exe",
]


def open_report(path: Path) -> None:
    """Opens the report straight in Brave if it's installed in one of the
    usual places - skips the OS's "how do you want to open this" prompt
    and, importantly, avoids VS Code or any other non-browser app grabbing
    it. Falls back to whatever the system's default handler is otherwise."""
    brave = next((c for c in _BRAVE_CANDIDATES if c.exists()), None)
    if brave:
        webbrowser.register("brave", None, webbrowser.BackgroundBrowser(str(brave)))
        webbrowser.get("brave").open(path.as_uri())
    else:
        print("(Brave not found in its usual install location - opening with your system default instead.)")
        webbrowser.open(path.as_uri())


# Chroma returns embeddings as a numpy array (not a plain list) once numpy
# is installed - numpy raises "truth value of an array is ambiguous" on
# `array or default`, so every field here is checked with `is None`
# instead of relying on truthiness.
def _or_empty(value, default):
    return default if value is None else value


def _fetch(collection) -> list[dict]:
    """Returns a flat list of {id, text, metadata, vector} dicts - easier
    to group/sort than Chroma's parallel-arrays response shape."""
    data = collection.get(include=["documents", "metadatas", "embeddings"])
    ids = _or_empty(data.get("ids"), [])
    documents = _or_empty(data.get("documents"), [])
    metadatas = _or_empty(data.get("metadatas"), [])
    embeddings = _or_empty(data.get("embeddings"), [])

    items = []
    for i, item_id in enumerate(ids):
        text = documents[i] if i < len(documents) and documents[i] else ""
        meta = metadatas[i] if i < len(metadatas) else {}
        vector = list(embeddings[i]) if i < len(embeddings) else []
        items.append({"id": item_id, "text": text, "metadata": meta, "vector": vector})
    return items


def _group_key(item: dict) -> str:
    meta = item["metadata"] or {}
    return meta.get("filename") or meta.get("session_id") or "(ungrouped)"


def print_summary(name: str, items: list[dict]) -> None:
    print(f"\n=== {name} ({len(items)} items) ===")
    if not items:
        print("  (empty)")
        return

    groups = defaultdict(list)
    for item in items:
        groups[_group_key(item)].append(item)

    for group_name, group_items in sorted(groups.items()):
        dims = len(group_items[0]["vector"]) if group_items[0]["vector"] else 0
        print(f"  {group_name}: {len(group_items)} chunks ({dims} dimensions each)")


def _smart_truncate(text: str, limit: int = 200) -> str:
    """Cuts at the last whole word inside the limit instead of slicing mid-
    word/mid-sentence, so previews read as "...detected in circuit" rather
    than "...detected in circ"."""
    flat = text.replace("\n", " ")
    if len(flat) <= limit:
        return flat
    cut = flat[:limit].rsplit(" ", 1)[0]
    return f"{cut} …"


def _row_html_id(item_id: str) -> str:
    """A safe HTML id/JS-string version of Chroma's own id (which contains
    "::" for chunk ids) - strips anything that isn't alnum/hyphen so it's
    never at risk of breaking the onclick="..." string it's embedded in."""
    return "row-" + "".join(c if c.isalnum() or c == "-" else "-" for c in item_id)


def _meta_chips(meta: dict) -> str:
    """Metadata as small pill badges (key: value) instead of a raw Python
    dict string - the same visual language as the chip components already
    used across the extension's own UI."""
    chips = "".join(
        f"<span class='chip'><span class='chip-key'>{escape(str(k))}</span>{escape(str(v))}</span>"
        for k, v in (meta or {}).items()
        if k not in ("filename", "session_id")  # already shown as the card title
    )
    return chips or "<span class='chip chip-muted'>no extra metadata</span>"


def _render_chunk_rows(group_items: list[dict]) -> str:
    rows = []
    for item in sorted(group_items, key=lambda it: (it["metadata"] or {}).get("chunk_index", 0)):
        row_id = _row_html_id(item["id"])
        preview = escape(_smart_truncate(item["text"]))
        full_text = escape(item["text"])
        vector_preview = ", ".join(f"{v:.4f}" for v in item["vector"][:5])
        dims = len(item["vector"])
        rows.append(
            f"<tr class='chunk-row' onclick=\"toggleFull('{row_id}')\">"
            f"<td class='id'>{escape(item['id'])}</td>"
            f"<td>{preview} <span class='view-full'>View full text &rarr;</span></td>"
            f"<td>{_meta_chips(item['metadata'])}</td>"
            f"<td class='vec'>[{vector_preview}, …]<br><span class='dims'>{dims} dims</span></td></tr>"
            f"<tr class='full-row hidden' id='{row_id}'>"
            f"<td colspan='4'><pre>{full_text}</pre></td></tr>"
        )
    return "".join(rows)


def _render_group_card(group_name: str, group_items: list[dict]) -> str:
    dims = len(group_items[0]["vector"]) if group_items[0]["vector"] else 0
    return f"""
    <section class="group-card">
      <div class="group-card-header">
        <div class="group-icon">&#128196;</div>
        <div>
          <h3>{escape(group_name)}</h3>
          <p class="group-meta">{len(group_items)} chunk{'s' if len(group_items) != 1 else ''} &middot; {dims} dimensions each</p>
        </div>
      </div>
      <table>
        <thead><tr><th>ID</th><th>Text preview <span class="hint">(click a row for the full text)</span></th><th>Metadata</th><th>Embedding preview</th></tr></thead>
        <tbody>{_render_chunk_rows(group_items)}</tbody>
      </table>
    </section>"""


def _render_collection_section(title: str, subtitle: str, icon: str, items: list[dict]) -> str:
    if not items:
        return f"""
    <div class="collection-header">
      <span class="collection-icon">{icon}</span>
      <div><h2>{escape(title)}</h2><p class="collection-sub">{escape(subtitle)}</p></div>
    </div>
    <p class="empty">Nothing stored here yet.</p>"""

    groups = defaultdict(list)
    for item in items:
        groups[_group_key(item)].append(item)

    cards = "".join(_render_group_card(g, its) for g, its in sorted(groups.items()))
    return f"""
    <div class="collection-header">
      <span class="collection-icon">{icon}</span>
      <div><h2>{escape(title)} <span class="count">({len(items)} items across {len(groups)} group{'s' if len(groups) != 1 else ''})</span></h2>
      <p class="collection-sub">{escape(subtitle)}</p></div>
    </div>
    {cards}"""


def _stat_card(label: str, value: str) -> str:
    return f"<div class='stat-card'><div class='stat-value'>{escape(value)}</div><div class='stat-label'>{escape(label)}</div></div>"


_PIPELINE_STEPS = [
    ("&#128196;", "Text chunk", "A piece of a document or a remembered message - plain text."),
    ("&#129504;", "Embedding model", "Google's Gemini embedding model reads the text and converts its meaning into numbers."),
    ("&#128290;", "Vector", "A list of ~3,072 numbers - not keywords, a mathematical fingerprint of what the text means."),
    ("&#128269;", "Stored + compared", "Chroma stores the vector and finds others close to it in that space - that's how BrowserMind matches meaning, not just exact words."),
]


def _render_pipeline_explainer() -> str:
    steps = "".join(
        f"""<div class="pipe-step">
              <div class="pipe-icon">{icon}</div>
              <div class="pipe-title">{escape(title)}</div>
              <div class="pipe-desc">{escape(desc)}</div>
            </div>"""
        + ("<div class='pipe-arrow'>&rarr;</div>" if i < len(_PIPELINE_STEPS) - 1 else "")
        for i, (icon, title, desc) in enumerate(_PIPELINE_STEPS)
    )
    return f"""
    <section class="explainer">
      <h2>How this actually works</h2>
      <p class="collection-sub">Every row below started as plain text and went through this exact pipeline:</p>
      <div class="pipeline">{steps}</div>
    </section>"""


def _pca_2d(vectors: list[list[float]]) -> list[tuple[float, float]]:
    """Reduces high-dimensional embeddings (3,072 numbers each) down to 2
    numbers per item, purely for plotting - the 2D position has no meaning
    on its own, but the *distances* between points are preserved as well
    as 2 dimensions can: text with similar meaning ends up as dots close
    together. Plain SVD-based PCA via numpy - no extra ML dependency
    needed just to draw a scatter plot."""
    if len(vectors) < 2:
        return [(0.0, 0.0) for _ in vectors]
    matrix = np.array(vectors, dtype=float)
    matrix = matrix - matrix.mean(axis=0)
    u, s, _vt = np.linalg.svd(matrix, full_matrices=False)
    coords = u[:, :2] * s[:2]
    return [(float(x), float(y)) for x, y in coords]


def _render_scatter_svg(collection_title: str, items: list[dict]) -> str:
    """A 2D map of every embedding in this collection, color-coded by
    document/session - the clearest possible "what's happening behind the
    scenes" visual: chunks from the same document cluster together because
    their embeddings are numerically close, which is the entire idea a
    vector database is built on."""
    if len(items) < 2:
        return ""

    coords = _pca_2d([it["vector"] for it in items if it["vector"]])
    if len(coords) != len(items):
        return ""  # some items had no vector (embedding failed) - skip rather than misalign

    groups = sorted({_group_key(it) for it in items})
    color_for = {g: _GROUP_COLORS[i % len(_GROUP_COLORS)] for i, g in enumerate(groups)}

    xs = [c[0] for c in coords]
    ys = [c[1] for c in coords]
    x_range = (max(xs) - min(xs)) or 1
    y_range = (max(ys) - min(ys)) or 1
    pad, w, h = 30, 640, 360

    def to_svg_xy(x: float, y: float) -> tuple[float, float]:
        sx = pad + (x - min(xs)) / x_range * (w - 2 * pad)
        sy = pad + (y - min(ys)) / y_range * (h - 2 * pad)
        return sx, sy

    dots = []
    for item, (x, y) in zip(items, coords):
        sx, sy = to_svg_xy(x, y)
        group = _group_key(item)
        title = escape(f"{group}: {_smart_truncate(item['text'], 100)}")
        dots.append(
            f"<circle cx='{sx:.1f}' cy='{sy:.1f}' r='5' fill='{color_for[group]}' "
            f"fill-opacity='0.85' stroke='#0e1014' stroke-width='1'><title>{title}</title></circle>"
        )

    legend = "".join(
        f"<span class='legend-item'><span class='legend-dot' style='background:{color_for[g]}'></span>{escape(g)}</span>"
        for g in groups
    )

    return f"""
    <div class="scatter-card">
      <h3>{escape(collection_title)} &mdash; embeddings mapped to 2D</h3>
      <p class="group-meta">Each dot is one embedding. Dots close together mean similar meaning - notice how chunks from the same source cluster.</p>
      <svg viewBox="0 0 {w} {h}" class="scatter-svg">{''.join(dots)}</svg>
      <div class="legend">{legend}</div>
    </div>"""


def write_html_report(document_chunks: list[dict], memory_items: list[dict]) -> None:
    doc_groups = {_group_key(i) for i in document_chunks}
    mem_groups = {_group_key(i) for i in memory_items}

    stats = "".join(
        [
            _stat_card("Documents indexed", str(len(doc_groups))),
            _stat_card("Document chunks", str(len(document_chunks))),
            _stat_card("Chat sessions remembered", str(len(mem_groups))),
            _stat_card("Memory items", str(len(memory_items))),
        ]
    )

    scatters = _render_scatter_svg("document_chunks", document_chunks) + _render_scatter_svg(
        "memory_items", memory_items
    )
    scatter_section = (
        f"""
    <section class="scatter-section">
      <h2>What the vectors actually look like</h2>
      <p class="collection-sub">Each embedding is really a point in ~3,072-dimensional space - impossible to draw directly, so this flattens it down to 2D (via PCA) just to make the clustering visible.</p>
      <div class="scatter-grid">{scatters}</div>
    </section>"""
        if scatters
        else ""
    )

    body = _render_collection_section(
        "document_chunks",
        "Pieces of every uploaded document, chunked and embedded for Chat with Document.",
        "&#128196;",
        document_chunks,
    ) + _render_collection_section(
        "memory_items",
        "Facts remembered from conversations, embedded for semantic recall.",
        "&#129504;",
        memory_items,
    )

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>BrowserMind - Vector DB Contents</title>
<style>
  :root {{
    --bg: #0e1014; --surface: #171a20; --surface-hover: #20242c; --border: #262a33;
    --text: #eceef1; --text-muted: #8b909c; --accent: #6c5ce7; --accent-2: #3fa9f5; --accent-soft: #b3a4ff;
  }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: -apple-system, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; }}
  .page {{ max-width: 1180px; margin: 0 auto; padding: 40px 28px 80px; }}

  .masthead {{ display: flex; align-items: center; gap: 14px; margin-bottom: 6px; }}
  .logo-mark {{ width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent-2)); flex-shrink: 0; box-shadow: 0 4px 18px rgba(108,92,231,0.4); }}
  .masthead h1 {{ font-size: 21px; margin: 0; }}
  .masthead p {{ margin: 2px 0 0; color: var(--text-muted); font-size: 12.5px; }}

  .stats {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 28px 0 8px; }}
  .stat-card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; }}
  .stat-value {{ font-size: 24px; font-weight: 700; background: linear-gradient(135deg, var(--accent-2), var(--accent-soft)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }}
  .stat-label {{ font-size: 11.5px; color: var(--text-muted); margin-top: 4px; }}

  .collection-header {{ display: flex; align-items: flex-start; gap: 12px; margin-top: 44px; padding-bottom: 14px; border-bottom: 1px solid var(--border); }}
  .collection-icon {{ font-size: 22px; }}
  .collection-header h2 {{ margin: 0; font-size: 17px; display: inline; }}
  .collection-sub {{ margin: 4px 0 0; color: var(--text-muted); font-size: 12.5px; }}
  .count {{ color: var(--text-muted); font-weight: 400; font-size: 12.5px; }}
  .empty {{ color: var(--text-muted); padding: 18px 0; }}

  .group-card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px 20px; margin-top: 18px; }}
  .group-card-header {{ display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }}
  .group-icon {{ width: 34px; height: 34px; border-radius: 9px; background: rgba(108,92,231,0.14); color: var(--accent-soft); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }}
  .group-card-header h3 {{ margin: 0; font-size: 14.5px; color: var(--text); }}
  .group-meta {{ margin: 2px 0 0; font-size: 11.5px; color: var(--text-muted); }}

  table {{ width: 100%; border-collapse: collapse; font-size: 12.5px; }}
  th, td {{ text-align: left; padding: 9px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }}
  th {{ color: var(--text-muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; }}
  .hint {{ text-transform: none; font-weight: 400; letter-spacing: 0; }}
  td.id {{ color: var(--accent-soft); font-family: "SFMono-Regular", Consolas, monospace; font-size: 10.5px; word-break: break-all; max-width: 140px; }}
  td.vec {{ font-family: "SFMono-Regular", Consolas, monospace; font-size: 10.5px; color: var(--accent-2); white-space: nowrap; }}
  .dims {{ color: var(--text-muted); }}

  .chip {{ display: inline-flex; align-items: center; gap: 4px; background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 3px 9px; margin: 2px 4px 2px 0; font-size: 10.5px; color: var(--text-muted); }}
  .chip-key {{ color: var(--accent-soft); font-weight: 600; }}
  .chip-muted {{ opacity: 0.6; }}

  .chunk-row {{ cursor: pointer; transition: background 0.1s ease; }}
  .chunk-row:hover {{ background: var(--surface-hover); }}
  .view-full {{ color: var(--accent-soft); font-weight: 600; white-space: nowrap; }}
  .full-row.hidden {{ display: none; }}
  .full-row td {{ background: var(--bg); border-bottom: 2px solid var(--border); }}
  .full-row pre {{ white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: 12.5px; margin: 0; max-height: 320px; overflow-y: auto; line-height: 1.5; }}

  .explainer {{ margin-top: 36px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px 22px; }}
  .explainer h2 {{ margin: 0 0 4px; font-size: 16px; }}
  .pipeline {{ display: flex; align-items: stretch; gap: 6px; margin-top: 18px; flex-wrap: wrap; }}
  .pipe-step {{ flex: 1; min-width: 140px; background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 14px 12px; text-align: center; }}
  .pipe-icon {{ font-size: 22px; margin-bottom: 6px; }}
  .pipe-title {{ font-weight: 700; font-size: 12.5px; margin-bottom: 4px; color: var(--accent-soft); }}
  .pipe-desc {{ font-size: 11px; color: var(--text-muted); line-height: 1.4; }}
  .pipe-arrow {{ display: flex; align-items: center; justify-content: center; color: var(--accent-2); font-size: 20px; font-weight: 700; padding: 0 2px; }}
  @media (max-width: 700px) {{ .pipe-arrow {{ transform: rotate(90deg); }} }}

  .scatter-section {{ margin-top: 44px; }}
  .scatter-section h2 {{ margin: 0 0 4px; font-size: 17px; }}
  .scatter-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 16px; margin-top: 16px; }}
  .scatter-card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px 18px; }}
  .scatter-card h3 {{ margin: 0 0 4px; font-size: 13.5px; }}
  .scatter-svg {{ width: 100%; height: auto; margin-top: 10px; background: var(--bg); border-radius: 10px; border: 1px solid var(--border); }}
  .scatter-svg circle {{ cursor: pointer; }}
  .legend {{ display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }}
  .legend-item {{ display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-muted); }}
  .legend-dot {{ width: 9px; height: 9px; border-radius: 50%; display: inline-block; }}

  @media (max-width: 700px) {{ .stats {{ grid-template-columns: repeat(2, 1fr); }} }}
</style></head>
<body>
  <div class="page">
    <div class="masthead">
      <div class="logo-mark"></div>
      <div>
        <h1>BrowserMind &mdash; Vector Database</h1>
        <p>Generated by scripts/view_vector_data.py &middot; reflects Chroma's contents right now &middot; click any row to expand its full text</p>
      </div>
    </div>

    <div class="stats">{stats}</div>

    {_render_pipeline_explainer()}

    {scatter_section}

    {body}
  </div>
  <script>
    function toggleFull(rowId) {{
      var row = document.getElementById(rowId);
      if (row) row.classList.toggle('hidden');
    }}
  </script>
</body></html>"""

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    document_chunks = _fetch(document_chunks_collection)
    memory_items = _fetch(memory_items_collection)

    print_summary("document_chunks", document_chunks)
    print_summary("memory_items", memory_items)

    write_html_report(document_chunks, memory_items)
    print(f"\nFull browsable report written to: {REPORT_PATH}")
    open_report(REPORT_PATH)
