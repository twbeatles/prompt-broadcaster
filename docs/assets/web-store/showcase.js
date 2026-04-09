const SCENES = {
  compose: {
    title: "Broadcast one prompt across multiple AI tabs",
    subtitle: "Launch ChatGPT, Gemini, Claude, and Grok from one focused popup without copy and paste loops.",
    caption: "Compose once, select targets, and start comparing replies faster.",
    chips: ["Multi-send", "No API key", "Selection capture"],
    renderPrimary: renderComposePrimary,
    renderSecondary: renderComposeSecondary,
  },
  favorites: {
    title: "Save reusable favorites and template defaults",
    subtitle: "Keep recurring prompts organized, store default variables, and reopen them from the popup in a few clicks.",
    caption: "Favorites and templates reduce repetitive setup for recurring workflows.",
    chips: ["Favorites", "Template variables", "Local storage only"],
    renderPrimary: renderFavoritesPrimary,
    renderSecondary: renderFavoritesSecondary,
  },
  "reuse-tabs": {
    title: "Reuse matching AI tabs already open in Chrome",
    subtitle: "The extension can detect supported tabs in the current window and send prompts without opening duplicates.",
    caption: "Current-window tab reuse keeps multi-service workflows tidy and fast.",
    chips: ["Open-tab reuse", "Per-service routing", "Host-limited access"],
    renderPrimary: renderReuseTabsPrimary,
    renderSecondary: renderReuseTabsSecondary,
  },
  dashboard: {
    title: "Review history, usage, and service activity",
    subtitle: "A full dashboard shows recent sends, service share, status trends, and data controls in one place.",
    caption: "The dashboard complements the popup with reporting, exports, and data controls.",
    chips: ["Dashboard", "Usage charts", "CSV export"],
    renderPrimary: renderDashboardPrimary,
    renderSecondary: renderDashboardSecondary,
  },
  "custom-service": {
    title: "Add custom AI services only when you need them",
    subtitle: "Create a user-defined service with selector testing, runtime host permission prompts, and per-site tuning.",
    caption: "Optional host permissions are requested only for user-added custom service origins.",
    chips: ["Custom services", "Selector test", "Runtime permissions"],
    renderPrimary: renderCustomServicePrimary,
    renderSecondary: renderCustomServiceSecondary,
  },
};

function popupHeader(activeTab) {
  const tabs = ["Compose", "History", "Favorites", "Settings"]
    .map((label) => `<div class="popup-tab${label === activeTab ? " active" : ""}">${label}</div>`)
    .join("");

  return `
    <div class="popup-header">
      <div class="popup-brand">
        <div class="popup-brand-mark">APB</div>
        <div class="popup-brand-copy">
          <strong>AI Prompt Broadcaster</strong>
          <span>One prompt, many AI tabs.</span>
        </div>
      </div>
    </div>
    <div class="popup-tabs">${tabs}</div>
  `;
}

function browserWindow(address, innerHtml) {
  return `
    <div class="browser-window">
      <div class="window-bar">
        <div class="window-dots"><span></span><span></span><span></span></div>
        <div class="window-address">${address}</div>
      </div>
      <div class="window-body">${innerHtml}</div>
    </div>
  `;
}

function mockServiceCard(name, badge, desc) {
  return `
    <div class="service-card">
      <div class="service-top">
        <strong>${name}</strong>
        <span class="badge">${badge}</span>
      </div>
      <span>${desc}</span>
    </div>
  `;
}

