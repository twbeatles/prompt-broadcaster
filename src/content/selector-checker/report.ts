// @ts-nocheck
import { sendRuntimeMessage } from "./runtime";

export function sendSelectorCheckReport(report) {
  return sendRuntimeMessage({
    action: "selector-check:report",
    ...report,
  });
}
