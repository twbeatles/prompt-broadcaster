// @ts-nocheck
import { COPY, isKorean } from "./copy";
import { bindOnboardingNavigation } from "./navigation";
import { renderOnboarding } from "./render";

const steps = [...document.querySelectorAll("[data-step]")];
const dots = [...document.querySelectorAll("[data-step-dot]")];
let currentStep = 0;

function render() {
  renderOnboarding({
    copy: COPY,
    isKorean,
    currentStep,
    steps,
    dots,
  });
}

bindOnboardingNavigation({
  steps,
  getCurrentStep: () => currentStep,
  setCurrentStep: (value) => {
    currentStep = value;
  },
  render,
});

render();
