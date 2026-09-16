import {
  sendChatMessage,
  summarizeTabs,
  generateSummary,
  getMemory,
  deleteMemory,
  analyzeJobFit,
} from "../utils/api.js";
import {
  signInWithGoogle,
  signOut,
  getStoredAuth,
  signUp,
  logIn,
  requestPasswordReset,
  resetPassword,
} from "../utils/auth.js";
import { formatReply } from "../utils/markdown.js";

// sessionId and historyMessages can both get replaced once we restore a
// saved chat for this site (see restoreHistory below), so they're `let`.
let sessionId = crypto.randomUUID();
let historyMessages = [];
let chatKey = null; // set once we know which site's chat this is

const chatLog = document.getElementById("chat-log");
const input = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const summarizeBtn = document.getElementById("summarize-btn");
const quizBtn = document.getElementById("quiz-btn");
const homeBtn = document.getElementById("home-btn");
const memoryBtn = document.getElementById("memory-btn");
const memoryView = document.getElementById("memory-view");
const memoryBackBtn = document.getElementById("memory-back-btn");
const memoryList = document.getElementById("memory-list");
const memoryRefreshBtn = document.getElementById("memory-refresh-btn");

const jobfitView = document.getElementById("jobfit-view");
const jobfitBackBtn = document.getElementById("jobfit-back-btn");
const jobfitRefreshBtn = document.getElementById("jobfit-refresh-btn");
const jobfitJobTitleEl = document.getElementById("jobfit-job-title");
const jobfitJobUrlEl = document.getElementById("jobfit-job-url");
const jobfitResumeUploadSection = document.getElementById("jobfit-resume-upload-section");
const jobfitResumeCachedSection = document.getElementById("jobfit-resume-cached-section");
const jobfitResumeCachedNote = document.getElementById("jobfit-resume-cached-note");
const jobfitChangeResumeBtn = document.getElementById("jobfit-change-resume-btn");
const jobfitResumeFileInput = document.getElementById("jobfit-resume-file-input");
const jobfitResumeDropzoneText = document.getElementById("jobfit-resume-dropzone-text");
const jobfitResumeDropzone = document.getElementById("jobfit-resume-dropzone");
const jobfitSelectedFileEl = document.getElementById("jobfit-selected-file");
const jobfitAnalyzeBtn = document.getElementById("jobfit-analyze-btn");
const jobfitErrorEl = document.getElementById("jobfit-error");
const jobfitTabButtons = document.querySelectorAll(".jobfit-tab");
const jobfitScoreRowEl = document.getElementById("jobfit-score-row");
const jobfitAboutPlaceholderEl = document.getElementById("jobfit-about-placeholder");
const jobfitHistoryPlaceholderEl = document.getElementById("jobfit-history-placeholder");
const jobfitSkillsPlaceholderEl = document.getElementById("jobfit-skills-placeholder");
const jobfitSkillsContentEl = document.getElementById("jobfit-skills-content");
const jobfitRoleTagsEl = document.getElementById("jobfit-role-tags");
const jobfitRespWrap = document.getElementById("jobfit-resp-wrap");
const jobfitRespListEl = document.getElementById("jobfit-responsibilities");
const jobfitCompanyRowEl = document.getElementById("jobfit-company-row");
const jobfitCompanyNameEl = document.getElementById("jobfit-company-name");
const jobfitCompanyIndustryEl = document.getElementById("jobfit-company-industry");
const jobfitCompanyOverviewEl = document.getElementById("jobfit-company-overview");
const jobfitCompanyFactsEl = document.getElementById("jobfit-company-facts");
const jobfitCompanyEmptyEl = document.getElementById("jobfit-company-empty");
const jobfitHistoryEmptyEl = document.getElementById("jobfit-history-empty");
const jobfitScoreEl = document.getElementById("jobfit-score");
const jobfitSummaryEl = document.getElementById("jobfit-summary");
const jobfitMatchedSkillsEl = document.getElementById("jobfit-matched-skills");
const jobfitMissingSkillsEl = document.getElementById("jobfit-missing-skills");

