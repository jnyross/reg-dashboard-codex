const API_BASE = `${window.location.origin}/api`;

const state = {
  currentPage: 1,
  currentFilters: {},
  chartInstances: {},
  allJurisdictions: [],
  savedSearches: [],
  lastHighRiskCheck: null,
};

const FLAG_MAP = {
  "United States": "🇺🇸",
  "United Kingdom": "🇬🇧",
  "European Union": "🇪🇺",
  France: "🇫🇷",
  Germany: "🇩🇪",
  Italy: "🇮🇹",
  Spain: "🇪🇸",
  Ireland: "🇮🇪",
  Netherlands: "🇳🇱",
  Australia: "🇦🇺",
  Canada: "🇨🇦",
  India: "🇮🇳",
  Japan: "🇯🇵",
  "South Korea": "🇰🇷",
  Singapore: "🇸🇬",
  Brazil: "🇧🇷",
  Mexico: "🇲🇽",
  China: "🇨🇳",
  "New York": "🗽",
  California: "🌉",
  Texas: "🤠",
  Florida: "🌴",
};

function escapeHTML(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function getChiliHTML(score) {
  return "🌶️".repeat(Math.max(1, Math.min(Number(score) || 1, 5)));
}

function countryFlag(country) {
  return FLAG_MAP[country] || "🌍";
}

function formatDate(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatJurisdiction(item) {
  const country = item?.jurisdiction?.country || "Unknown";
  const stateValue = item?.jurisdiction?.state;
  if (stateValue) {
    return `${countryFlag(country)} ${stateValue}, ${country}`;
  }
  return `${countryFlag(country)} ${country}`;
}

function stageLabel(stage) {
  return (stage || "").replace(/_/g, " ");
}

function truncate(str, max) {
  if (!str || str.length <= max) return str || "";
  return `${str.slice(0, max)}…`;
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-8px)";
    toast.style.transition = "all 0.25s ease";
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

async function apiFetch(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `${response.status} ${response.statusText}`);
  }
  return response;
}

async function apiJson(endpoint, options = {}) {
  const response = await apiFetch(endpoint, options);
  return response.json();
}

function navigateTo(page) {
  const normalizedPage = page === "risk-map" ? "map" : page;

  document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
  document.querySelectorAll(".nav-item[data-page]").forEach((node) => node.classList.remove("active"));

  const pageEl = document.getElementById(`page-${normalizedPage}`);
  if (pageEl) pageEl.classList.add("active");

  const navEl = document.querySelector(`.nav-item[data-page='${normalizedPage}']`);
  if (navEl) navEl.classList.add("active");

  document.getElementById("sidebar")?.classList.remove("open");
  localStorage.setItem("codex-current-page", normalizedPage);

  if (normalizedPage === "dashboard") loadDashboard();
  if (normalizedPage === "events") loadEvents(1);
  if (normalizedPage === "map") loadRiskMap();
  if (normalizedPage === "competitors") loadCompetitors();
  if (normalizedPage === "reports") loadSavedSearches();
}

function toggleSidebar() {
  document.getElementById("sidebar")?.classList.toggle("open");
}

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme") || "light";
  const next = current === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  localStorage.setItem("codex-theme", next);

  const icon = next === "dark" ? "☀️" : "🌙";
  const label = next === "dark" ? "Light Mode" : "Dark Mode";
  const iconEl = document.getElementById("theme-icon");
  const labelEl = document.getElementById("theme-label");
  const mobileBtn = document.getElementById("mobile-theme-btn");
  if (iconEl) iconEl.textContent = icon;
  if (labelEl) labelEl.textContent = label;
  if (mobileBtn) mobileBtn.textContent = icon;

  loadDashboardCharts();
}