function renderComposePrimary() {
  const content = `
    <div class="popup-shell">
      ${popupHeader("Compose")}
      <div class="popup-content">
        <div class="toolbar-row">
          <span class="helper">Prompt length 398 / 2000</span>
          <span class="ghost-link">Clear prompt</span>
        </div>

        <div class="textarea-mock">Summarize the product positioning for this release, list the top 3 launch risks, and draft a short email update for stakeholders. Keep the tone direct and practical.</div>

        <div class="chip-line">
          <span class="tag">{{audience}}</span>
          <span class="tag">{{release_date}}</span>
          <span class="tag">{{clipboard}}</span>
        </div>

        <div class="section-head-row">
          <strong>Send to</strong>
          <span class="ghost-link">Select all</span>
        </div>

        <div class="service-grid">
          ${mockServiceCard("ChatGPT", "Selected", "Primary brainstorming workspace")}
          ${mockServiceCard("Gemini", "Selected", "Long-form synthesis and follow-up")}
          ${mockServiceCard("Claude", "Selected", "Structured reasoning and drafts")}
          ${mockServiceCard("Grok", "Selected", "Fast alternate framing")}
        </div>

        <div class="action-row">
          <span class="button ghost">Save favorite</span>
          <span class="button primary">Send prompt</span>
        </div>
      </div>
    </div>
  `;

  return browserWindow("chrome-extension://popup/popup.html", content);
}

function renderComposeSecondary() {
  return `
    <div class="card-stack">
      <div class="mock-card">
        <h3 class="side-title">What it does</h3>
        <p>Open supported AI web apps and insert the same prompt into each target from one popup.</p>
        <div class="soft-divider"></div>
        <ul>
          <li>Works with logged-in web apps</li>
          <li>Supports selected text capture from any page</li>
          <li>Stores history, favorites, and template values locally</li>
        </ul>
      </div>
      <div class="metric-row">
        <div class="metric-card"><strong>4</strong><span>Built-in AI services</span></div>
        <div class="metric-card"><strong>1</strong><span>Prompt composed once</span></div>
        <div class="metric-card"><strong>0</strong><span>Backend setup steps</span></div>
      </div>
      <div class="mock-card">
        <h4>Why the popup stays focused</h4>
        <p class="mini-note">The core send flow keeps prompt composition, service selection, and quick recovery actions in a single compact surface.</p>
      </div>
    </div>
  `;
}

function renderFavoritesPrimary() {
  const content = `
    <div class="popup-shell" style="position: relative;">
      ${popupHeader("Favorites")}
      <div class="popup-content">
        <div class="section-head-row">
          <strong>Favorite library</strong>
          <span class="ghost-link">Search saved prompts</span>
        </div>
        <div class="history-list">
          <div class="history-item">
            <strong>Release notes outline</strong>
            <span>Reusable structure for changelog summaries and customer notes</span>
          </div>
          <div class="history-item">
            <strong>Bug triage assistant</strong>
            <span>Ask each AI to classify severity, likely root cause, and test scope</span>
          </div>
          <div class="history-item">
            <strong>Stakeholder weekly brief</strong>
            <span>Summaries tuned for internal status updates and decision tracking</span>
          </div>
        </div>
      </div>
      <div class="modal-overlay">
        <div class="modal-card">
          <div class="inline-row">
            <div>
              <h3>Save favorite</h3>
              <p>Store the current prompt with reusable defaults.</p>
            </div>
            <span class="button ghost">Close</span>
          </div>

          <div class="field-stack">
            <div class="field-label">Favorite title</div>
            <div class="input-mock">Weekly launch analysis</div>
          </div>

          <div class="checkbox-line">
            <div class="checkbox active"></div>
            <span>Save template defaults with this favorite</span>
          </div>

          <div class="field-stack">
            <div class="field-label">Saved defaults</div>
            <div class="defaults-grid">
              <div class="default-pill"><strong>audience</strong><div>Product leadership</div></div>
              <div class="default-pill"><strong>tone</strong><div>Concise and direct</div></div>
              <div class="default-pill"><strong>timezone</strong><div>Asia/Seoul</div></div>
              <div class="default-pill"><strong>release_date</strong><div>2026-04-03</div></div>
            </div>
          </div>

          <div class="action-row" style="margin-top: 18px;">
            <span class="button ghost">Cancel</span>
            <span class="button primary">Save favorite</span>
          </div>
        </div>
      </div>
    </div>
  `;

  return browserWindow("chrome-extension://popup/favorites", content);
}

