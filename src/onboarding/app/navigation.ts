// @ts-nocheck
export async function finishOnboarding() {
  await chrome.storage.local.set({ onboardingCompleted: true });
  window.close();
}

export function bindOnboardingNavigation({ steps, getCurrentStep, setCurrentStep, render }) {
  document.addEventListener("click", (event) => {
    const nextButton = event.target.closest("[data-next]");
    if (nextButton) {
      setCurrentStep(Math.min(steps.length - 1, getCurrentStep() + 1));
      render();
      return;
    }

    const prevButton = event.target.closest("[data-prev]");
    if (prevButton) {
      setCurrentStep(Math.max(0, getCurrentStep() - 1));
      render();
      return;
    }

    if (event.target.id === "finish-btn") {
      void finishOnboarding();
    }
  });
}
