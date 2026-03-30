// @ts-nocheck
/**
 * XSS 방지를 위한 HTML 특수문자 이스케이프
 * @param {string} str - 사용자 입력 문자열
 * @returns {string} - 안전하게 이스케이프 처리된 문자열
 */
export function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/**
 * 사용자 추가 서비스 URL의 유효성 검사
 * 지정된 프로토콜(http/https)만 허용합니다. (Javascript: URL 등 방지)
 * @param {string} string - 검증할 URL 문자열
 * @returns {boolean} - 유효 여부
 */
export function isValidURL(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}