function renderFavoritesSecondary() {
  return `
    <div class="card-stack">
      <div class="mock-card">
        <h3 class="side-title">Reusable prompt building blocks</h3>
        <p>Favorites can keep title, full prompt text, and optional template defaults together.</p>
        <div class="chip-line" style="margin-top: 14px;">
          <span class="tag">{{project}}</span>
          <span class="tag">{{region}}</span>
          <span class="tag">{{release_date}}</span>
          <span class="tag">{{owner}}</span>
        </div>
      </div>
      <div class="mock-card">
        <h4>Local-only storage</h4>
        <p class="mini-note">Prompt history, favorites, template caches, and settings stay in browser storage unless the user sends a prompt to a selected AI site.</p>
      </div>
      <div class="mock-card">
        <h4>Ideal for</h4>
        <ul>
          <li>Daily review prompts</li>
          <li>Launch checklists</li>
          <li>Translation and rewrite workflows</li>
        </ul>
      </div>
    </div>
  `;
}

function renderReuseTabsPrimary() {
  const content = `
    <div class="browser-layout">
      <div class="settings-stack">
        <div class="toggle-card">
          <div class="toggle-line">
            <div>
              <strong>Reuse current-window AI tabs</strong>
              <p class="mini-note">Match already-open tabs before opening new ones.</p>
            </div>
            <div class="toggle-switch"></div>
          </div>
        </div>
        <div class="toggle-card">
          <strong>Per-service routing</strong>
          <div class="field-stack">
            <div class="field-label">ChatGPT</div>
            <div class="select-mock">Use tab: Sprint planning thread</div>
          </div>
          <div class="field-stack">
            <div class="field-label">Claude</div>
            <div class="select-mock">Use tab: Design review session</div>
          </div>
          <div class="field-stack">
            <div class="field-label">Gemini</div>
            <div class="select-mock">Open a new tab</div>
          </div>
        </div>
        <div class="toggle-card">
          <span class="badge teal">Current window scan</span>
          <p class="mini-note" style="margin-top: 12px;">Supported AI domains are checked for matching tabs in the active Chrome window only.</p>
        </div>
      </div>

      <div class="info-stack">
        <div class="mini-windows">
          <div class="mini-window">
            <div class="window-title">
              <strong>ChatGPT</strong>
              <span class="badge">Matched</span>
            </div>
            <div class="chat-line">Existing product strategy thread</div>
            <div class="chat-line">Latest prompt inserted here</div>
          </div>
          <div class="mini-window">
            <div class="window-title">
              <strong>Claude</strong>
              <span class="badge">Matched</span>
            </div>
            <div class="chat-line">Existing design review thread</div>
            <div class="chat-line">Ready to receive prompt</div>
          </div>
          <div class="mini-window">
            <div class="window-title">
              <strong>Gemini</strong>
              <span class="badge teal">New tab</span>
            </div>
            <div class="editor-box">A new supported tab will open because no matching tab was found in the current window.</div>
          </div>
          <div class="mini-window">
            <div class="window-title">
              <strong>Grok</strong>
              <span class="badge">Matched</span>
            </div>
            <div class="chat-line">Existing comparison thread</div>
            <div class="chat-line">Tab reused without duplication</div>
          </div>
        </div>
      </div>
    </div>
  `;

  return browserWindow("chrome-extension://popup/settings", content);
}

function renderReuseTabsSecondary() {
  return `
    <div class="card-stack">
      <div class="mock-card">
        <h3 class="side-title">Why host permissions exist</h3>
        <p>The extension needs access on supported AI domains so it can find editors, detect send buttons, and reuse already-open tabs on those sites.</p>
      </div>
      <div class="permission-list">
        <div class="permission-item">
          <strong>chatgpt.com</strong>
          <span>Prompt insertion and tab reuse</span>
        </div>
        <div class="permission-item">
          <strong>gemini.google.com</strong>
          <span>Prompt insertion and tab reuse</span>
        </div>
        <div class="permission-item">
          <strong>claude.ai</strong>
          <span>Prompt insertion and tab reuse</span>
        </div>
        <div class="permission-item">
          <strong>grok.com</strong>
          <span>Prompt insertion and tab reuse</span>
        </div>
      </div>
      <div class="mock-card">
        <h4>Scope stays narrow</h4>
        <p class="mini-note">No generic cross-site monitoring. Built-in host access is limited to supported AI websites, and optional access is requested only for user-added custom services.</p>
      </div>
    </div>
  `;
}

