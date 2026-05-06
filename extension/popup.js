/**
 * TruthLayer - Popup Controller
 * Orchestrates content extraction, API communication, and UI rendering.
 * Matches reference design: article preview, score bar, risk indicators,
 * emotional manipulation warning, source verification, action buttons.
 */

// ---- DOM References ----
const stateLoading = document.getElementById("state-loading");
const stateError = document.getElementById("state-error");
const stateResults = document.getElementById("state-results");
const headerStatus = document.getElementById("header-status");
const statusText = document.getElementById("status-text");
const errorTitle = document.getElementById("error-title");
const errorMessage = document.getElementById("error-message");
const btnRetry = document.getElementById("btn-retry");

// Article preview
const articleTitle = document.getElementById("article-title");
const articleDomain = document.getElementById("article-domain");
const articleSummary = document.getElementById("article-summary");

// Score
const scoreNumber = document.getElementById("score-number");
const scoreCard = document.getElementById("score-card");
const verdictBadge = document.getElementById("verdict-badge");
const scoreBarIndicator = document.getElementById("score-bar-indicator");

// Risk
const riskList = document.getElementById("risk-list");
const riskCard = document.getElementById("risk-card");

// Warning
const warningCard = document.getElementById("warning-card");
const warningTitle = document.getElementById("warning-title");
const warningTriggers = document.getElementById("warning-triggers");

// Source
const sourceCredibility = document.getElementById("source-credibility");

// Buttons
const btnFullAnalysis = document.getElementById("btn-full-analysis");

// ---- Risk icon mapping ----
const RISK_ICONS = [
  {
    pattern: /sensational|emotional|clickbait/i,
    icon: "🔥",
    color: "icon-red",
  },
  { pattern: /source|verified|reference/i, icon: "📋", color: "icon-red" },
  {
    pattern: /misinformation|fake|false|pattern/i,
    icon: "📉",
    color: "icon-red",
  },
  {
    pattern: /caps|punctuation|exclamation/i,
    icon: "❗",
    color: "icon-orange",
  },
  { pattern: /bias/i, icon: "⚖️", color: "icon-orange" },
  { pattern: /offline|unavailable|connect/i, icon: "🔌", color: "icon-orange" },
  { pattern: /caution|treat/i, icon: "⚠️", color: "icon-orange" },
];

// ---- Emotional triggers to detect ----
const EMOTION_PATTERNS = [
  { pattern: /sensational|shocking|miracle/i, trigger: "Fear" },
  { pattern: /anger|outrage|fury/i, trigger: "Anger" },
  { pattern: /emotional|manipulation/i, trigger: "Anger" },
  { pattern: /fear|scary|terrif/i, trigger: "Fear" },
  { pattern: /urgent|act now|hurry/i, trigger: "Urgency" },
  { pattern: /caps/i, trigger: "Aggression" },
  { pattern: /clickbait/i, trigger: "Curiosity" },
];

// ---- State Management ----
function showState(state) {
  stateLoading.classList.add("hidden");
  stateError.classList.add("hidden");
  stateResults.classList.add("hidden");

  if (state === "loading") stateLoading.classList.remove("hidden");
  if (state === "error") stateError.classList.remove("hidden");
  if (state === "results") stateResults.classList.remove("hidden");
}

function showError(title, message) {
  errorTitle.textContent = title;
  errorMessage.textContent = message;
  statusText.textContent = "Analysis failed";
  showState("error");
}

// ---- Render Article Preview ----
function renderArticle(pageTitle, pageDomain, contentSnippet) {
  articleTitle.textContent = pageTitle || "Untitled Page";
  articleDomain.textContent = pageDomain || "unknown";
  articleSummary.textContent = contentSnippet
    ? contentSnippet.substring(0, 180) +
      (contentSnippet.length > 180 ? "…" : "")
    : "No preview available.";
}

// ---- Render Score ----
function renderScore(score) {
  scoreNumber.textContent = score;

  // Animate bar indicator
  const percent = Math.max(2, Math.min(98, score));
  setTimeout(() => {
    scoreBarIndicator.style.left = percent + "%";
  }, 200);

  // Verdict badge
  let verdictText = "Needs Verification";
  let verdictClass = "verdict-medium";
  let borderColor = "#e8c547";

  if (score >= 70) {
    verdictText = "Likely Credible";
    verdictClass = "verdict-high";
    borderColor = "#27ae60";
  } else if (score < 40) {
    verdictText = "Low Credibility";
    verdictClass = "verdict-low";
    borderColor = "#e74c3c";
  }

  verdictBadge.textContent = verdictText;
  verdictBadge.className = "verdict-badge " + verdictClass;
  scoreCard.style.borderColor = borderColor;
}