const themeToggleBtn = document.getElementById("theme-toggle-btn");
const clearChatBtn = document.getElementById("clear-chat-btn");
const closeBtn = document.getElementById("close-btn");
const expandBtn = document.getElementById("expand-btn");
const logoIcon = document.querySelector(".logo-icon");
const homeView = document.getElementById("home-view");
const homeSummarizeBtn = document.getElementById("home-summarize-btn");
const homeTabsBtn = document.getElementById("home-tabs-btn");
const homeQuizBtn = document.getElementById("home-quiz-btn");
const homeMemoryBtn = document.getElementById("home-memory-btn");
const homeFormsBtn = document.getElementById("home-forms-btn");
const homeChatDocBtn = document.getElementById("home-chatdoc-btn");
const homePdfToolsBtn = document.getElementById("home-pdftools-btn");
const homeTextToolsBtn = document.getElementById("home-texttools-btn");
const homeMindmapBtn = document.getElementById("home-mindmap-btn");
const homeJobFitBtn = document.getElementById("home-jobfit-btn");
const formsBtn = document.getElementById("forms-btn");
const homeNewChatBtn = document.getElementById("home-newchat-btn");
const homeGreetingName = document.getElementById("home-greeting-name");
const authGate = document.getElementById("auth-gate");
const googleLoginBtn = document.getElementById("google-login-btn");
const authModeTabs = document.querySelectorAll(".auth-mode-tab");
const authLoginForm = document.getElementById("auth-login-form");
const authLoginEmail = document.getElementById("auth-login-email");
const authLoginPassword = document.getElementById("auth-login-password");
const authLoginSubmit = document.getElementById("auth-login-submit");
const authForgotLink = document.getElementById("auth-forgot-link");
const authSignupForm = document.getElementById("auth-signup-form");
const authSignupName = document.getElementById("auth-signup-name");
const authSignupEmail = document.getElementById("auth-signup-email");
const authSignupPassword = document.getElementById("auth-signup-password");
const authSignupSubmit = document.getElementById("auth-signup-submit");
const authForgotForm = document.getElementById("auth-forgot-form");
const authForgotEmail = document.getElementById("auth-forgot-email");
const authForgotSubmit = document.getElementById("auth-forgot-submit");
const authResetForm = document.getElementById("auth-reset-form");
const authResetCode = document.getElementById("auth-reset-code");
const authResetPassword = document.getElementById("auth-reset-password");
const authResetSubmit = document.getElementById("auth-reset-submit");
const authBackLinks = document.querySelectorAll(".auth-back-link");
const authDivider = document.getElementById("auth-divider");
const authTitle = document.getElementById("auth-title");
const authSubheading = document.getElementById("auth-subheading");
const authSuccessEl = document.getElementById("auth-success");
const accountBtn = document.getElementById("account-btn");
const accountPanel = document.getElementById("account-panel");
const accountPanelAvatar = document.getElementById("account-panel-avatar");
const accountName = document.getElementById("account-name");
const accountEmail = document.getElementById("account-email");
const signOutBtn = document.getElementById("sign-out-btn");
const moreToolsBtn = document.getElementById("more-tools-btn");
const moreToolsPanel = document.getElementById("more-tools-panel");
const morePdfToolsBtn = document.getElementById("more-pdf-tools-btn");
const moreChatDocBtn = document.getElementById("more-chat-doc-btn");
const moreTextToolsBtn = document.getElementById("more-text-tools-btn");
const moreMindmapBtn = document.getElementById("more-mindmap-btn");
const moreJobFitBtn = document.getElementById("more-jobfit-btn");

// formatReply (markdown -> HTML for assistant bubbles) lives in
// ../utils/markdown.js now, shared with document-chat.js.

// Just draws a message bubble - does not save it. Used both for new
// messages and for redrawing messages restored from storage.
function renderMessage(text, who) {
  const el = document.createElement("div");
  el.className = `msg msg-${who}`;
  if (who === "assistant") {
    el.innerHTML = formatReply(text);
  } else {
    el.textContent = text;
  }
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// Home, the chat log, and Memory are three mutually exclusive full views in
// the same space - showing one always hides the other two, so you never
// end up looking at two screens stacked on top of each other at once
// (which is what the old toggle-a-panel-open-on-top-of-whatever's-already-
// showing approach used to do for Memory).
const VIEWS = { home: homeView, chat: chatLog, memory: memoryView, jobfit: jobfitView };

function showView(name) {
  for (const [key, el] of Object.entries(VIEWS)) {
    el.classList.toggle("hidden", key !== name);
  }
  accountPanel.classList.add("hidden");
}

// Swaps the "What can I do for you?" home screen out for the chat log -
// called the moment there's actually a conversation to show.
function showChatLog() {
  showView("chat");
}

// Swaps back to the home screen - used when starting a fresh chat.
function showHomeView() {
  showView("home");
}

// Same swap, but doesn't touch the conversation - just navigation back to
// the home screen, for when you want to leave without starting over.
function goHome() {
  showView("home");
}

// Switches to the Memory view and kicks off a fresh load every time - it's
// no longer a toggle-open/toggle-closed panel, so "open" always means a
// clean, up-to-date list rather than whatever was last loaded.
function openMemoryView() {
  showView("memory");
  loadMemory();
}

// ---- JobFit ----
// Lives directly in the sidebar (unlike PDF Tools/Forms/etc., which open
// their own tab) so it can read the active tab's content immediately, with
// no separate tab or chrome.storage hand-off needed. Re-checking the page
// is still a manual click (the refresh button / re-opening the view) - not
// automatic on every navigation, to avoid firing an analysis nobody asked
// for every time the user browses to a different listing.

const JOBFIT_RESUME_CACHE_KEY = "browsermindJobFitResume"; // { text, filename }

let jobfitJobData = null; // { url, title, content }
let jobfitCachedResume = null; // { text, filename }
let jobfitSelectedResumeFile = null;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// "about" is the default active tab - matches the non-hidden panel/button
// already set in the markup, so the very first render (before any JS runs)
// looks correct too.
const JOBFIT_TABS = ["history", "about", "skills"];

function setJobfitActiveTab(tabKey) {
  for (const key of JOBFIT_TABS) {
    document.getElementById(`jobfit-tab-${key}`).classList.toggle("hidden", key !== tabKey);
  }
  jobfitTabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabKey);
  });
}

jobfitTabButtons.forEach((btn) => {
  btn.addEventListener("click", () => setJobfitActiveTab(btn.dataset.tab));
});