function renderDashboardPrimary() {
  const content = `
    <div class="dashboard-shell">
      <aside class="sidebar-shell">
        <div class="brand-mini">
          <div class="brand-mini-mark">APB</div>
          <div>
            <strong>AI Prompt Broadcaster</strong>
            <div class="helper" style="color: rgba(255,248,237,0.7);">Dashboard and analytics</div>
          </div>
        </div>
        <div class="nav-stack">
          <div class="nav-pill active">Dashboard</div>
          <div class="nav-pill">History</div>
          <div class="nav-pill">Services</div>
          <div class="nav-pill">Settings</div>
        </div>
      </aside>

      <div class="dashboard-main">
        <div class="section-intro">
          <h2>Dashboard</h2>
          <p>Review high-level usage metrics, service share, and recent broadcast activity.</p>
        </div>
        <div class="stat-grid">
          <div class="stat-card"><strong>184</strong><span>Total sends</span></div>
          <div class="stat-card"><strong>91%</strong><span>Success rate</span></div>
          <div class="stat-card"><strong>26</strong><span>Favorites saved</span></div>
          <div class="stat-card"><strong>7d</strong><span>Recent trend window</span></div>
        </div>
        <div class="chart-layout">
          <div class="chart-card">
            <h3>Sends in the last 7 days</h3>
            <div class="chart-bars">
              <span style="height: 54%;"></span>
              <span style="height: 68%;"></span>
              <span style="height: 42%;"></span>
              <span style="height: 72%;"></span>
              <span style="height: 88%;"></span>
              <span style="height: 64%;"></span>
              <span style="height: 76%;"></span>
            </div>
            <div class="table-shell">
              <div class="table-row"><strong>Prompt</strong><strong>Service</strong><strong>Status</strong><strong>When</strong></div>
              <div class="table-row"><span>Launch note summary</span><span>Claude</span><span>Sent</span><span>08:41</span></div>
              <div class="table-row"><span>Bug triage template</span><span>ChatGPT</span><span>Sent</span><span>08:44</span></div>
              <div class="table-row"><span>Stakeholder update</span><span>Gemini</span><span>Sent</span><span>09:10</span></div>
            </div>
          </div>
          <div class="chart-card">
            <h3>Service usage share</h3>
            <div class="donut-shell"></div>
            <div class="history-list">
              <div class="history-item"><strong>ChatGPT 30%</strong><span>Brainstorming and rewrites</span></div>
              <div class="history-item"><strong>Claude 28%</strong><span>Structured review and analysis</span></div>
              <div class="history-item"><strong>Gemini 20%</strong><span>Comparative summaries</span></div>
              <div class="history-item"><strong>Grok 22%</strong><span>Fast alternates and checks</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  return browserWindow("chrome-extension://options/options.html", content);
}

function renderDashboardSecondary() {
  return `
    <div class="card-stack">
      <div class="mock-card">
        <h3 class="side-title">Data controls</h3>
        <ul>
          <li>Clear local history and favorites</li>
          <li>Export CSV and JSON</li>
          <li>Adjust retention and notification behavior</li>
        </ul>
      </div>
      <div class="mock-card">
        <h4>Built for quick review</h4>
        <p class="mini-note">The dashboard summarizes recent sends without requiring a remote analytics backend.</p>
      </div>
      <div class="metric-row">
        <div class="metric-card"><strong>CSV</strong><span>History export</span></div>
        <div class="metric-card"><strong>JSON</strong><span>Backup and import</span></div>
        <div class="metric-card"><strong>Local</strong><span>Browser storage</span></div>
      </div>
    </div>
  `;
}

function renderCustomServicePrimary() {
  const content = `
    <div class="service-editor-shell">
      <div class="panel-block">
        <div class="inline-row">
          <div>
            <h3 style="margin: 0; font-size: 28px;">Add custom service</h3>
            <p style="margin: 8px 0 0; color: #655c52;">Configure the destination URL, selectors, and submit behavior.</p>
          </div>
          <span class="badge teal">Selector test ready</span>
        </div>

        <div class="form-grid" style="margin-top: 18px;">
          <div class="field-stack">
            <div class="field-label">Service name</div>
            <div class="input-mock">Perplexity Lab</div>
          </div>
          <div class="field-stack">
            <div class="field-label">URL</div>
            <div class="input-mock">https://labs.example.ai/chat</div>
          </div>
          <div class="field-stack full">
            <div class="field-label">Input selector</div>
            <div class="input-mock">div[contenteditable="true"][data-testid="composer"]</div>
          </div>
          <div class="field-stack">
            <div class="field-label">Input type</div>
            <div class="select-mock">contenteditable</div>
          </div>
          <div class="field-stack">
            <div class="field-label">Submit method</div>
            <div class="select-mock">click</div>
          </div>
          <div class="field-stack full">
            <div class="field-label">Submit selector</div>
            <div class="input-mock">button[data-testid="send"]</div>
          </div>
          <div class="field-stack full">
            <div class="field-label">Fallback selectors</div>
            <div class="textarea-mock" style="min-height: 92px;">textarea.prompt-box
[role="textbox"]
main form div[contenteditable="true"]</div>
          </div>
          <div class="field-stack full">
            <div class="field-label">Wait before submit</div>
            <div class="range-bar"></div>
            <div class="helper">2000 ms</div>
          </div>
        </div>

        <div class="action-row" style="margin-top: 18px;">
          <span class="button ghost">Cancel</span>
          <span class="button dark">Test selector</span>
          <span class="button primary">Save service</span>
        </div>
      </div>

      <div class="info-stack">
        <div class="permission-callout">
          <strong>Optional host permission</strong>
          <p class="mini-note">The extension asks for the exact origin only after the user adds this custom service.</p>
        </div>
        <div class="mock-card">
          <h4>Verification snapshot</h4>
          <div class="service-list">
            <div class="service-list-item">
              <strong>Input selector found</strong>
              <span>1 matching editable node on active tab</span>
            </div>
            <div class="service-list-item">
              <strong>Submit control found</strong>
              <span>Nearest visible send button selected</span>
            </div>
            <div class="service-list-item">
              <strong>Permission status</strong>
              <span>Requested only for labs.example.ai</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  return browserWindow("chrome-extension://popup/service-editor", content);
}