// ---- Render Risk Indicators ----
function renderRisks(reasons) {
  riskList.innerHTML = "";

  if (!reasons || reasons.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="risk-icon icon-green">✅</span>
      <span>No significant risk indicators found</span>
    `;
    riskList.appendChild(li);
    return;
  }

  reasons.forEach((reason) => {
    const li = document.createElement("li");

    // Find matching icon
    let icon = "⚠️";
    let colorClass = "icon-orange";
    for (const ri of RISK_ICONS) {
      if (ri.pattern.test(reason)) {
        icon = ri.icon;
        colorClass = ri.color;
        break;
      }
    }

    li.innerHTML = `
      <span class="risk-icon ${colorClass}">${icon}</span>
      <span>${reason}</span>
    `;
    riskList.appendChild(li);
  });
}

// ---- Render Emotional Manipulation Warning ----
function renderEmotionalWarning(reasons) {
  if (!reasons || reasons.length === 0) {
    warningCard.classList.add("hidden");
    return;
  }

  const reasonsText = reasons.join(" ");
  const triggers = new Set();

  EMOTION_PATTERNS.forEach((ep) => {
    if (ep.pattern.test(reasonsText)) {
      triggers.add(ep.trigger);
    }
  });

  if (triggers.size > 0) {
    warningCard.classList.remove("hidden");
    warningTriggers.textContent = Array.from(triggers).join(", ");
  } else {
    warningCard.classList.add("hidden");
  }
}



// ---- Render Full Results ----
function renderResults(data, pageTitle, pageDomain, contentSnippet) {
  console.log("TruthLayer: Rendering results", data);
  
  // Handle different potential field names from AI service
  const score = data.score ?? data.credibility_score ?? 50;
  const reasons = data.reasons ?? data.explanation ?? [];
  const label = data.label ?? (score >= 70 ? "Likely Credible" : score < 40 ? "Low Credibility" : "Needs Verification");

  renderArticle(pageTitle, pageDomain, contentSnippet);
  renderScore(score);
  renderRisks(reasons);
  renderEmotionalWarning(reasons);

  statusText.textContent = "Analysis complete";
  showState("results");
}

// ---- Main Analysis Flow ----
let currentTabUrl = "";

async function analyze() {
  showState("loading");
  statusText.textContent = "Analyzing this article";

  try {
    // 1. Get the active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.id) {
      showError(
        "No Active Tab",
        "Could not find an active browser tab to analyze.",
      );
      return;
    }

    currentTabUrl = tab.url || "";

    // Check for restricted pages
    if (
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://") ||
      tab.url.startsWith("about:")
    ) {
      showError(
        "Restricted Page",
        "Cannot analyze Chrome internal pages. Navigate to an article or news page and try again.",
      );
      return;
    }

    // Parse domain
    let pageDomain = "";
    try {
      pageDomain = new URL(tab.url).hostname;
    } catch {}

    // 2. Inject content extraction script
    let extractionResults;
    try {
      extractionResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["extract-content.js"],
      });
    } catch (injectionError) {
      showError(
        "Cannot Access Page",
        "Permission denied. This page may restrict extensions. Try refreshing the page.",
      );
      return;
    }

    const extractedData = extractionResults?.[0]?.result;

    if (
      !extractedData ||
      !extractedData.content ||
      extractedData.content.length < 30
    ) {
      showError(
        "No Article Found",
        "Could not find readable article content on this page. Try navigating to a news article or blog post.",
      );
      return;
    }

    const pageTitle = extractedData.title || tab.title || "Untitled";
    const contentSnippet = extractedData.content;

    // 3. Send to background for API analysis
    chrome.runtime.sendMessage(
      {
        type: "ANALYZE_CONTENT",
        url: extractedData.url,
        content: extractedData.content,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          showError("Extension Error", chrome.runtime.lastError.message);
          return;
        }

        if (response && response.success) {
          renderResults(response.data, pageTitle, pageDomain, contentSnippet);
        } else {
          showError(
            "Analysis Failed",
            response?.error ||
              "Backend server may be offline. Make sure the TruthLayer backend is running on localhost:3000.",
          );
        }
      },
    );
  } catch (err) {
    showError(
      "Unexpected Error",
      err.message || "Something went wrong. Please try again.",
    );
  }
}

// ---- Button Handlers ----
btnRetry.addEventListener("click", () => analyze());

btnFullAnalysis.addEventListener("click", () => {
  // Expand all hidden details in the results view
  const allCards = document.querySelectorAll(".card");
  allCards.forEach((card) => {
    if (card.classList.contains("hidden")) {
      card.classList.remove("hidden");
    }
  });

  // Scroll to top to show full content
  const container = document.querySelector(".popup-container");
  if (container) {
    container.scrollTop = 0;
  }
});



// ---- Facebook Pause Toggle Logic ----
const facebookSettings = document.getElementById("facebook-settings");
const facebookToggle = document.getElementById("toggle-facebook-pause");
const generalAnalysisUI = document.getElementById("general-analysis-ui");

async function initFacebookToggle() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const isFacebook = tab.url && tab.url.includes("facebook.com");
  
  if (isFacebook) {
    document.body.classList.add("compact-mode");
    // ON FACEBOOK: Show ONLY the toggle
    facebookSettings.classList.remove("hidden");
    generalAnalysisUI.classList.add("hidden");
    statusText.textContent = "Facebook Feed Control";
    headerStatus.style.display = "none"; // Hide pulsing dot on settings view
    
    // Load state
    const { fbPaused } = await chrome.storage.local.get("fbPaused");
    facebookToggle.checked = !!fbPaused;

    facebookToggle.addEventListener("change", async (e) => {
      const paused = e.target.checked;
      await chrome.storage.local.set({ fbPaused: paused });
      
      // Notify content script in current tab
      chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_FB_PAUSE", paused });
    });
  } else {
    // NOT ON FACEBOOK: Show Analysis
    facebookSettings.classList.add("hidden");
    generalAnalysisUI.classList.remove("hidden");
    
    // Run the normal article analysis
    analyze();
  }
}

// ---- Start on popup open ----
document.addEventListener("DOMContentLoaded", () => {
  initFacebookToggle();
});
