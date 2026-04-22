import { createPopupBroadcastState } from "./send-flow/broadcast-state";
import { createPopupSendCardState } from "./send-flow/card-state";
import { createPopupSendExecution } from "./send-flow/send-execution";
import type { PopupSendFlowDeps } from "./send-flow/types";

export { isLastBroadcastSummary } from "./send-flow/types";

export function createPopupSendFlow(deps: PopupSendFlowDeps) {
  const cardState = createPopupSendCardState();
  const broadcastState = createPopupBroadcastState(deps, cardState);
  const sendExecution = createPopupSendExecution(deps, cardState);

  return {
    applyLastBroadcastState: broadcastState.applyLastBroadcastState,
    cancelCurrentBroadcast: broadcastState.cancelCurrentBroadcast,
    sendResolvedPrompt: sendExecution.sendResolvedPrompt,
    setCardStatesFromBroadcast: broadcastState.setCardStatesFromBroadcast,
    triggerRipple: cardState.triggerRipple,
  };
}