function renderCustomServiceSecondary() {
  return `
    <div class="card-stack">
      <div class="mock-card">
        <h3 class="side-title">Runtime permission flow</h3>
        <p>Optional host access is declared in the manifest so the extension can request the exact origin of a user-added custom AI service at runtime.</p>
      </div>
      <div class="mock-card">
        <h4>Why this matters</h4>
        <ul>
          <li>No extra host access is granted until the user approves it</li>
          <li>Selector testing and automation stay tied to the user-specified domain</li>
          <li>Built-in support remains limited to the main supported AI sites</li>
        </ul>
      </div>
      <div class="metric-row">
        <div class="metric-card"><strong>Exact</strong><span>Origin-scoped request</span></div>
        <div class="metric-card"><strong>Local</strong><span>Saved in browser settings</span></div>
        <div class="metric-card"><strong>Manual</strong><span>User approval required</span></div>
      </div>
    </div>
  `;
}

function renderScene(sceneId) {
  const scene = SCENES[sceneId] ?? SCENES.compose;
  document.title = `${scene.title} - AI Prompt Broadcaster`;
  document.body.classList.add(`scene-${sceneId}`);
  document.getElementById("scene-title").textContent = scene.title;
  document.getElementById("scene-subtitle").textContent = scene.subtitle;
  document.getElementById("scene-caption").textContent = scene.caption;
  document.getElementById("scene-chips").innerHTML = scene.chips.map((chip) => `<span class="chip">${chip}</span>`).join("");
  document.getElementById("primary-stage").innerHTML = scene.renderPrimary();
  document.getElementById("secondary-stage").innerHTML = scene.renderSecondary();
}

const sceneId = new URLSearchParams(window.location.search).get("scene") || "compose";
renderScene(sceneId);
