// @ts-nocheck
// 중앙 사이트 레지스트리.
// injector.js / popup.js / background service worker가 모두 이 배열을 기준으로 동작하도록 설계한다.
// 셀렉터는 2026-03-30 기준 공개 웹앱 DOM을 바탕으로 한 best-effort 값이며,
// 외부 서비스 UI 변경 시 이 파일만 수정하면 되도록 구성한다.

export const AI_SITES = Object.freeze([
  {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chatgpt.com/",
    hostname: "chatgpt.com",
    inputSelector: "#prompt-textarea, div#prompt-textarea[contenteditable='true']",
    fallbackSelectors: [
      "#prompt-textarea",
      "div#prompt-textarea[contenteditable='true']",
      "div[contenteditable='true'][data-id='root']",
      "main div[contenteditable='true']",
    ],
    inputType: "contenteditable",
    submitSelector:
      "button[data-testid='send-button'], button[aria-label*='send' i], button[aria-label*='보내기' i]",
    submitMethod: "click",
    waitMs: 2000,
    fallback: true,
    lastVerified: "2026-03",
    verifiedVersion: "web-ui-mar-2026",
    authSelectors: [
      "button[data-testid='login-button']",
      "a[href*='/auth/login']",
      "button[aria-label*='log in' i]",
    ],
  },
  {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com/app",
    hostname: "gemini.google.com",
    inputSelector:
      "div.ql-editor.textarea.new-input-ui[contenteditable='true'], div.ql-editor[contenteditable='true'][role='textbox']",
    fallbackSelectors: [
      "div.ql-editor.textarea.new-input-ui[contenteditable='true']",
      "div.ql-editor[contenteditable='true'][role='textbox']",
      "div[contenteditable='true'][role='textbox']",
      "textarea, div[contenteditable='true']",
    ],
    inputType: "contenteditable",
    submitSelector:
      "button.send-button, button[aria-label*='send' i], button[aria-label*='보내기' i]",
    submitMethod: "click",
    waitMs: 2500,
    fallback: true,
    lastVerified: "2026-03",
    verifiedVersion: "gemini-app-mar-2026",
    authSelectors: [
      "a[href*='ServiceLogin']",
      "a[href*='accounts.google.com']",
    ],
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai/new",
    hostname: "claude.ai",
    inputSelector:
      "div[contenteditable='true'][aria-label='Write your prompt to Claude'], div[contenteditable='true'][role='textbox']",
    fallbackSelectors: [
      "div[contenteditable='true'][aria-label='Write your prompt to Claude']",
      "div[contenteditable='true'][role='textbox']",
      "div[contenteditable='true']",
      "textarea",
    ],
    inputType: "contenteditable",
    submitSelector:
      "button[aria-label='Send message'], button[aria-label*='send' i]",
    submitMethod: "click",
    waitMs: 1500,
    fallback: true,
    lastVerified: "2026-03",
    verifiedVersion: "claude-web-mar-2026",
    authSelectors: [
      "input#email",
      "form[action*='login']",
      "button[type='submit']",
    ],
  },
  {
    id: "grok",
    name: "Grok",
    url: "https://grok.com/",
    hostname: "grok.com",
    inputSelector:
      "textarea[aria-label*='grok' i], textarea[placeholder*='help' i], textarea",
    fallbackSelectors: [
      "textarea[aria-label*='grok' i]",
      "textarea[placeholder*='help' i]",
      "textarea",
      "div[contenteditable='true']",
    ],
    inputType: "textarea",
    submitSelector:
      "button[aria-label*='submit' i], button[aria-label*='제출' i]",
    submitMethod: "click",
    waitMs: 2000,
    fallback: true,
    lastVerified: "2026-03",
    verifiedVersion: "grok-web-mar-2026",
    authSelectors: [
      "a[href*='/sign-in']",
      "a[href*='/login']",
      "input[autocomplete='username']",
    ],
  },
]);

export default AI_SITES;
