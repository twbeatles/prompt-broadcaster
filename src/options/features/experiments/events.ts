import { sendRuntimeMessageWithTimeout } from "../../../shared/chrome/messaging";
import { t } from "../../app/i18n";
import { state } from "../../app/state";
import { showAppToast } from "../../core/status";
import {
  loadExperiment,
  runExperiment,
  saveDraftExperiment,
} from "./actions";
import { dom } from "./dom";
import {
  renderExperimentsSection,
  renderPreview,
} from "./rendering";

export function bindExperimentEvents(): void {
  dom.experimentPreview?.addEventListener("click", renderPreview);
  dom.experimentSave?.addEventListener("click", () => {
    void saveDraftExperiment().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save experiment.", error);
      showAppToast(error?.message || t.experiments.saveFailed, "error", 3000);
    });
  });
  dom.experimentRun?.addEventListener("click", () => {
    void (async () => {
      const experiment = await saveDraftExperiment();
      if (experiment) {
        await runExperiment(experiment.id);
      }
    })().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to run experiment.", error);
      showAppToast(error?.message || t.experiments.runFailed, "error", 3000);
    });
  });
  dom.experimentList?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const loadButton = target?.closest<HTMLElement>("[data-experiment-load]");
    const runButton = target?.closest<HTMLElement>("[data-experiment-run]");
    const deleteButton = target?.closest<HTMLElement>("[data-experiment-delete]");

    if (loadButton) {
      loadExperiment(loadButton.dataset.experimentLoad ?? "");
      return;
    }

    if (runButton) {
      void runExperiment(runButton.dataset.experimentRun ?? "").catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to run experiment.", error);
        showAppToast(error?.message || t.experiments.runFailed, "error", 3000);
      });
      return;
    }

    if (deleteButton) {
      void sendRuntimeMessageWithTimeout<"experiment:delete">({
        action: "experiment:delete",
        experimentId: deleteButton.dataset.experimentDelete ?? "",
      }, 8000).then((response) => {
        state.promptExperiments = response?.experiments ?? state.promptExperiments;
        renderExperimentsSection();
        showAppToast(t.experiments.deleteSuccess, "success", 1600);
      });
    }
  });
}
