import type { PopupEventDeps } from "./events/deps";
import { bindComposeEvents } from "./events/compose";
import { bindListEvents } from "./events/lists";
import { bindModalAndKeyboardEvents } from "./events/modals";
import { bindRuntimeEvents } from "./events/runtime";
import { bindServiceEvents } from "./events/services";
import { bindSettingsEvents } from "./events/settings";
import { bindTabEvents } from "./events/tabs";

export function bindPopupEvents(deps: PopupEventDeps) {
  bindTabEvents(deps.compose.switchTab);
  bindComposeEvents(deps);
  bindListEvents(deps);
  bindSettingsEvents(deps);
  bindServiceEvents(deps);
  bindModalAndKeyboardEvents(deps);
  bindRuntimeEvents(deps);
}