// Tabs stay visible and clickable even with no analysis yet (see the
// "buttons here" request) - this just puts every panel back to its
// "run analysis" placeholder state and hides the score, rather than
// hiding the tabs themselves.
function resetJobfitOutput() {
  jobfitErrorEl.classList.add("hidden");
  jobfitScoreRowEl.classList.add("hidden");

  // Role tags/responsibilities live in the job-info card up top, not a tab
  // - they're about this specific posting, not the company.
  jobfitRoleTagsEl.innerHTML = "";
  jobfitRespWrap.classList.add("hidden");

  jobfitHistoryPlaceholderEl.classList.remove("hidden");
  jobfitCompanyFactsEl.classList.add("hidden");
  jobfitHistoryEmptyEl.classList.add("hidden");

  jobfitAboutPlaceholderEl.classList.remove("hidden");
  jobfitCompanyRowEl.classList.add("hidden");
  jobfitCompanyOverviewEl.classList.add("hidden");
  jobfitCompanyEmptyEl.classList.add("hidden");

  jobfitSkillsPlaceholderEl.classList.remove("hidden");
  jobfitSkillsContentEl.classList.add("hidden");
}

async function loadJobfitPageData() {
  const activeTab = await getActiveTab();
  const content = await getJobPageText(activeTab.id);
  jobfitJobData = { url: activeTab.url, title: activeTab.title, content };

  if (content) {
    jobfitJobTitleEl.textContent = activeTab.title || "Untitled page";
    jobfitJobUrlEl.textContent = activeTab.url || "";
    jobfitAnalyzeBtn.disabled = false;
  } else {
    jobfitJobTitleEl.textContent = "No page content detected";
    jobfitJobUrlEl.textContent = "Try reloading the page, then hit the refresh button above.";
    jobfitAnalyzeBtn.disabled = true;
  }
}

function renderJobfitResumeSection() {
  if (jobfitCachedResume) {
    jobfitResumeUploadSection.classList.add("hidden");
    jobfitResumeCachedSection.classList.remove("hidden");
    jobfitResumeCachedNote.textContent = `Using "${jobfitCachedResume.filename || "your last uploaded resume"}".`;
  } else {
    jobfitResumeUploadSection.classList.remove("hidden");
    jobfitResumeCachedSection.classList.add("hidden");
  }
}

async function loadJobfitCachedResume() {
  const stored = await chrome.storage.local.get(JOBFIT_RESUME_CACHE_KEY);
  jobfitCachedResume = stored[JOBFIT_RESUME_CACHE_KEY] || null;
  renderJobfitResumeSection();
}

// Once a file's picked, swap the dropzone out for a compact "selected
// file" chip instead of cramming the filename into the dropzone's own
// label text - a full resume filename plus the format hint squeezed into
// one small box read as cramped and hard to parse at a glance.
function renderJobfitSelectedFile() {
  if (jobfitSelectedResumeFile) {
    jobfitResumeDropzone.classList.add("hidden");
    jobfitSelectedFileEl.classList.remove("hidden");
    jobfitSelectedFileEl.innerHTML = `
      <span class="jobfit-file-chip-name">${escapeHtml(jobfitSelectedResumeFile.name)}</span>
      <button type="button" id="jobfit-remove-file-btn" title="Remove">✕</button>`;
    document.getElementById("jobfit-remove-file-btn").addEventListener("click", () => {
      jobfitSelectedResumeFile = null;
      jobfitResumeFileInput.value = "";
      renderJobfitSelectedFile();
    });
  } else {
    jobfitResumeDropzone.classList.remove("hidden");
    jobfitSelectedFileEl.classList.add("hidden");
    jobfitSelectedFileEl.innerHTML = "";
    jobfitResumeDropzoneText.textContent = "Click to upload";
  }
}

jobfitResumeFileInput.addEventListener("change", () => {
  jobfitSelectedResumeFile = jobfitResumeFileInput.files[0] || null;
  renderJobfitSelectedFile();
});

jobfitChangeResumeBtn.addEventListener("click", async () => {
  jobfitCachedResume = null;
  jobfitSelectedResumeFile = null;
  jobfitResumeFileInput.value = "";
  renderJobfitSelectedFile();
  await chrome.storage.local.remove(JOBFIT_RESUME_CACHE_KEY);
  renderJobfitResumeSection();
});

function jobfitScoreClass(score) {
  if (score >= 80) return "high";
  if (score >= 50) return "mid";
  return "low";
}

function renderJobfitSkillChips(container, skills, variant) {
  if (!skills.length) {
    container.innerHTML = `<p class="jobfit-skill-empty">${
      variant === "missing" ? "None - nice work!" : "None found."
    }</p>`;
    return;
  }
  container.innerHTML = skills.map((s) => `<span class="jobfit-chip ${variant}">${escapeHtml(s)}</span>`).join("");
}

function setJobfitOptionalText(el, text) {
  if (text && text.trim()) {
    el.textContent = text;
    el.classList.remove("hidden");
  } else {
    el.classList.add("hidden");
  }
}

