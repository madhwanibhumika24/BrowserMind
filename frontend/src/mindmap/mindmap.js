import { BASE_URL } from "../utils/api.js";
import { applyStoredTheme } from "../utils/theme.js";

applyStoredTheme();

const topicInput = document.getElementById("topic-input");
const generateBtn = document.getElementById("generate-btn");
const generateError = document.getElementById("generate-error");
const inputCard = document.getElementById("input-card");
const resultCard = document.getElementById("result-card");
const backBtn = document.getElementById("back-btn");
const mindmapTree = document.getElementById("mindmap-tree");

async function parseErrorResponse(res) {
  try {
    const data = await res.json();
    return data.detail || `Request failed: ${res.status}`;
  } catch (err) {
    return `Request failed: ${res.status}`;
  }
}

function resetGenerateBtn() {
  generateBtn.disabled = false;
  generateBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.4L12 2z"/></svg>
    Generate mindmap`;
}

function renderNode(node, depth) {
  const li = document.createElement("li");
  li.className = `mm-node depth-${depth}`;

  const label = document.createElement("span");
  label.className = "mm-label";
  label.textContent = node.title;
  li.appendChild(label);

  if (node.children && node.children.length) {
    const ul = document.createElement("ul");
    ul.className = "mm-children";
    node.children.forEach((child) => ul.appendChild(renderNode(child, depth + 1)));
    li.appendChild(ul);
  }

  return li;
}

function renderTree(root) {
  mindmapTree.innerHTML = "";

  const rootEl = document.createElement("div");
  rootEl.className = "mm-root";
  rootEl.textContent = root.title;
  mindmapTree.appendChild(rootEl);

  if (root.children && root.children.length) {
    const ul = document.createElement("ul");
    ul.className = "mm-children";
    root.children.forEach((child) => ul.appendChild(renderNode(child, 1)));
    mindmapTree.appendChild(ul);
  }
}

generateBtn.addEventListener("click", async () => {
  generateError.classList.add("hidden");

  const topic = topicInput.value.trim();
  if (!topic) {
    generateError.textContent = "Enter a topic first.";
    generateError.classList.remove("hidden");
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";

  try {
    const res = await fetch(`${BASE_URL}/mindmap/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    if (!res.ok) throw new Error(await parseErrorResponse(res));

    const data = await res.json();
    renderTree(data.root);
    inputCard.classList.add("hidden");
    resultCard.classList.remove("hidden");
  } catch (err) {
    generateError.textContent = err.message || "Could not generate a mindmap - try again.";
    generateError.classList.remove("hidden");
  } finally {
    generateBtn.disabled = false;
    resetGenerateBtn();
  }
});

topicInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") generateBtn.click();
});

backBtn.addEventListener("click", () => {
  resultCard.classList.add("hidden");
  inputCard.classList.remove("hidden");
  topicInput.value = "";
  topicInput.focus();
});
