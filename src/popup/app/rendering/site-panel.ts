import { popupDom } from "../dom";
import { getSiteIcon, previewText } from "../helpers";
import { msg, t } from "../i18n";
import { state } from "../state";
import type { PopupRenderingDeps } from "./types";

const { sitesContainer } = popupDom.compose;

export function createSitePanelRenderer(
  deps: PopupRenderingDeps,
  renderTemplateSummary: () => void,
) {
  function renderSiteCheckboxesPanel() {
    const previousSelection = new Set(deps.checkedSiteIds());
    sitesContainer.innerHTML = "";

    deps.getEnabledSites().forEach((site) => {
      const card = document.createElement("article");
      card.className = "site-card checked";
      card.dataset.siteId = site.id;
      card.style.setProperty("--site-color", site.color || "#c24f2e");
      card.setAttribute("role", "option");
      card.tabIndex = 0;

      const mainRow = document.createElement("label");
      mainRow.className = "site-card-main";
      mainRow.htmlFor = `site-${site.id}`;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `site-${site.id}`;
      checkbox.value = site.id;
      checkbox.checked =
        previousSelection.size > 0 ? previousSelection.has(site.id) : true;

      const siteIcon = document.createElement("span");
      siteIcon.className = "site-icon";
      siteIcon.textContent = getSiteIcon(site);

      const siteName = document.createElement("span");
      siteName.className = "site-name";
      siteName.textContent = `${deps.getRuntimeSiteLabel(site.id)}`;

      const selectorWarning = state.failedSelectors.get(site.id);
      if (selectorWarning) {
        card.classList.add("selector-warning");
        card.title = t.selectorWarningTooltip;
      }

      checkbox.addEventListener("change", () => {
        card.classList.toggle("checked", checkbox.checked);
        card.setAttribute("aria-selected", String(checkbox.checked));
        card.setAttribute(
          "aria-label",
          `${deps.getRuntimeSiteLabel(site.id)} ${
            checkbox.checked ? t.ariaSelected : t.ariaNotSelected
          }`,
        );
        deps.syncToggleAllLabel();
        renderTemplateSummary();
      });

      card.addEventListener("keydown", (event) => {
        if (event.key !== " " && event.key !== "Enter") {
          return;
        }

        event.preventDefault();
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      });

      const siteStatus = document.createElement("span");
      siteStatus.className = "site-status";
      siteStatus.setAttribute("aria-hidden", "true");

      const warningIcon = document.createElement("span");
      warningIcon.className = "site-warning";
      warningIcon.setAttribute("aria-hidden", "true");
      warningIcon.textContent = selectorWarning ? "!" : "";

      mainRow.append(checkbox, siteIcon, siteName, warningIcon, siteStatus);
      card.classList.toggle("checked", checkbox.checked);
      card.setAttribute("aria-selected", String(checkbox.checked));
      card.setAttribute(
        "aria-label",
        `${deps.getRuntimeSiteLabel(site.id)} ${
          checkbox.checked ? t.ariaSelected : t.ariaNotSelected
        }`,
      );
      card.appendChild(mainRow);

      const openTabs = deps.getOpenSiteTabs(site.id);
      const selectedTarget = state.siteTargetSelections?.[site.id] ?? "default";

      if (openTabs.length > 0) {
        const tabsWrap = document.createElement("div");
        tabsWrap.className = "site-tabs";

        const tabsHead = document.createElement("div");
        tabsHead.className = "site-tabs-head";
        tabsHead.textContent = t.openTabsTitle(openTabs.length);

        const tabsList = document.createElement("div");
        tabsList.className = "site-tabs-list";
        const radioName = `site-target-${site.id}`;

        const appendTargetOption = (
          choiceValue: typeof state.siteTargetSelections[string],
          title: string,
          detail: string,
          pillText = "",
        ): void => {
          const option = document.createElement("label");
          option.className = "site-tab-option";

          const radio = document.createElement("input");
          radio.type = "radio";
          radio.name = radioName;
          radio.value =
            typeof choiceValue === "number"
              ? `tab:${choiceValue}`
              : String(choiceValue);
          radio.checked = choiceValue === selectedTarget;

          const copy = document.createElement("span");
          copy.className = "site-tab-copy";

          const titleNode = document.createElement("span");
          titleNode.className = "site-tab-title";
          titleNode.textContent = title;

          const detailNode = document.createElement("span");
          detailNode.className = "site-tab-meta";
          detailNode.textContent = detail;

          copy.append(titleNode, detailNode);
          option.append(radio, copy);

          if (pillText) {
            const pill = document.createElement("span");
            pill.className = "site-tab-pill";
            pill.textContent = pillText;
            option.appendChild(pill);
          }

          radio.addEventListener("change", () => {
            if (!radio.checked) {
              return;
            }

            state.siteTargetSelections[site.id] = choiceValue;
            if (!checkbox.checked) {
              checkbox.checked = true;
              card.classList.add("checked");
            }
            deps.syncToggleAllLabel();
          });

          tabsList.appendChild(option);
        };

        appendTargetOption(
          "default",
          t.openTabsUseDefault,
          t.openTabsUseDefaultDetail(deps.getDefaultTargetModeLabel()),
        );
        appendTargetOption("new", t.openTabsAlwaysNew, t.openTabsAlwaysNewDetail);

        openTabs.forEach((tab) => {
          const detailText = previewText(tab.url || tab.title || "", 52);
          const pillText = tab.active
            ? t.openTabsActive
            : tab.status === "loading"
              ? t.openTabsLoading
              : t.openTabsReady;

          appendTargetOption(
            tab.tabId,
            previewText(tab.title || tab.url || `${site.name} tab`, 48),
            detailText,
            pillText,
          );
        });

        tabsWrap.append(tabsHead, tabsList);
        card.appendChild(tabsWrap);
      }

      const overrideToggleRow = document.createElement("div");
      overrideToggleRow.className = "site-override-toggle-row";

      const overrideToggle = document.createElement("button");
      const hasOverride = Boolean(state.sitePromptOverrides?.[site.id]?.trim());
      overrideToggle.className = `ghost-button small-button site-override-toggle${
        hasOverride ? " active" : ""
      }`;
      overrideToggle.type = "button";
      overrideToggle.dataset.siteOverrideToggle = site.id;
      overrideToggle.title =
        msg("popup_override_prompt_label") ||
        "Custom prompt for this service";
      overrideToggle.textContent = hasOverride
        ? `✎ ${msg("popup_override_active") || "Custom"}`
        : "✎";

      const overrideWrap = document.createElement("div");
      overrideWrap.className = "site-override-wrap";
      overrideWrap.hidden = !hasOverride;

      const overrideTextarea = document.createElement("textarea");
      overrideTextarea.className = "site-override-textarea";
      overrideTextarea.rows = 3;
      overrideTextarea.placeholder =
        msg("popup_override_prompt_placeholder") ||
        "Override prompt for this service only…";
      overrideTextarea.value = state.sitePromptOverrides?.[site.id] ?? "";
      overrideTextarea.dataset.siteOverrideInput = site.id;

      overrideTextarea.addEventListener("input", () => {
        state.sitePromptOverrides[site.id] = overrideTextarea.value;
        const nowActive = Boolean(overrideTextarea.value.trim());
        overrideToggle.classList.toggle("active", nowActive);
        overrideToggle.textContent = nowActive
          ? `✎ ${msg("popup_override_active") || "Custom"}`
          : "✎";
        renderTemplateSummary();
      });

      overrideToggle.addEventListener("click", () => {
        overrideWrap.hidden = !overrideWrap.hidden;
        if (!overrideWrap.hidden) {
          overrideTextarea.focus();
        }
      });

      overrideWrap.appendChild(overrideTextarea);
      overrideToggleRow.append(overrideToggle);
      card.append(overrideToggleRow, overrideWrap);

      sitesContainer.appendChild(card);
    });

    deps.syncToggleAllLabel();
    deps.setCardStatesFromBroadcast(state.lastBroadcast);
  }

  return {
    renderSiteCheckboxesPanel,
  };
}