// Role tags (employment type, location) + responsibilities sit in the
// job-info card at the top, not in a tab - they describe this specific
// posting rather than the company, so they stay visible alongside the
// detected title/URL instead of competing with the company tabs below.
function renderJobfitRoleSnapshot(result) {
  const role = result.role || {};

  const tags = [role.employment_type, role.location].filter(Boolean);
  jobfitRoleTagsEl.innerHTML = tags.map((t) => `<span class="jobfit-chip">${escapeHtml(t)}</span>`).join("");

  const responsibilities = role.responsibilities || [];
  if (responsibilities.length) {
    jobfitRespListEl.innerHTML = responsibilities.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
    jobfitRespWrap.classList.remove("hidden");
  } else {
    jobfitRespWrap.classList.add("hidden");
  }
}

// "About" = purely the company/startup itself - what it does, its
// industry, a short overview. Deliberately excludes role details (see
// renderJobfitRoleSnapshot above) so this tab reads as "about the
// company", not a mix of company + job posting facts.
function renderJobfitAbout(result) {
  const company = result.company || {};

  jobfitAboutPlaceholderEl.classList.add("hidden");
  jobfitCompanyRowEl.classList.remove("hidden");

  const hasCompanyBasics = company.name || company.overview || company.industry;
  jobfitCompanyNameEl.textContent = company.name || "Company not identified";
  setJobfitOptionalText(jobfitCompanyIndustryEl, company.industry);
  setJobfitOptionalText(jobfitCompanyOverviewEl, company.overview);
  jobfitCompanyEmptyEl.classList.toggle("hidden", Boolean(hasCompanyBasics));
}

// "History" = whatever the model actually recognizes about the company's
// background, focus areas, or recent news - kept separate from "About" so
// a quick glance at the role doesn't get buried under a paragraph of
// company trivia, and so an empty history doesn't read as "no info at all".
function renderJobfitHistory(result) {
  const company = result.company || {};
  jobfitHistoryPlaceholderEl.classList.add("hidden");
  setJobfitOptionalText(jobfitCompanyFactsEl, company.notable_facts);
  jobfitHistoryEmptyEl.classList.toggle("hidden", Boolean(company.notable_facts && company.notable_facts.trim()));
}

function showJobfitResult(result) {
  // Leaves whichever tab the user already has open alone (they may have
  // been browsing History/Skills while the analysis was running) - just
  // fills in real content under all three instead of yanking them back
  // to a default tab.
  renderJobfitRoleSnapshot(result);
  renderJobfitAbout(result);
  renderJobfitHistory(result);

  jobfitScoreRowEl.classList.remove("hidden");
  jobfitScoreEl.textContent = `${result.fit_score}%`;
  jobfitScoreEl.className = `jobfit-score ${jobfitScoreClass(result.fit_score)}`;
  jobfitSummaryEl.innerHTML = formatReply(result.summary);

  jobfitSkillsPlaceholderEl.classList.add("hidden");
  jobfitSkillsContentEl.classList.remove("hidden");
  renderJobfitSkillChips(jobfitMatchedSkillsEl, result.matched_skills, "matched");
  renderJobfitSkillChips(jobfitMissingSkillsEl, result.missing_skills, "missing");
}

