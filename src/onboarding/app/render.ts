// @ts-nocheck
export function renderList(containerId, items, className) {
  const container = document.getElementById(containerId);
  container.innerHTML = items
    .map(
      ([title, desc]) => `
        <article class="${className}">
          <strong>${title}</strong>
          <p>${desc}</p>
        </article>
      `
    )
    .join("");
}

export function renderOnboarding({ copy, isKorean, currentStep, steps, dots }) {
  document.documentElement.lang = isKorean ? "ko" : "en";
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

  steps.forEach((step, index) => {
    step.classList.toggle("active", index === currentStep);
  });
  dots.forEach((dot, index) => {
    dot.classList.toggle("active", index === currentStep);
  });
}
