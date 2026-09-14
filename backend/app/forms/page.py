"""Renders the public, no-extension-needed HTML page for viewing/answering
a shared form. Served same-origin from the backend (GET /forms/{id}/view),
so its own fetches to the JSON API never hit CORS at all.
"""

PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>BrowserMind Form</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;800&display=swap" rel="stylesheet" />
<style>
  :root {{
    --bg: #0b0c10;
    --surface: #171a20;
    --surface-2: #20242c;
    --border: #262a33;
    --text: #eceef1;
    --text-muted: #8b909c;
    --accent: #6c5ce7;
    --accent-2: #3fa9f5;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
  }}
  h1, h2 {{ font-family: "Space Grotesk", -apple-system, sans-serif; }}
  #wrap {{ width: 100%; max-width: 560px; padding: 56px 24px; }}
  .brand {{ display: flex; align-items: center; gap: 10px; margin-bottom: 32px; color: var(--text-muted); font-size: 13px; font-weight: 600; }}
  .brand .dot {{ width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }}
  #card {{
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 30px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.35);
  }}
  h1 {{ font-size: 24px; margin: 0 0 8px; }}
  .form-desc {{ color: var(--text-muted); font-size: 14px; margin: 0 0 28px; line-height: 1.5; }}
  .q-block {{ margin-bottom: 24px; }}
  .q-title {{ font-weight: 700; font-size: 15px; margin: 0 0 12px; }}
  .q-options {{ display: flex; flex-direction: column; gap: 8px; }}
  label.opt {{
    display: flex; align-items: center; gap: 10px;
    background: var(--bg); border: 1px solid var(--border); border-radius: 10px;
    padding: 11px 14px; font-size: 14px; cursor: pointer;
  }}
  label.opt:hover {{ background: var(--surface-2); }}
  label.opt.opt-correct {{ border-color: #3ecf8e; background: rgba(62,207,142,0.12); }}
  label.opt.opt-wrong {{ border-color: #e05c5c; background: rgba(224,92,92,0.12); }}
  #submit-btn {{
    width: 100%; margin-top: 8px;
    background: linear-gradient(90deg, var(--accent), var(--accent-2));
    border: none; border-radius: 10px; color: #fff;
    padding: 13px 18px; font-size: 14.5px; font-weight: 600; cursor: pointer;
  }}
  #submit-btn:disabled {{ opacity: 0.6; cursor: default; }}
  #status {{ text-align: center; color: var(--text-muted); font-size: 14px; padding: 20px 0; }}
  #done {{ text-align: center; }}
  #done h2 {{ margin: 0 0 8px; }}
  #done p {{ color: var(--text-muted); font-size: 14px; margin: 0 0 24px; }}
  .score-ring {{
    width: 88px; height: 88px; margin: 0 auto 18px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 800; color: #fff;
    background: conic-gradient(var(--accent) calc(var(--pct) * 1%), var(--border) 0);
  }}
  .score-ring span {{
    width: 70px; height: 70px; border-radius: 50%; background: var(--surface);
    display: flex; align-items: center; justify-content: center;
  }}
  .review-list {{ text-align: left; margin-top: 24px; }}
  .review-item {{
    border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px;
    margin-bottom: 10px; font-size: 13px;
  }}
  .review-item .rq {{ font-weight: 700; margin: 0 0 6px; }}
  .review-item .ra {{ color: var(--text-muted); margin: 0; }}
  .review-item.correct {{ border-color: rgba(62,207,142,0.4); }}
  .review-item.wrong {{ border-color: rgba(224,92,92,0.4); }}
  .review-item .tag {{ font-size: 11px; font-weight: 700; text-transform: uppercase; }}
  .review-item.correct .tag {{ color: #3ecf8e; }}
  .review-item.wrong .tag {{ color: #e05c5c; }}
</style>
</head>
<body>
<div id="wrap">
  <div class="brand"><span class="dot"></span>BrowserMind Forms</div>
  <div id="card">
    <div id="status">Loading form...</div>
  </div>
</div>
<script>
  const FORM_ID = "{form_id}";
  let currentForm = null;

  async function loadForm() {{
    const card = document.getElementById("card");
    try {{
      const res = await fetch(`/forms/${{FORM_ID}}`);
      if (!res.ok) throw new Error("not found");
      currentForm = await res.json();
      renderForm(currentForm);
    }} catch (err) {{
      card.innerHTML = '<div id="status">This form link is no longer available.</div>';
    }}
  }}

  function renderForm(form) {{
    const card = document.getElementById("card");
    const questionsHtml = form.questions.map((q, qi) => `
      <div class="q-block">
        <p class="q-title">${{qi + 1}}. ${{escapeHtml(q.question)}}</p>
        <div class="q-options">
          ${{q.options.map((opt, oi) => `
            <label class="opt" id="opt-${{qi}}-${{oi}}">
              <input type="radio" name="q${{qi}}" value="${{escapeHtml(opt)}}" />
              ${{escapeHtml(opt)}}
            </label>`).join("")}}
        </div>
      </div>`).join("");

    card.innerHTML = `
      <h1>${{escapeHtml(form.title)}}</h1>
      <p class="form-desc">${{escapeHtml(form.description)}}</p>
      <form id="form-el">
        ${{questionsHtml}}
        <button type="submit" id="submit-btn">Submit response</button>
      </form>`;

    document.getElementById("form-el").addEventListener("submit", (e) => {{
      e.preventDefault();
      submitForm(form.questions.length);
    }});
  }}

  async function submitForm(questionCount) {{
    const btn = document.getElementById("submit-btn");
    const answers = [];
    for (let i = 0; i < questionCount; i++) {{
      const checked = document.querySelector(`input[name="q${{i}}"]:checked`);
      if (!checked) {{
        alert("Please answer every question before submitting.");
        return;
      }}
      answers.push(checked.value);
    }}

    btn.disabled = true;
    btn.textContent = "Submitting...";

    try {{
      const res = await fetch(`/forms/${{FORM_ID}}/responses`, {{
        method: "POST",
        headers: {{ "Content-Type": "application/json" }},
        body: JSON.stringify({{ answers }}),
      }});
      if (!res.ok) throw new Error("submit failed");
      const result = await res.json();
      showDone(result, answers);
    }} catch (err) {{
      btn.disabled = false;
      btn.textContent = "Submit response";
      alert("Could not submit right now - please try again.");
    }}
  }}

  function showDone(result, answers) {{
    const card = document.getElementById("card");

    // Survey (no correct answer) - just a plain thank-you.
    if (result.score === null || result.score === undefined) {{
      card.innerHTML = `
        <div id="done">
          <h2>Thanks - response recorded!</h2>
          <p>You can close this tab now.</p>
        </div>`;
      return;
    }}

    // Quiz - show score + per-question review now that it's safe to
    // reveal the correct answers (this attempt is already submitted).
    const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
    const reviewHtml = currentForm.questions.map((q, qi) => {{
      const given = answers[qi];
      const correct = result.correct_answers[qi];
      const isRight = given === correct;
      return `
        <div class="review-item ${{isRight ? 'correct' : 'wrong'}}">
          <p class="rq">${{qi + 1}}. ${{escapeHtml(q.question)}}</p>
          <p class="ra"><span class="tag">${{isRight ? 'Correct' : 'Wrong'}}</span> - your answer: ${{escapeHtml(given)}}</p>
          ${{isRight ? "" : `<p class="ra">Correct answer: ${{escapeHtml(correct)}}</p>`}}
        </div>`;
    }}).join("");

    card.innerHTML = `
      <div id="done">
        <div class="score-ring" style="--pct:${{pct}}"><span>${{pct}}%</span></div>
        <h2>You scored ${{result.score}} / ${{result.total}}</h2>
        <p>Here's how you did on each question.</p>
      </div>
      <div class="review-list">${{reviewHtml}}</div>`;
  }}

  function escapeHtml(text) {{
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }}

  loadForm();
</script>
</body>
</html>
"""


def render_form_page(form_id: str) -> str:
    return PAGE_TEMPLATE.format(form_id=form_id)