function loadSavedTheme() {
  const saved = localStorage.getItem("codex-theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  const icon = saved === "dark" ? "☀️" : "🌙";
  const label = saved === "dark" ? "Light Mode" : "Dark Mode";
  const iconEl = document.getElementById("theme-icon");
  const labelEl = document.getElementById("theme-label");
  const mobileBtn = document.getElementById("mobile-theme-btn");
  if (iconEl) iconEl.textContent = icon;
  if (labelEl) labelEl.textContent = label;
  if (mobileBtn) mobileBtn.textContent = icon;
}

async function loadDashboard() {
  await Promise.all([loadSummaryStats(), loadBrief(), loadDashboardCharts(), loadCrawlStatus(), checkHighRiskNotifications()]);
}

async function loadSummaryStats() {
  try {
    const data = await apiJson("/analytics/summary");
    document.getElementById("stat-total").textContent = String(data.totalEvents || 0);
    document.getElementById("stat-avg-risk").textContent = Number(data.averageRiskScore || 0).toFixed(1);
    document.getElementById("stat-high-risk").textContent = String(data.highRiskCount || 0);
    document.getElementById("stat-top-jurisdiction").textContent = data.topJurisdiction || "—";
    if (data.lastCrawledAt) {
      const header = document.getElementById("header-last-crawl");
      if (header) header.textContent = `Last crawled: ${formatDateTime(data.lastCrawledAt)}`;
    }
  } catch (err) {
    console.error("Summary stats error", err);
  }
}

async function loadBrief() {
  try {
    const data = await apiJson("/brief?limit=5");
    const container = document.getElementById("brief-container");
    if (!container) return;

    if (!data.items?.length) {
      container.innerHTML = '<div class="empty-state">No priority events available.</div>';
      return;
    }

    container.innerHTML = data.items
      .map(
        (item) => `
      <article class="brief-card" onclick="showEventDetail('${item.id}')">
        <div class="card-header">
          <div class="card-title">${escapeHTML(item.title)}</div>
          <div class="chili">${getChiliHTML(item.scores?.chili || 1)}</div>
        </div>
        <div class="card-meta">
          <span class="tag">${escapeHTML(formatJurisdiction(item))}</span>
          <span class="stage-badge stage-${item.stage}">${stageLabel(item.stage)}</span>
          <span class="tag">${escapeHTML(item.ageBracket || "both")}</span>
        </div>
        <div class="card-summary">${escapeHTML(item.summary || "No summary available")}</div>
        <div class="card-footer">
          ${item.source?.url ? `<a href="${escapeHTML(item.source.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Source ↗</a>` : ""}
          <span class="muted">${formatDate(item.updatedAt)}</span>
        </div>
      </article>
    `,
      )
      .join("");
  } catch (err) {
    console.error("Brief load error", err);
    const container = document.getElementById("brief-container");
    if (container) container.innerHTML = '<div class="empty-state">Failed to load briefing.</div>';
  }
}

function destroyChart(key) {
  if (state.chartInstances[key]) {
    state.chartInstances[key].destroy();
    delete state.chartInstances[key];
  }
}

async function loadDashboardCharts() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const textColor = isDark ? "#cbd5e1" : "#475467";
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  try {
    const [trendPayload, riskPayload, jurPayload, stagePayload] = await Promise.all([
      apiJson("/analytics/trends"),
      apiJson("/analytics/risk-distribution"),
      apiJson("/analytics/jurisdictions"),
      apiJson("/analytics/stages"),
    ]);

    renderTrendsChart(trendPayload.trends || [], textColor, gridColor);
    renderRiskChart(riskPayload.distribution || [], textColor);
    renderJurisdictionChart(jurPayload.jurisdictions || [], textColor, gridColor);
    renderStageChart(stagePayload.stages || [], textColor);
  } catch (err) {
    console.error("Chart load error", err);
  }
}

function renderTrendsChart(trends, textColor, gridColor) {
  const canvas = document.getElementById("trends-chart");
  if (!canvas || typeof Chart === "undefined") return;
  destroyChart("trends");

  state.chartInstances.trends = new Chart(canvas, {
    type: "line",
    data: {
      labels: trends.map((entry) => entry.month),
      datasets: [
        {
          label: "Events",
          data: trends.map((entry) => entry.count),
          borderColor: "#4f46e5",
          backgroundColor: "rgba(79,70,229,0.12)",
          fill: true,
          tension: 0.3,
        },
        {
          label: "High risk",
          data: trends.map((entry) => entry.highRiskCount),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.12)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textColor } } },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true },
      },
    },
  });
}

function renderRiskChart(distribution, textColor) {
  const canvas = document.getElementById("risk-chart");
  if (!canvas || typeof Chart === "undefined") return;
  destroyChart("risk");

  state.chartInstances.risk = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: distribution.map((entry) => `${entry.score}🌶️`),
      datasets: [
        {
          data: distribution.map((entry) => entry.count),
          backgroundColor: ["#93c5fd", "#38bdf8", "#fcd34d", "#fb923c", "#f87171"],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor, usePointStyle: true },
          position: "bottom",
        },
      },
    },
  });
}

function renderJurisdictionChart(jurisdictions, textColor, gridColor) {
  const canvas = document.getElementById("jurisdiction-chart");
  if (!canvas || typeof Chart === "undefined") return;
  destroyChart("jurisdictions");

  const top = jurisdictions.slice(0, 10);
  state.chartInstances.jurisdictions = new Chart(canvas, {
    type: "bar",
    data: {
      labels: top.map((entry) => entry.country),
      datasets: [
        {
          label: "Events",
          data: top.map((entry) => entry.count),
          backgroundColor: top.map((entry) => (entry.avgRisk >= 4 ? "#ef4444" : entry.avgRisk >= 3 ? "#f59e0b" : "#60a5fa")),
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true },
        y: { ticks: { color: textColor }, grid: { display: false } },
      },
    },
  });
}

function renderStageChart(stages, textColor) {
  const canvas = document.getElementById("stage-chart");
  if (!canvas || typeof Chart === "undefined") return;
  destroyChart("stages");

  state.chartInstances.stages = new Chart(canvas, {
    type: "polarArea",
    data: {
      labels: stages.map((entry) => stageLabel(entry.stage)),
      datasets: [
        {
          data: stages.map((entry) => entry.count),
          backgroundColor: [
            "rgba(59,130,246,0.6)",
            "rgba(6,182,212,0.6)",
            "rgba(163,163,163,0.6)",
            "rgba(34,197,94,0.6)",
            "rgba(239,68,68,0.6)",
            "rgba(20,184,166,0.6)",
            "rgba(168,85,247,0.6)",
            "rgba(245,158,11,0.6)",
            "rgba(148,163,184,0.6)",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, usePointStyle: true }, position: "bottom" },
      },
    },
  });
}

async function loadCrawlStatus() {
  try {
    const data = await apiJson("/crawl/status");
    const statusEl = document.getElementById("crawl-status");
    if (!statusEl) return;

    const dot = statusEl.querySelector(".status-dot");
    const text = statusEl.querySelector(".status-text");
    if (text) {
      text.textContent = data.lastCrawledAt
        ? `${data.totalEvents} production events · last crawl ${formatDateTime(data.lastCrawledAt)}`
        : `${data.totalEvents} production events`;
    }

    if (dot) {
      if (data.status === "completed") dot.style.background = "var(--success)";
      else if (data.status === "partial") dot.style.background = "var(--warning)";
      else if (data.status === "failed") dot.style.background = "var(--danger)";
      else dot.style.background = "var(--text-muted)";
    }

    const header = document.getElementById("header-last-crawl");
    if (header && data.lastCrawledAt) {
      header.textContent = `Last crawled: ${formatDateTime(data.lastCrawledAt)}`;
    }
  } catch (err) {
    console.error("Crawl status error", err);
  }
}

function collectFiltersFromUI() {
  state.currentFilters = {
    search: document.getElementById("search-input")?.value?.trim() || "",
    jurisdiction: document.getElementById("filter-jurisdiction")?.value || "",
    stage: document.getElementById("filter-stage")?.value || "",
    minRisk: document.getElementById("filter-min-risk")?.value || "",
    ageBracket: document.getElementById("filter-age")?.value || "",
    sortBy: document.getElementById("filter-sort")?.value || "updated_at",
    dateFrom: document.getElementById("filter-date-from")?.value || "",
    dateTo: document.getElementById("filter-date-to")?.value || "",
  };
}

function applyFilters() {
  collectFiltersFromUI();
  localStorage.setItem("codex-filters", JSON.stringify(state.currentFilters));
  loadEvents(1);
}

function clearFilters() {
  state.currentFilters = {};
  [
    "search-input",
    "filter-jurisdiction",
    "filter-stage",
    "filter-min-risk",
    "filter-age",
    "filter-date-from",
    "filter-date-to",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const sortEl = document.getElementById("filter-sort");
  if (sortEl) sortEl.value = "updated_at";

  localStorage.removeItem("codex-filters");
  loadEvents(1);
}

function restoreFilters() {
  const raw = localStorage.getItem("codex-filters");
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    state.currentFilters = parsed;
    if (parsed.search) document.getElementById("search-input").value = parsed.search;
    if (parsed.jurisdiction) document.getElementById("filter-jurisdiction").value = parsed.jurisdiction;
    if (parsed.stage) document.getElementById("filter-stage").value = parsed.stage;
    if (parsed.minRisk) document.getElementById("filter-min-risk").value = parsed.minRisk;
    if (parsed.ageBracket) document.getElementById("filter-age").value = parsed.ageBracket;
    if (parsed.sortBy) document.getElementById("filter-sort").value = parsed.sortBy;
    if (parsed.dateFrom) document.getElementById("filter-date-from").value = parsed.dateFrom;
    if (parsed.dateTo) document.getElementById("filter-date-to").value = parsed.dateTo;
  } catch {
    // no-op
  }
}

function buildEventQuery(page = 1) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", "15");

  const filters = state.currentFilters;
  if (filters.search) params.set("search", filters.search);
  if (filters.jurisdiction) params.set("jurisdiction", filters.jurisdiction);
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.minRisk) params.set("minRisk", filters.minRisk);
  if (filters.ageBracket) params.set("ageBracket", filters.ageBracket);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);

  return params.toString();
}

async function loadEvents(page = 1) {
  state.currentPage = page;
  try {
    const data = await apiJson(`/events?${buildEventQuery(page)}`);
    state.eventsCache = data.items || [];
    renderEventsTable(data);
    renderPagination(data);

    const countEl = document.getElementById("events-count");
    if (countEl) {
      countEl.textContent = `Showing ${data.items.length} of ${data.total} events (page ${data.page}/${data.totalPages})`;
    }

    if (state.allJurisdictions.length === 0) {
      await loadJurisdictions();
    }
  } catch (err) {
    console.error("Events error", err);
    document.getElementById("events-container").innerHTML = '<div class="empty-state">Failed to load events.</div>';
  }
}

async function loadJurisdictions() {
  try {
    const data = await apiJson("/jurisdictions");
    state.allJurisdictions = data.countries || [];
    const select = document.getElementById("filter-jurisdiction");
    if (!select) return;

    const current = select.value;
    select.innerHTML = '<option value="">All jurisdictions</option>';
    state.allJurisdictions.forEach((country) => {
      select.innerHTML += `<option value="${escapeHTML(country)}">${countryFlag(country)} ${escapeHTML(country)}</option>`;
    });
    if (current) select.value = current;
  } catch (err) {
    console.error("Jurisdiction load error", err);
  }
}

function renderEventsTable(data) {
  const container = document.getElementById("events-container");
  if (!container) return;

  if (!data.items?.length) {
    container.innerHTML = '<div class="empty-state">No events match these filters.</div>';
    return;
  }

  container.innerHTML = `
    <table class="events-table" role="table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Jurisdiction</th>
          <th>Stage</th>
          <th>Age</th>
          <th>Risk</th>
          <th>Source</th>
          <th>Updated</th>
          <th>Quality</th>
          <th>Feedback</th>
        </tr>
      </thead>
      <tbody>
        ${data.items
          .map(
            (item) => `
          <tr>
            <td class="title-cell"><a href="#" onclick="showEventDetail('${item.id}'); return false;">${escapeHTML(item.title)}</a></td>
            <td>${escapeHTML(formatJurisdiction(item))}</td>
            <td><span class="stage-badge stage-${item.stage}">${stageLabel(item.stage)}</span></td>
            <td><span class="tag">${escapeHTML(item.ageBracket || "both")}</span></td>
            <td class="chili-cell">${getChiliHTML(item.scores?.chili || 1)}</td>
            <td>${
              item.source?.url
                ? `<a href="${escapeHTML(item.source.url)}" target="_blank" rel="noopener">${escapeHTML(truncate(item.source.name, 26))}</a>`
                : escapeHTML(item.source?.name || "Unknown")
            }</td>
            <td>${formatDate(item.updatedAt)}</td>
            <td>${item.quality?.lowQuality ? "⚠️ filtered" : "✅ good"}</td>
            <td>
              <div class="feedback-cell">
                <button class="feedback-btn good" onclick="submitFeedback('${item.id}', 'good')">👍</button>
                <button class="feedback-btn bad" onclick="submitFeedback('${item.id}', 'bad')">👎</button>
              </div>
            </td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderPagination(data) {
  const container = document.getElementById("pagination");
  if (!container) return;
  if (data.totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = "";
  if (data.page > 1) html += `<button onclick="loadEvents(${data.page - 1})">← Prev</button>`;

  const maxPages = 7;
  let start = Math.max(1, data.page - Math.floor(maxPages / 2));
  let end = Math.min(data.totalPages, start + maxPages - 1);
  if (end - start < maxPages - 1) start = Math.max(1, end - maxPages + 1);

  if (start > 1) html += `<button onclick="loadEvents(1)">1</button>`;
  if (start > 2) html += `<button disabled>…</button>`;

  for (let i = start; i <= end; i += 1) {
    html += `<button class="${i === data.page ? "active" : ""}" onclick="loadEvents(${i})">${i}</button>`;
  }

  if (end < data.totalPages - 1) html += `<button disabled>…</button>`;
  if (end < data.totalPages) html += `<button onclick="loadEvents(${data.totalPages})">${data.totalPages}</button>`;
  if (data.page < data.totalPages) html += `<button onclick="loadEvents(${data.page + 1})">Next →</button>`;

  container.innerHTML = html;
}

async function saveCurrentSearch() {
  collectFiltersFromUI();
  const name = window.prompt("Saved search name:");
  if (!name) return;

  try {
    await apiFetch("/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), filters: state.currentFilters }),
    });
    showToast("Saved search created", "success");
    loadSavedSearches();
  } catch (err) {
    showToast(`Failed to save search: ${err.message}`, "error");
  }
}

async function loadSavedSearches() {
  const container = document.getElementById("saved-searches");
  if (!container) return;

  try {
    const data = await apiJson("/saved-searches");
    state.savedSearches = data.items || [];
    if (!state.savedSearches.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = state.savedSearches
      .map(
        (entry) => `
      <div class="saved-search-chip">
        <button onclick="applySavedSearch(${entry.id})">🔎 ${escapeHTML(entry.name)}</button>
        <button title="Delete" onclick="deleteSavedSearch(${entry.id})">✕</button>
      </div>
    `,
      )
      .join("");
  } catch (err) {
    console.error("Saved search load error", err);
  }
}

function applySavedSearch(id) {
  const saved = state.savedSearches.find((entry) => entry.id === id);
  if (!saved) return;

  state.currentFilters = saved.filters || {};
  if (state.currentFilters.search) document.getElementById("search-input").value = state.currentFilters.search;
  document.getElementById("filter-jurisdiction").value = state.currentFilters.jurisdiction || "";
  document.getElementById("filter-stage").value = state.currentFilters.stage || "";
  document.getElementById("filter-min-risk").value = state.currentFilters.minRisk || "";
  document.getElementById("filter-age").value = state.currentFilters.ageBracket || "";
  document.getElementById("filter-sort").value = state.currentFilters.sortBy || "updated_at";
  document.getElementById("filter-date-from").value = state.currentFilters.dateFrom || "";
  document.getElementById("filter-date-to").value = state.currentFilters.dateTo || "";

  localStorage.setItem("codex-filters", JSON.stringify(state.currentFilters));
  showToast(`Applied saved search: ${saved.name}`, "success");
  loadEvents(1);
}

async function deleteSavedSearch(id) {
  try {
    await apiFetch(`/saved-searches/${id}`, { method: "DELETE" });
    showToast("Saved search deleted", "success");
    loadSavedSearches();
  } catch (err) {
    showToast(`Failed to delete search: ${err.message}`, "error");
  }
}

async function showEventDetail(eventId) {
  const modal = document.getElementById("event-modal");
  const body = document.getElementById("modal-body");
  const title = document.getElementById("modal-title");

  if (!modal || !body || !title) return;

  modal.classList.add("active");
  body.innerHTML = '<div class="empty-state">Loading event details...</div>';
  title.textContent = "Loading...";

  try {
    const event = await apiJson(`/events/${eventId}`);
    title.textContent = event.title;

    body.innerHTML = `
      <div class="detail-grid">
        <div class="detail-field"><div class="detail-label">Jurisdiction</div><div class="detail-value">${escapeHTML(formatJurisdiction(event))}</div></div>
        <div class="detail-field"><div class="detail-label">Stage</div><div class="detail-value"><span class="stage-badge stage-${event.stage}">${stageLabel(event.stage)}</span></div></div>
        <div class="detail-field"><div class="detail-label">Risk</div><div class="detail-value">${getChiliHTML(event.scores?.chili || 1)} (${event.scores?.chili || 1}/5)</div></div>
        <div class="detail-field"><div class="detail-label">Age Bracket</div><div class="detail-value">${escapeHTML(event.ageBracket || "both")}</div></div>
        <div class="detail-field"><div class="detail-label">Impact</div><div class="detail-value">${event.scores?.impact || 1}/5</div></div>
        <div class="detail-field"><div class="detail-label">Likelihood</div><div class="detail-value">${event.scores?.likelihood || 1}/5</div></div>
        <div class="detail-field"><div class="detail-label">Confidence</div><div class="detail-value">${event.scores?.confidence || 1}/5</div></div>
        <div class="detail-field"><div class="detail-label">Under-16 applicable</div><div class="detail-value">${event.isUnder16Applicable ? "✅ Yes" : "❌ No"}</div></div>
        <div class="detail-field"><div class="detail-label">Published</div><div class="detail-value">${formatDate(event.publishedDate)}</div></div>
        <div class="detail-field"><div class="detail-label">Effective</div><div class="detail-value">${formatDate(event.effectiveDate)}</div></div>

        <div class="detail-field full-width"><div class="detail-label">Summary</div><div class="detail-value">${escapeHTML(event.summary || "No summary available")}</div></div>
        <div class="detail-field full-width"><div class="detail-label">Business Impact</div><div class="detail-value">${escapeHTML(event.businessImpact || "Not available")}</div></div>

        ${
          event.requiredSolutions?.length
            ? `<div class="detail-field full-width"><div class="detail-label">Required Solutions</div><div class="detail-value">${event.requiredSolutions.map((entry) => `<span class="tag">${escapeHTML(entry)}</span>`).join(" ")}</div></div>`
            : ""
        }

        ${
          event.affectedProducts?.length
            ? `<div class="detail-field full-width"><div class="detail-label">Affected Products</div><div class="detail-value">${event.affectedProducts.map((entry) => `<span class="tag">${escapeHTML(entry)}</span>`).join(" ")}</div></div>`
            : ""
        }

        ${
          event.competitorResponses?.length
            ? `<div class="detail-field full-width"><div class="detail-label">Competitor Responses</div><div class="detail-value">${event.competitorResponses.map((entry) => `• ${escapeHTML(entry)}`).join("<br>")}</div></div>`
            : ""
        }

        <div class="detail-field"><div class="detail-label">Source</div><div class="detail-value">${
          event.source?.url
            ? `<a href="${escapeHTML(event.source.url)}" target="_blank" rel="noopener">${escapeHTML(event.source.name)} ↗</a>`
            : escapeHTML(event.source?.name || "Unknown")
        }</div></div>
        <div class="detail-field"><div class="detail-label">Updated</div><div class="detail-value">${formatDateTime(event.updatedAt)}</div></div>
      </div>

      ${
        event.statusHistory?.length
          ? `<div class="detail-section-title">📜 Regulatory Timeline</div>
             <div class="timeline-list">
               ${event.statusHistory
                 .map(
                   (entry) => `<div class="timeline-item"><span class="stage-badge stage-${entry.previousStage}">${stageLabel(entry.previousStage)}</span><span>→</span><span class="stage-badge stage-${entry.newStage}">${stageLabel(entry.newStage)}</span><span class="timeline-date">${formatDate(entry.changedAt)}</span></div>`,
                 )
                 .join("")}
             </div>`
          : ""
      }

      ${
        event.feedback?.length
          ? `<div class="detail-section-title">💬 Feedback</div>
             <div class="timeline-list">
               ${event.feedback
                 .map(
                   (entry) => `<div class="timeline-item"><span>${entry.rating === "good" ? "👍" : "👎"}</span><span>${escapeHTML(entry.note || "No note")}</span><span class="timeline-date">${formatDate(entry.createdAt)}</span></div>`,
                 )
                 .join("")}
             </div>`
          : ""
      }

      ${
        event.annotations?.length
          ? `<div class="detail-section-title">📝 Analyst Notes</div>
             <div class="timeline-list">
               ${event.annotations
                 .map(
                   (entry) => `<div class="timeline-item"><span>🗒️</span><span>${escapeHTML(entry.note)}</span><span class="timeline-date">${escapeHTML(entry.author || "analyst")}, ${formatDate(entry.createdAt)}</span></div>`,
                 )
                 .join("")}
             </div>`
          : ""
      }

      ${
        event.relatedEvents?.length
          ? `<div class="detail-section-title">🔗 Related Events</div>
             <div class="related-events-list">
               ${event.relatedEvents
                 .map(
                   (entry) => `<div class="related-event-item" onclick="showEventDetail('${entry.id}')"><span class="related-event-title">${escapeHTML(entry.title)}</span><span>${getChiliHTML(entry.scores?.chili || 1)}</span><span class="stage-badge stage-${entry.stage}">${stageLabel(entry.stage)}</span></div>`,
                 )
                 .join("")}
             </div>`
          : ""
      }

      <div class="button-row" style="margin-top:16px">
        <button class="btn" onclick="submitFeedback('${eventId}', 'good')">👍 Good Data</button>
        <button class="btn secondary" onclick="submitFeedback('${eventId}', 'bad')">👎 Bad Data</button>
        <button class="btn secondary" onclick="editEvent('${eventId}')">✏️ Edit Event</button>
      </div>
    `;
  } catch (err) {
    console.error("Event detail error", err);
    title.textContent = "Error";
    body.innerHTML = '<div class="empty-state">Failed to load event detail.</div>';
  }
}

function closeModal() {
  document.getElementById("event-modal")?.classList.remove("active");
}

function closeModalOverlay(event) {
  if (event.target === event.currentTarget) closeModal();
}

async function editEvent(eventId) {
  const summary = window.prompt("Update summary (leave blank to skip):");
  const businessImpact = window.prompt("Update business impact (leave blank to skip):");
  const stage = window.prompt("Update stage (optional): proposed|introduced|committee_review|passed|enacted|effective|amended|withdrawn|rejected");
  const annotation = window.prompt("Add analyst note (optional):");

  const payload = {};
  if (summary && summary.trim()) payload.summary = summary.trim();
  if (businessImpact && businessImpact.trim()) payload.businessImpact = businessImpact.trim();
  if (stage && stage.trim()) payload.stage = stage.trim();
  if (annotation && annotation.trim()) payload.annotation = annotation.trim();

  if (!Object.keys(payload).length) {
    showToast("No changes submitted", "info");
    return;
  }

  try {
    await apiFetch(`/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    showToast("Event updated", "success");
    await showEventDetail(eventId);
    loadEvents(state.currentPage);
    loadDashboard();
  } catch (err) {
    showToast(`Failed to update event: ${err.message}`, "error");
  }
}

async function submitFeedback(eventId, rating) {
  try {
    await apiFetch(`/events/${eventId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    });
    showToast("Feedback submitted", "success");
  } catch (err) {
    showToast(`Feedback failed: ${err.message}`, "error");
  }
}

async function loadRiskMap() {
  try {
    const data = await apiJson("/analytics/jurisdictions");
    const grid = document.getElementById("heatmap-grid");
    if (!grid) return;

    if (!data.jurisdictions?.length) {
      grid.innerHTML = '<div class="empty-state">No jurisdiction data available.</div>';
      return;
    }

    grid.innerHTML = data.jurisdictions
      .map((item) => {
        const risk = Math.max(1, Math.min(5, Math.round(item.avgRisk || 1)));
        return `
          <div class="heatmap-tile risk-bg-${risk}" onclick="filterByJurisdiction('${escapeHTML(item.country)}')">
            <div class="tile-country">${countryFlag(item.country)} ${escapeHTML(item.country)}</div>
            <div class="tile-count">${item.count} events · Avg ${Number(item.avgRisk || 0).toFixed(1)}🌶️</div>
            <div class="tile-risk">${getChiliHTML(risk)}</div>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    console.error("Risk map error", err);
    document.getElementById("heatmap-grid").innerHTML = '<div class="empty-state">Failed to load heatmap.</div>';
  }
}

function filterByJurisdiction(country) {
  document.getElementById("filter-jurisdiction").value = country;
  collectFiltersFromUI();
  navigateTo("events");
  loadEvents(1);
}

async function loadCompetitors() {
  try {
    const data = await apiJson("/events?limit=120&sortBy=risk_desc");
    const bucket = {};

    data.items.forEach((event) => {
      (event.competitorResponses || []).forEach((response) => {
        const match = response.match(/^([^:]+):\s*(.+)$/);
        if (!match) return;
        const name = match[1].trim();
        if (!bucket[name]) bucket[name] = [];
        bucket[name].push({
          response: match[2].trim(),
          title: event.title,
          eventId: event.id,
          jurisdiction: formatJurisdiction(event),
          risk: event.scores?.chili || 1,
        });
      });
    });

    const container = document.getElementById("competitors-container");
    if (!container) return;

    const names = Object.keys(bucket).sort();
    if (!names.length) {
      container.innerHTML = '<div class="empty-state">No competitor intelligence available yet.</div>';
      return;
    }

    container.innerHTML = `
      <table class="competitor-table">
        <thead>
          <tr>
            <th>Competitor</th>
            <th>Response</th>
            <th>Event</th>
            <th>Jurisdiction</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          ${names
            .flatMap((name) =>
              bucket[name].map(
                (entry, index) => `
              <tr>
                ${index === 0 ? `<td rowspan="${bucket[name].length}"><strong>${escapeHTML(name)}</strong></td>` : ""}
                <td>${escapeHTML(entry.response)}</td>
                <td><a href="#" onclick="showEventDetail('${entry.eventId}'); return false;">${escapeHTML(truncate(entry.title, 45))}</a></td>
                <td>${escapeHTML(entry.jurisdiction)}</td>
                <td>${getChiliHTML(entry.risk)}</td>
              </tr>
            `,
              ),
            )
            .join("")}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error("Competitor error", err);
    document.getElementById("competitors-container").innerHTML = '<div class="empty-state">Failed to load competitor view.</div>';
  }
}

function exportCsv() {
  const params = new URLSearchParams();
  const filters = state.currentFilters;
  if (filters.search) params.set("search", filters.search);
  if (filters.jurisdiction) params.set("jurisdiction", filters.jurisdiction);
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.minRisk) params.set("minRisk", filters.minRisk);
  if (filters.ageBracket) params.set("ageBracket", filters.ageBracket);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);

  window.open(`${API_BASE}/export/csv?${params.toString()}`, "_blank");
  showToast("CSV export started", "success");
}

function exportPdf() {
  const params = new URLSearchParams();
  const filters = state.currentFilters;
  if (filters.search) params.set("search", filters.search);
  if (filters.jurisdiction) params.set("jurisdiction", filters.jurisdiction);
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.minRisk) params.set("minRisk", filters.minRisk);
  if (filters.ageBracket) params.set("ageBracket", filters.ageBracket);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);

  window.open(`${API_BASE}/export/pdf?${params.toString()}`, "_blank");
  showToast("PDF export started", "success");
}

function downloadText(content, filename) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function generateExecutiveBrief() {
  try {
    const data = await apiJson("/reports/executive");
    const content = `
CODEX EXECUTIVE BRIEF
Generated: ${formatDateTime(data.generatedAt)}
${"=".repeat(60)}

SUMMARY
- Total events: ${data.summary.totalEvents}
- Average risk score: ${data.summary.averageRiskScore}/5
- High-risk events (4-5🌶️): ${data.summary.highRiskCount}
- Top jurisdiction: ${data.summary.topJurisdiction} (${data.summary.topJurisdictionCount})

TOP EVENTS
${(data.topEvents || [])
  .map(
    (event, index) => `${index + 1}. [${event.scores?.chili || 1}🌶️] ${event.title}\n   ${formatJurisdiction(event)} · ${stageLabel(event.stage)}\n   ${event.summary || ""}`,
  )
  .join("\n\n")}

TRENDS (LAST 6 MONTHS)
${(data.trends || [])
  .map((entry) => `- ${entry.month}: ${entry.count} events (${entry.highRiskCount} high-risk)`)
  .join("\n")}
    `.trim();

    downloadText(content, `executive-brief-${new Date().toISOString().split("T")[0]}.txt`);
    showToast("Executive brief generated", "success");
  } catch (err) {
    showToast(`Failed to generate executive brief: ${err.message}`, "error");
  }
}

async function generateTrendReport() {
  try {
    const data = await apiJson("/reports/trends");
    const content = `
TREND ANALYSIS REPORT
Generated: ${formatDateTime(data.generatedAt)}
${"=".repeat(60)}

MONTHLY TREND
${(data.trends || [])
  .map((entry) => `- ${entry.month}: ${entry.count} events, ${entry.highRiskCount} high-risk, avg ${entry.avgRisk}`)
  .join("\n")}

STAGE DISTRIBUTION
${(data.stages || [])
  .map((entry) => `- ${stageLabel(entry.stage)}: ${entry.count} events (avg risk ${entry.avgRisk})`)
  .join("\n")}

TOP JURISDICTIONS
${(data.jurisdictions || [])
  .map((entry) => `- ${entry.country}: ${entry.count} events, avg risk ${entry.avgRisk}`)
  .join("\n")}
    `.trim();

    downloadText(content, `trend-report-${new Date().toISOString().split("T")[0]}.txt`);
    showToast("Trend report generated", "success");
  } catch (err) {
    showToast(`Failed to generate trend report: ${err.message}`, "error");
  }
}

async function generateJurisdictionReport() {
  const jurisdiction = window.prompt("Enter jurisdiction (e.g., United States, European Union)");
  if (!jurisdiction) return;

  try {
    const data = await apiJson(`/reports/jurisdiction/${encodeURIComponent(jurisdiction.trim())}`);
    const content = `
JURISDICTION REPORT: ${jurisdiction.toUpperCase()}
Generated: ${formatDateTime(data.generatedAt)}
${"=".repeat(60)}

SUMMARY
- Total events: ${data.summary.totalEvents}
- Average risk score: ${data.summary.averageRiskScore}
- High-risk events: ${data.summary.highRiskCount}

EVENTS
${(data.events || [])
  .map((event, index) => `${index + 1}. [${event.scores?.chili || 1}🌶️] ${event.title}\n   ${stageLabel(event.stage)} · ${formatDate(event.updatedAt)}\n   ${event.summary || ""}`)
  .join("\n\n")}
    `.trim();

    downloadText(
      content,
      `jurisdiction-${jurisdiction.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.txt`,
    );
    showToast("Jurisdiction report generated", "success");
  } catch (err) {
    showToast(`Failed to generate jurisdiction report: ${err.message}`, "error");
  }
}

async function runCrawl() {
  const button = document.getElementById("crawl-btn");
  const label = button?.querySelector(".nav-label");

  if (button) button.disabled = true;
  if (label) label.textContent = "Running...";
  showToast("Crawl started", "info");

  try {
    await apiFetch("/crawl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    showToast("Crawl completed", "success");
    await Promise.all([loadDashboard(), loadEvents(state.currentPage), loadCrawlStatus()]);
  } catch (err) {
    showToast(`Crawl failed: ${err.message}`, "error");
  } finally {
    if (button) button.disabled = false;
    if (label) label.textContent = "Run Crawl";
  }
}

async function checkHighRiskNotifications() {
  const since = state.lastHighRiskCheck;
  state.lastHighRiskCheck = new Date().toISOString();

  if (!since) return;

  try {
    const data = await apiJson(`/alerts/high-risk?minRisk=4&since=${encodeURIComponent(since)}`);
    if (!data.items?.length) return;

    showToast(`${data.items.length} new high-risk event${data.items.length > 1 ? "s" : ""} detected`, "info");
  } catch {
    // silent
  }
}

document.addEventListener("keydown", (event) => {
  const tag = event.target?.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

  if (event.key === "1") navigateTo("dashboard");
  if (event.key === "2") navigateTo("events");
  if (event.key === "3") navigateTo("map");
  if (event.key === "4") navigateTo("competitors");
  if (event.key === "5") navigateTo("reports");
  if (event.key === "Escape") closeModal();
  if (event.key === "/") {
    event.preventDefault();
    navigateTo("events");
    setTimeout(() => document.getElementById("search-input")?.focus(), 120);
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  loadSavedTheme();
  await loadJurisdictions();
  restoreFilters();

  document.querySelectorAll(".nav-item[data-page]").forEach((node) => {
    node.addEventListener("click", () => navigateTo(node.dataset.page));
  });

  const page = localStorage.getItem("codex-current-page") || "dashboard";
  navigateTo(page);

  loadSavedSearches();
  setInterval(() => {
    loadCrawlStatus();
    checkHighRiskNotifications();
  }, 60000);
});
