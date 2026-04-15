/**
 * XSS 방지를 위한 HTML 특수문자 이스케이프
 */
export function escapeHTML(str: string): string {
  if (typeof str !== "string") {
    return "";
  }

  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/**
 * 사용자 추가 서비스 URL의 유효성 검사
 * 지정된 프로토콜(http/https)만 허용합니다.
 */
export function isValidURL(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}
