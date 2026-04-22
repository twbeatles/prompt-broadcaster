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
      `가져오기 완료: 커스텀 서비스 ${acceptedCount}개 적용`,
      rejectedCount > 0 ? `건너뜀 ${rejectedCount}개` : "",
      rewrittenCount > 0 ? `ID 재작성 ${rewrittenCount}개` : "",
      deniedCount > 0 ? `권한 거부 ${deniedCount}개` : "",
    ].filter(Boolean);

    if (!short && overrideAdjustedCount + overrideDroppedCount + stateDroppedCount > 0) {
      parts.push(
        `기본 서비스 보정 ${
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
      isKorean
        ? `⚠ 입력창은 찾았지만 타입이 다릅니다. 실제: ${response.input.actualType}, 기대: ${response.input.expectedType}`
        : `⚠ Input found but type mismatched. Actual: ${response.input.actualType}, expected: ${response.input.expectedType}`,
    );
  } else {
    lines.push(`✅ ${t.serviceTestSuccess(response.input.actualType ?? "")}`);
  }

  if (response?.submit?.status === "ok") {
    lines.push(
      isKorean ? "✅ 전송 버튼도 확인했습니다." : "✅ Submit target was also found.",
    );
  } else if (response?.submit?.status === "missing") {
    isError = true;
    lines.push(
      isKorean
        ? "❌ 임시 probe 입력 후에도 전송 버튼을 찾지 못했습니다."
        : "❌ Submit selector was not found after the temporary probe.",
    );
  } else if (response?.submit?.method) {
    lines.push(
      isKorean
        ? `ℹ ${response.submit.method} 전송 방식이라 버튼 검사는 건너뛰었습니다.`
        : `ℹ Submit-button validation was skipped for ${response.submit.method} submit.`,
    );
  }

  return {
    message: lines.join("\n"),
    isError,
  };
}
