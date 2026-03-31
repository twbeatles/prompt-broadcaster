// src/onboarding/app/copy.ts
var isKorean = chrome.i18n.getUILanguage().toLowerCase().startsWith("ko");
var COPY = isKorean ? {
  heroTitle: "AI Prompt Broadcaster에 오신 것을 환영합니다",
  heroDesc: "프롬프트 하나로 ChatGPT, Gemini, Claude, Grok에 동시에 전송합니다.",
  permissionTitle: "권한 안내",
  permissionDesc: "확장 프로그램은 자동 전송을 위해 아래 권한만 사용합니다.",
  privacyNote: "개인 데이터는 확장 프로그램 서버로 전송되지 않으며, 브라우저 밖으로 나가지 않습니다.",
  usageTitle: "사용 방법",
  usageDesc: "세 단계로 여러 AI에 같은 프롬프트를 보낼 수 있습니다.",
  next: "다음",
  prev: "이전",
  start: "시작하기",
  finish: "완료 — 사용 시작",
  permissions: [
    ["tabs", "각 AI 서비스를 새 탭으로 열기 위해 필요합니다."],
    ["scripting", "열린 탭에 프롬프트를 자동 입력하기 위해 필요합니다."],
    ["storage", "히스토리와 즐겨찾기를 로컬에 저장하기 위해 필요합니다."],
    ["host_permissions", "지원하는 AI 사이트에서만 동작하도록 제한합니다."]
  ],
  usage: [
    ["1", "확장 아이콘을 클릭해 팝업을 엽니다."],
    ["2", "프롬프트를 입력하고 전송할 AI 서비스를 선택합니다."],
    ["3", "Send를 누르면 각 탭이 열리고 자동으로 전송됩니다."]
  ]
} : {
  heroTitle: "Welcome to AI Prompt Broadcaster",
  heroDesc: "Send one prompt to ChatGPT, Gemini, Claude, and Grok at the same time.",
  permissionTitle: "Permission guide",
  permissionDesc: "The extension only uses the permissions below to automate sending.",
  privacyNote: "Your data is not sent to an extension server and does not leave the browser.",
  usageTitle: "How it works",
  usageDesc: "Send the same prompt to multiple AI services in three steps.",
  next: "Next",
  prev: "Back",
  start: "Get started",
  finish: "Done — Start using it",
  permissions: [
    ["tabs", "Needed to open each AI service in a new tab."],
    ["scripting", "Needed to inject the prompt into the opened tab."],
    ["storage", "Needed to keep history and favorites locally."],
    ["host_permissions", "Restricted so the extension only runs on supported AI sites."]
  ],
  usage: [
    ["1", "Click the extension icon to open the popup."],
    ["2", "Enter a prompt and choose the AI services."],
    ["3", "Click Send to open each tab and inject the prompt automatically."]
  ]
};

// src/onboarding/app/navigation.ts
async function finishOnboarding() {
  await chrome.storage.local.set({ onboardingCompleted: true });
  window.close();
}
function bindOnboardingNavigation({ steps: steps2, getCurrentStep, setCurrentStep, render: render2 }) {
  document.addEventListener("click", (event) => {
    const nextButton = event.target.closest("[data-next]");
    if (nextButton) {
      setCurrentStep(Math.min(steps2.length - 1, getCurrentStep() + 1));
      render2();
      return;
    }
    const prevButton = event.target.closest("[data-prev]");
    if (prevButton) {
      setCurrentStep(Math.max(0, getCurrentStep() - 1));
      render2();
      return;
    }
    if (event.target.id === "finish-btn") {
      void finishOnboarding();
    }
  });
}

// src/onboarding/app/render.ts
function renderList(containerId, items, className) {
  const container = document.getElementById(containerId);
  container.innerHTML = items.map(
    ([title, desc]) => `
        <article class="${className}">
          <strong>${title}</strong>
          <p>${desc}</p>
        </article>
      `
  ).join("");
}
function renderOnboarding({ copy, isKorean: isKorean2, currentStep: currentStep2, steps: steps2, dots: dots2 }) {
  document.documentElement.lang = isKorean2 ? "ko" : "en";
  document.getElementById("hero-title").textContent = copy.heroTitle;
  document.getElementById("hero-desc").textContent = copy.heroDesc;
  document.getElementById("permission-title").textContent = copy.permissionTitle;
  document.getElementById("permission-desc").textContent = copy.permissionDesc;
  document.getElementById("privacy-note").textContent = copy.privacyNote;
  document.getElementById("usage-title").textContent = copy.usageTitle;
  document.getElementById("usage-desc").textContent = copy.usageDesc;
  renderList("permission-list", copy.permissions, "info-card");
  renderList("usage-list", copy.usage, "flow-card");
  document.querySelector('[data-step="0"] [data-next]').textContent = copy.start;
  document.querySelector('[data-step="1"] [data-prev]').textContent = copy.prev;
  document.querySelector('[data-step="1"] [data-next]').textContent = copy.next;
  document.querySelector('[data-step="2"] [data-prev]').textContent = copy.prev;
  document.getElementById("finish-btn").textContent = copy.finish;
  steps2.forEach((step, index) => {
    step.classList.toggle("active", index === currentStep2);
  });
  dots2.forEach((dot, index) => {
    dot.classList.toggle("active", index === currentStep2);
  });
}

// src/onboarding/app/bootstrap.ts
var steps = [...document.querySelectorAll("[data-step]")];
var dots = [...document.querySelectorAll("[data-step-dot]")];
var currentStep = 0;
function render() {
  renderOnboarding({
    copy: COPY,
    isKorean,
    currentStep,
    steps,
    dots
  });
}
bindOnboardingNavigation({
  steps,
  getCurrentStep: () => currentStep,
  setCurrentStep: (value) => {
    currentStep = value;
  },
  render
});
render();
