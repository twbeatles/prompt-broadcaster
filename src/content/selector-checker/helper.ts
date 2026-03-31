// @ts-nocheck
import { runSelectorCheck } from "./checks";
import { installSelectorCheckerPingListener } from "./runtime";

(() => {
  if (globalThis.__aiPromptBroadcasterSelectorCheckerLoaded) {
    return;
  }

  globalThis.__aiPromptBroadcasterSelectorCheckerLoaded = true;
  installSelectorCheckerPingListener();

  if (document.readyState === "complete") {
    void runSelectorCheck();
  } else {
    window.addEventListener(
      "load",
      () => {
        void runSelectorCheck();
      },
      { once: true }
    );
  }
})();