function resetJobfitAnalyzeBtn() {
  jobfitAnalyzeBtn.disabled = false;
  jobfitAnalyzeBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.4L12 2z"/></svg>
    Analyze Fit`;
}

jobfitAnalyzeBtn.addEventListener("click", async () => {
  jobfitErrorEl.classList.add("hidden");

  if (!jobfitJobData?.content) {
    jobfitErrorEl.textContent = "No job page detected - reload the page and try again.";
    jobfitErrorEl.classList.remove("hidden");
    return;
  }
  if (!jobfitCachedResume && !jobfitSelectedResumeFile) {
    jobfitErrorEl.textContent = "Upload your resume first.";
    jobfitErrorEl.classList.remove("hidden");
    return;
  }

  jobfitAnalyzeBtn.disabled = true;
  jobfitAnalyzeBtn.textContent = "Analyzing...";

  try {
    const result = await analyzeJobFit({
      jobTitle: jobfitJobData.title,
      jobText: jobfitJobData.content,
      resumeFile: jobfitSelectedResumeFile,
      resumeText: !jobfitSelectedResumeFile && jobfitCachedResume ? jobfitCachedResume.text : "",
    });

    if (result.resume_text) {
      jobfitCachedResume = {
        text: result.resume_text,
        filename: jobfitSelectedResumeFile?.name || jobfitCachedResume?.filename || "your resume",
      };
      await chrome.storage.local.set({ [JOBFIT_RESUME_CACHE_KEY]: jobfitCachedResume });
      jobfitSelectedResumeFile = null;
      jobfitResumeFileInput.value = "";
      renderJobfitSelectedFile();
      renderJobfitResumeSection();
    }

    showJobfitResult(result);
  } catch (err) {
    jobfitErrorEl.textContent = err.message || "Could not analyze this job - try again.";
    jobfitErrorEl.classList.remove("hidden");
  } finally {
    resetJobfitAnalyzeBtn();
  }
});

async function showJobFitView() {
  showView("jobfit");
  resetJobfitOutput();
  // No-op if called from the home tile (panel's already hidden there) -
  // only actually does something when opened via the More Tools menu.
  moreToolsPanel.classList.add("hidden");
  moreToolsBtn.classList.remove("active");
  renderJobfitSelectedFile();
  await Promise.all([loadJobfitPageData(), loadJobfitCachedResume()]);
}

jobfitBackBtn.addEventListener("click", goHome);
jobfitRefreshBtn.addEventListener("click", () => {
  resetJobfitOutput();
  loadJobfitPageData();
});

// Draws a new message AND saves it, so the conversation survives closing
// and reopening the sidebar on this site.
function appendMessage(text, who) {
  renderMessage(text, who);
  historyMessages.push({ text, who });
  saveHistory();
  if (who === "assistant") pulseLogo();
}

// Shows a message WITHOUT saving it to this site's persisted history. Used
// for one-off action feedback (e.g. "Could not summarize tabs right now")
// that isn't part of an actual back-and-forth - if we saved these, a single
// failed click (backend briefly down, etc.) would get stuck as the first
// thing you see every time you reopen the sidebar on that site, forever,
// even after the backend is back up. Real conversation turns (typed
// questions and their replies) still persist via appendMessage above.
function appendTransient(text, who) {
  renderMessage(text, who);
  if (who === "assistant") pulseLogo();
}

function pulseLogo() {
  // Restart the animation even if it's already mid-pulse from a fast
  // follow-up reply: remove the class, force a reflow, then re-add it.
  logoIcon.classList.remove("logo-pulse");
  void logoIcon.offsetWidth;
  logoIcon.classList.add("logo-pulse");
}

function saveHistory() {
  if (!chatKey) return;
  // Keep only the most recent messages so storage doesn't grow forever.
  historyMessages = historyMessages.slice(-60);
  chrome.storage.local.set({ [chatKey]: { sessionId, messages: historyMessages } });
}

async function getSiteChatKey() {
  const activeTab = await getActiveTab();
  let hostname = "default";
  try {
    hostname = new URL(activeTab.url).hostname || "default";
  } catch (err) {
    hostname = "default";
  }
  return `browsermindChat_${hostname}`;
}

async function restoreHistory() {
  chatKey = await getSiteChatKey();
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get(chatKey, (result) => resolve(result[chatKey]));
  });

  if (stored && Array.isArray(stored.messages) && stored.messages.length) {
    sessionId = stored.sessionId || sessionId;
    historyMessages = stored.messages;
    historyMessages.forEach(({ text, who }) => renderMessage(text, who));
    showChatLog();
  }
}

function showLoading() {
  const el = document.createElement("div");
  el.className = "msg msg-assistant msg-loading";
  el.id = "loading-indicator";
  el.innerHTML = `
    <span class="thinking-dots">
      <span></span><span></span><span></span>
    </span>
  `;
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function hideLoading() {
  document.getElementById("loading-indicator")?.remove();
}

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => resolve(tab));
  });
}

function getPageExcerpt(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_EXCERPT" }, (result) => {
      resolve(chrome.runtime.lastError ? "" : result);
    });
  });
}

// Much larger than getPageExcerpt above - JobFit needs the full job
// requirements list, not just a short chat-context snippet.
function getJobPageText(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "GET_JOB_PAGE_TEXT" }, (result) => {
      resolve(chrome.runtime.lastError ? "" : result);
    });
  });
}

function renderSuggestions(questions) {
  const el = document.createElement("div");
  el.className = "suggestions";
  questions.forEach((question) => {
    const pill = document.createElement("button");
    pill.className = "suggestion-pill";
    pill.textContent = question;
    pill.addEventListener("click", () => sendChat(question));
    el.appendChild(pill);
  });
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function sendChat(message, displayText) {
  showChatLog();
  appendMessage(displayText || message, "user");
  showLoading();

  const activeTab = await getActiveTab();
  const excerpt = await getPageExcerpt(activeTab.id);

  try {
    const { reply } = await sendChatMessage({
      sessionId,
      message,
      activeTab: {
        tab_id: activeTab.id,
        url: activeTab.url,
        title: activeTab.title,
        content_excerpt: excerpt,
      },
      openTabs: [],
    });
    hideLoading();
    appendMessage(reply, "assistant");
  } catch (err) {
    hideLoading();
    appendMessage("BrowserMind backend isn't reachable yet.", "assistant");
  }
}

async function handleSend() {
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
  await sendChat(message);
}

async function summarizePage() {
  showChatLog();
  showLoading();
  const activeTab = await getActiveTab();
  const excerpt = await getPageExcerpt(activeTab.id);

  try {
    const { summary, questions } = await generateSummary({
      tab_id: activeTab.id,
      url: activeTab.url,
      title: activeTab.title,
      content_excerpt: excerpt,
    });
    hideLoading();
    appendMessage(summary, "assistant");
    renderSuggestions(questions);
  } catch (err) {
    hideLoading();
    appendTransient("Ask me anything about this page.", "assistant");
  }
}

const THEME_KEY = "browsermindTheme";
const SUN_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
const MOON_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

// Shows the icon for the mode you'd SWITCH TO, not the current mode -
// that's the usual convention for a theme toggle button.
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggleBtn.innerHTML = theme === "dark" ? SUN_ICON : MOON_ICON;
  themeToggleBtn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
}

async function loadTheme() {
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get(THEME_KEY, (result) => resolve(result[THEME_KEY]));
  });
  applyTheme(stored || "dark");
}

themeToggleBtn.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  chrome.storage.local.set({ [THEME_KEY]: next });
});

const authErrorEl = document.getElementById("auth-error");

function showSignedIn(auth) {
  authGate.classList.add("hidden");
  document.body.classList.remove("signed-out");
  accountName.textContent = auth.name || "Signed in";
  accountEmail.textContent = auth.email || "";

  const initial = (auth.name || auth.email || "?").trim().charAt(0);
  accountBtn.textContent = initial;
  accountPanelAvatar.textContent = initial;

  const firstName = (auth.name || "").split(" ")[0];
  homeGreetingName.textContent = firstName ? `, ${firstName}` : "";
}

async function checkAuth() {
  const auth = await getStoredAuth();
  if (auth?.token) {
    showSignedIn(auth);
  } else {
    showAuthView("login");
    authGate.classList.remove("hidden");
    document.body.classList.add("signed-out");
  }
}

// ---- Auth gate: Log In / Sign Up / Forgot Password / Reset Password ----
// Four forms sharing one card, only one visible at a time - same
// show-one-hide-the-rest pattern as the JobFit tabs and the main app views.
const AUTH_FORMS = {
  login: authLoginForm,
  signup: authSignupForm,
  forgot: authForgotForm,
  reset: authResetForm,
};
const AUTH_COPY = {
  login: { title: "Welcome to BrowserMind", subheading: "Log in or create an account to get started." },
  signup: { title: "Create your account", subheading: "It only takes a moment to get started." },
  forgot: { title: "Reset your password", subheading: "We'll email you a code to get back in." },
  reset: { title: "Check your email", subheading: "Enter the code and choose a new password." },
};

// The reset form only asks for a code + new password (no email field) -
// this remembers which email the code was sent to, set when the forgot
// step succeeds.
let authResetEmail = "";

function showAuthView(name) {
  authErrorEl.classList.add("hidden");
  authSuccessEl.classList.add("hidden");

  for (const [key, form] of Object.entries(AUTH_FORMS)) {
    form.classList.toggle("hidden", key !== name);
  }
  authModeTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === name));

  // Google Sign-In has no place in the forgot/reset flow - a Google
  // account doesn't have a BrowserMind password to reset.
  const showGoogleOption = name === "login" || name === "signup";
  authDivider.classList.toggle("hidden", !showGoogleOption);
  googleLoginBtn.classList.toggle("hidden", !showGoogleOption);

  const copy = AUTH_COPY[name] || AUTH_COPY.login;
  authTitle.textContent = copy.title;
  authSubheading.textContent = copy.subheading;
}

authModeTabs.forEach((tab) => {
  tab.addEventListener("click", () => showAuthView(tab.dataset.mode));
});

authForgotLink.addEventListener("click", () => showAuthView("forgot"));
authBackLinks.forEach((link) => link.addEventListener("click", () => showAuthView("login")));

function showAuthError(err) {
  authErrorEl.textContent = err.message || "Something went wrong - try again.";
  authErrorEl.classList.remove("hidden");
}

authLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authErrorEl.classList.add("hidden");
  authLoginSubmit.disabled = true;
  try {
    const auth = await logIn({ email: authLoginEmail.value.trim(), password: authLoginPassword.value });
    showSignedIn(auth);
  } catch (err) {
    showAuthError(err);
  } finally {
    authLoginSubmit.disabled = false;
  }
});

authSignupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authErrorEl.classList.add("hidden");
  authSignupSubmit.disabled = true;
  try {
    const auth = await signUp({
      name: authSignupName.value.trim(),
      email: authSignupEmail.value.trim(),
      password: authSignupPassword.value,
    });
    showSignedIn(auth);
  } catch (err) {
    showAuthError(err);
  } finally {
    authSignupSubmit.disabled = false;
  }
});

authForgotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authErrorEl.classList.add("hidden");
  authForgotSubmit.disabled = true;
  try {
    const email = authForgotEmail.value.trim();
    await requestPasswordReset(email);
    authResetEmail = email;
    showAuthView("reset");
    authSuccessEl.textContent = `Code sent to ${email} - check your inbox.`;
    authSuccessEl.classList.remove("hidden");
  } catch (err) {
    showAuthError(err);
  } finally {
    authForgotSubmit.disabled = false;
  }
});

authResetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authErrorEl.classList.add("hidden");
  authResetSubmit.disabled = true;
  try {
    await resetPassword({
      email: authResetEmail,
      code: authResetCode.value.trim(),
      newPassword: authResetPassword.value,
    });
    showAuthView("login");
    authLoginEmail.value = authResetEmail;
    authSuccessEl.textContent = "Password updated - log in with your new password.";
    authSuccessEl.classList.remove("hidden");
  } catch (err) {
    showAuthError(err);
  } finally {
    authResetSubmit.disabled = false;
  }
});

async function handleGoogleAuth() {
  authErrorEl.classList.add("hidden");
  googleLoginBtn.disabled = true;
  try {
    const auth = await signInWithGoogle();
    showSignedIn(auth);
  } catch (err) {
    console.error("BrowserMind sign-in error:", err);
    showAuthError(new Error(`Sign-in failed: ${err.message}`));
  } finally {
    googleLoginBtn.disabled = false;
  }
}

googleLoginBtn.addEventListener("click", handleGoogleAuth);

function toggleAccountPanel() {
  accountPanel.classList.toggle("hidden");
}

accountBtn.addEventListener("click", toggleAccountPanel);

const signOutLabel = signOutBtn.querySelector(".account-panel-item-label");

signOutBtn.addEventListener("click", async () => {
  // Give immediate feedback instead of the panel just sitting there while
  // signOut()'s network call is in flight - and stop a second click from
  // firing a second sign-out while the first is still running.
  signOutBtn.disabled = true;
  if (signOutLabel) signOutLabel.textContent = "Logging out...";

  try {
    await signOut();
  } finally {
    accountPanel.classList.add("hidden");
    showAuthView("login");
    authGate.classList.remove("hidden");
    document.body.classList.add("signed-out");
    signOutBtn.disabled = false;
    if (signOutLabel) signOutLabel.textContent = "Sign out";
  }
});

function truncate(text, maxLen = 110) {
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

// Builds one of the "nothing to show" states (loading / empty / error) as
// an icon + title + short explanation, instead of a single line of text
// left floating in an otherwise blank panel.
function renderEmptyState(container, { icon, danger, title, text, retry }) {
  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "bm-empty-state";

  const iconEl = document.createElement("div");
  iconEl.className = danger ? "bm-empty-icon danger" : "bm-empty-icon";
  iconEl.innerHTML = icon;
  wrap.appendChild(iconEl);

  const titleEl = document.createElement("p");
  titleEl.className = "bm-empty-title";
  titleEl.textContent = title;
  wrap.appendChild(titleEl);

  if (text) {
    const textEl = document.createElement("p");
    textEl.className = "bm-empty-text";
    textEl.textContent = text;
    wrap.appendChild(textEl);
  }

  if (retry) {
    const retryBtn = document.createElement("button");
    retryBtn.className = "bm-empty-retry";
    retryBtn.textContent = "Try again";
    retryBtn.addEventListener("click", retry);
    wrap.appendChild(retryBtn);
  }

  container.appendChild(wrap);
}

const MEMORY_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>';
const WARNING_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9L2.8 17a1.8 1.8 0 0 0 1.5 2.7h15.4a1.8 1.8 0 0 0 1.5-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0z"/></svg>';

async function loadMemory() {
  memoryList.innerHTML = `<div class="bm-empty-state"><span class="bm-mini-spinner"></span><p class="bm-empty-title">Loading memory...</p></div>`;

  try {
    const items = await getMemory(sessionId);
    renderMemoryItems(items);
  } catch (err) {
    renderEmptyState(memoryList, {
      icon: WARNING_ICON,
      danger: true,
      title: "Could not load memory",
      text: "The BrowserMind backend didn't respond. Make sure it's running, then try again.",
      retry: loadMemory,
    });
  }
}

function renderMemoryItems(items) {
  memoryList.innerHTML = "";

  if (!items.length) {
    renderEmptyState(memoryList, {
      icon: MEMORY_ICON,
      title: "Nothing remembered yet",
      text: "As you chat on this site, key details will show up here for next time.",
    });
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "memory-item";

    const source = document.createElement("span");
    source.className = "memory-item-source";
    source.textContent = item.source === "user" ? "You" : "BrowserMind";
    row.appendChild(source);

    const content = document.createElement("p");
    content.className = "memory-item-content";
    content.textContent = truncate(item.content);
    content.title = item.content;
    row.appendChild(content);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "memory-item-delete";
    deleteBtn.title = "Forget this";
    deleteBtn.textContent = "×";
    deleteBtn.addEventListener("click", async () => {
      try {
        await deleteMemory(item.id);
        row.remove();
        if (!memoryList.children.length) {
          renderEmptyState(memoryList, {
            icon: MEMORY_ICON,
            title: "Nothing remembered yet",
            text: "As you chat on this site, key details will show up here for next time.",
          });
        }
      } catch (err) {
        // If delete fails, leave the item in place rather than lying about it.
      }
    });
    row.appendChild(deleteBtn);

    memoryList.appendChild(row);
  });
}

function formatGroupsAsText(groups) {
  const lines = [];
  for (const category in groups) {
    const tabsInGroup = groups[category];
    if (tabsInGroup.length === 0) continue;
    const titles = tabsInGroup.map((t) => t.title).join(", ");
    lines.push(`${category} (${tabsInGroup.length}): ${titles}`);
  }
  return lines.length ? lines.join("\n") : "No tabs to summarize.";
}

async function handleSummarize() {
  showChatLog();
  const tabs = await new Promise((resolve) => chrome.tabs.query({}, resolve));
  const tabList = tabs.map((t) => ({ tab_id: t.id, url: t.url, title: t.title }));

  try {
    const result = await summarizeTabs(tabList);
    appendMessage(formatGroupsAsText(result.groups), "assistant");
  } catch (err) {
    appendTransient("Could not summarize tabs right now.", "assistant");
  }
}

async function handleQuiz() {
  const activeTab = await getActiveTab();
  const excerpt = await getPageExcerpt(activeTab.id);

  await chrome.storage.local.set({
    browsermindQuizTab: {
      tab_id: activeTab.id,
      url: activeTab.url,
      title: activeTab.title,
      content_excerpt: excerpt,
    },
  });

  chrome.tabs.create({ url: chrome.runtime.getURL("src/quiz/quiz.html") });
}

// Reuses an already-open Forms tab instead of stacking up a new one every
// time - clicking "Create form" repeatedly (e.g. while testing) used to
// leave a trail of duplicate BrowserMind Forms tabs behind.
async function openFormGenerator() {
  const url = chrome.runtime.getURL("src/forms/form-generator.html");
  const [existing] = await chrome.tabs.query({ url });
  if (existing) {
    chrome.tabs.update(existing.id, { active: true });
    chrome.windows.update(existing.windowId, { focused: true });
  } else {
    chrome.tabs.create({ url });
  }
}

function openPdfTools() {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/pdf-tools/pdf-tools.html") });
  moreToolsPanel.classList.add("hidden");
  moreToolsBtn.classList.remove("active");
}

function openDocumentChat() {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/document-chat/document-chat.html") });
  moreToolsPanel.classList.add("hidden");
  moreToolsBtn.classList.remove("active");
}

// Captures the current tab's page text before opening JobFit, same pattern
// as handleQuiz() above - JobFit runs in its own full tab, which can't
// reach back into whatever tab was active when the button was clicked.
// Always opens a fresh tab (like PDF Tools/Text Tools/Mindmap do) rather
// than reusing an existing one - reusing would risk showing an old job's
// data if JobFit was already open from a previous posting.
function openTextTools() {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/text-tools/text-tools.html") });
  moreToolsPanel.classList.add("hidden");
  moreToolsBtn.classList.remove("active");
}

function openMindmap() {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/mindmap/mindmap.html") });
  moreToolsPanel.classList.add("hidden");
  moreToolsBtn.classList.remove("active");
}

sendBtn.addEventListener("click", handleSend);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSend();
});
summarizeBtn.addEventListener("click", handleSummarize);
quizBtn.addEventListener("click", handleQuiz);
memoryBtn.addEventListener("click", openMemoryView);
memoryBackBtn.addEventListener("click", goHome);
memoryRefreshBtn.addEventListener("click", loadMemory);

function startNewChat() {
  chatLog.innerHTML = "";
  historyMessages = [];
  sessionId = crypto.randomUUID();
  saveHistory();
  showHomeView();
}

clearChatBtn.addEventListener("click", startNewChat);
homeNewChatBtn.addEventListener("click", startNewChat);
formsBtn.addEventListener("click", openFormGenerator);
homeFormsBtn.addEventListener("click", openFormGenerator);

moreToolsBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  moreToolsPanel.classList.toggle("hidden");
  moreToolsBtn.classList.toggle("active", !moreToolsPanel.classList.contains("hidden"));
});
morePdfToolsBtn.addEventListener("click", openPdfTools);
moreChatDocBtn.addEventListener("click", openDocumentChat);
moreTextToolsBtn.addEventListener("click", openTextTools);
moreMindmapBtn.addEventListener("click", openMindmap);
moreJobFitBtn.addEventListener("click", showJobFitView);
document.addEventListener("click", (e) => {
  if (!moreToolsPanel.classList.contains("hidden") && !e.target.closest(".side-rail-more")) {
    moreToolsPanel.classList.add("hidden");
    moreToolsBtn.classList.remove("active");
  }
});

homeBtn.addEventListener("click", goHome);
logoIcon.addEventListener("click", goHome);
closeBtn.addEventListener("click", () => {
  window.parent.postMessage({ type: "BROWSERMIND_CLOSE" }, "*");
});

// "Expand" opens this exact same sidebar.html as its own browser tab -
// same header, same views, same everything, just not squeezed into the
// narrow injected panel. window.self !== window.top is true only when
// we're the injected iframe (has a parent page); a tab opened this way
// has no parent, so that check also doubles as "are we already full-page
// mode" - no separate flag needed. Runs once at load, not per-view, so
// every page/feature in the app (home, chat, JobFit, memory, etc.) gets
// it for free since they all share this one header.
const isEmbeddedInPage = window.self !== window.top;
if (isEmbeddedInPage) {
  expandBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/sidebar/sidebar.html") });
  });
} else {
  // Already a full page - expanding further would do nothing useful.
  expandBtn.classList.add("hidden");
  document.body.classList.add("full-page");
}
homeSummarizeBtn.addEventListener("click", summarizePage);
homeTabsBtn.addEventListener("click", handleSummarize);
homeQuizBtn.addEventListener("click", handleQuiz);
homeMemoryBtn.addEventListener("click", openMemoryView);
homeChatDocBtn.addEventListener("click", openDocumentChat);
homePdfToolsBtn.addEventListener("click", openPdfTools);
homeTextToolsBtn.addEventListener("click", openTextTools);
homeMindmapBtn.addEventListener("click", openMindmap);
homeJobFitBtn.addEventListener("click", showJobFitView);

window.addEventListener("message", (event) => {
  if (event.data?.type === "BROWSERMIND_QUICK_ASK") {
    sendChat(event.data.query, event.data.label);
  }
  if (event.data?.type === "BROWSERMIND_FOCUS_INPUT") {
    input.focus();
  }
});

loadTheme();
checkAuth();
restoreHistory();
