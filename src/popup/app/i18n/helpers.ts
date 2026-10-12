import type { ServiceTestRunResponse } from "../../../shared/types/messages";
import type { ImportSummary } from "../../../shared/types/models";
import { isKorean, msg } from "./core";
import { t } from "./catalog";

export function getUnknownErrorText(): string {
  return msg("popup_unknown_error");
}

export function buildImportSummaryText(
  summary: ImportSummary | null | undefined,
  { short = false }: { short?: boolean } = {},
): string {
  const acceptedCount = summary?.customSites?.acceptedIds?.length ?? 0;
  const rejectedCount = summary?.customSites?.rejected?.length ?? 0;
  const rewrittenCount = summary?.customSites?.rewrittenIds?.length ?? 0;
  const deniedCount = (summary?.customSites?.rejected ?? []).filter(
    (entry) => entry?.reason === "permission_denied",
  ).length;
  const overrideAdjustedCount =
    summary?.builtInSiteOverrides?.adjustedIds?.length ?? 0;
  const overrideDroppedCount =
    summary?.builtInSiteOverrides?.droppedIds?.length ?? 0;
  const stateDroppedCount = summary?.builtInSiteStates?.droppedIds?.length ?? 0;

  if (isKorean) {
    const parts = [
      `가져오기 완료: 직접 추가한 서비스 ${acceptedCount}개 적용`,
      rejectedCount > 0 ? `제외 ${rejectedCount}개` : "",
      rewrittenCount > 0 ? `ID 변경 ${rewrittenCount}개` : "",
      deniedCount > 0 ? `권한 거부 ${deniedCount}개` : "",
    ].filter(Boolean);

    if (!short && overrideAdjustedCount + overrideDroppedCount + stateDroppedCount > 0) {
      parts.push(
        `기본 서비스 조정 ${
          overrideAdjustedCount + overrideDroppedCount + stateDroppedCount
        }개`,
      );
    }

    return parts.join(", ");
  }

  const parts = [
    `Import complete: ${acceptedCount} custom service(s) applied`,
    rejectedCount > 0 ? `${rejectedCount} skipped` : "",
    rewrittenCount > 0 ? `${rewrittenCount} id rewrite(s)` : "",
    deniedCount > 0 ? `${deniedCount} permission denial(s)` : "",
  ].filter(Boolean);

  if (!short && overrideAdjustedCount + overrideDroppedCount + stateDroppedCount > 0) {
    parts.push(
      `${
        overrideAdjustedCount + overrideDroppedCount + stateDroppedCount
      } built-in adjustment(s)`,
    );
  }

  return parts.join(", ");
}

export function buildServiceTestResultMessage(
  response: ServiceTestRunResponse | null | undefined,
): { message: string; isError: boolean } {
  if (!response?.ok) {
    if (response?.reason === "validation_failed") {
      return {
        message: response.error || t.serviceValidationError,
        isError: true,
      };
    }

    if (response?.reason === "no_tab") {
      return {
        message: t.serviceTestNoTab,
        isError: true,
      };
    }

    if (response?.reason === "invalid_tab") {
      return {
        message: t.serviceTestInvalidTab,
        isError: true,
      };
    }

    return {
      message: t.serviceTestError(response?.error ?? getUnknownErrorText()),
      isError: true,
    };
  }

  if (!response?.input?.found) {
    return {
      message: `❌ ${t.serviceTestFail}`,
      isError: true,
    };
  }

  const lines: string[] = [];
  let isError = false;

  if (response.input.typeMatches === false) {
    isError = true;
    lines.push(
      `⚠ ${t.serviceTestTypeMismatch(
        response.input.actualType ?? "",
        response.input.expectedType ?? "",
      )}`,
    );
  } else {
    lines.push(`✅ ${t.serviceTestSuccess(response.input.actualType ?? "")}`);
  }

  if (response?.submit?.status === "ok") {
    lines.push(`✅ ${t.serviceTestSubmitOk}`);
  } else if (response?.submit?.status === "missing") {
    isError = true;
    lines.push(`❌ ${t.serviceTestSubmitMissing}`);
  } else if (response?.submit?.method) {
    lines.push(`ℹ ${t.serviceTestSubmitSkipped(response.submit.method)}`);
  }

  return {
    message: lines.join("\n"),
    isError,
  };
}
