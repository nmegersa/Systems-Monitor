const API_BASE = "http://localhost:8000";
let cpuChart = null;
let memChart = null;
let diskChart = null;
let isUpdating = false;

let liveBuffer = [];
const LIVE_BUFFER_SIZE = 120;
// Auto-refresh (only in "latest" mode)
let autoRefreshTimer = null;
const AUTO_REFRESH_MS = 5000; // 5 seconds

// Convert timestamp to label for charts
function toLabel(ts) {
  const d = new Date(String(ts || ""));
  if (isNaN(d.getTime())) return "";

  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}



// Keep buffer size within limit
function clampBuffer(buf) {
  if (buf.length > LIVE_BUFFER_SIZE) buf.splice(0, buf.length - LIVE_BUFFER_SIZE);
}

// Shortcut to get element by ID
function $(id) {
  return document.getElementById(id);
}

function isNumber(x) {
  return x != null && !Number.isNaN(Number(x));
}

// Summarize an array of numeric values into avg, min, max
function summarize(values) {
  const nums = values.map(Number).filter((v) => Number.isFinite(v));
  if (!nums.length) return null;

  let sum = 0;
  let min = nums[0];
  let max = nums[0];

  for (const v of nums) {
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  return { avg: sum / nums.length, min, max };
}

// Format a summary object as a string
function fmtSummaryPercent(summary, digits = 1) {
  if (!summary) return "-";
  return `avg ${summary.avg.toFixed(digits)}%, min ${summary.min.toFixed(
    digits
  )}%, max ${summary.max.toFixed(digits)}%`;
}

// Format a summary object for load averages
function fmtSummaryLoad(summary, digits = 2) {
  if (!summary) return "-";
  return `avg ${summary.avg.toFixed(digits)}, min ${summary.min.toFixed(
    digits
  )}, max ${summary.max.toFixed(digits)}`;
}


// Format a timestamp into a human-readable time
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString();
}

// Update the status text next to the refresh button
function setStatus(text) {
  const el = $("statusText");
  if (el) el.textContent = text;
}

// Show or hide the auto-refresh message
function setAutoRefreshMessageVisible(isVisible) {
  const el = $("autoRefreshText");
  if (!el) return;
  el.classList.toggle("d-none", !isVisible);
}

// Start or stop auto-refresh based on mode
function syncAutoRefreshToMode() {
  const isLatest = getMode() === "latest";
  setAutoRefreshMessageVisible(isLatest);

  if (isLatest) startAutoRefresh();
  else stopAutoRefresh();
}


// Show an error message in the alert box
function showError(message) {
  const alert = $("errorAlert");
  if (!alert) return;
  alert.textContent = message;
  alert.classList.remove("d-none");
}

// Updates the charts for the range mode
function updateChartsRange(points) {
  if (!Array.isArray(points) || points.length === 0) return;

  // Always sort so the line goes left->right correctly
  const ordered = [...points].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
  );

  const labels = ordered.map((p) => toLabel(p.ts));
  const cpu = ordered.map((p) => Number(p.cpu_percent ?? 0));
  const mem = ordered.map((p) => Number(p.mem_percent ?? 0));
  const disk = ordered.map((p) => Number(p.disk_percent ?? 0));

  setChart(cpuChart, labels, cpu);
  setChart(memChart, labels, mem);
  setChart(diskChart, labels, disk);
}


// Intializes a line chart
function ensureLineChart(existingChart, canvasId, label) {
  const canvas = $(canvasId);
  if (!canvas) return existingChart;

  if (existingChart) return existingChart;

  return new Chart(canvas, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label,
          data: [],
          tension: 0.25,
          pointRadius: 0,
          borderColor: "#2563EB",
          backgroundColor: "rgba(37, 99, 235, 0.12)",
          fill: true,
        },
      ],

    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: true },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => `${v}%` },
        },
      },
    },
  });
}

//Intializes all charts
function ensureCharts() {
  cpuChart = ensureLineChart(cpuChart, "cpuChart", "CPU %");
  memChart = ensureLineChart(memChart, "memoryChart", "Memory %");
  diskChart = ensureLineChart(diskChart, "diskChart", "Disk %");
}

// Sets the data for the chart and updates it
function setChart(chart, labels, data) {
  if (!chart) return;
  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.update();
}

// Updates the charts for the latest mode
let lastSeenLatestId = null;

function updateChartsLatest(row) {
  if (!row) return;
  if (row.id != null && row.id === lastSeenLatestId) return;
  lastSeenLatestId = row.id;

  liveBuffer.push(row);
  clampBuffer(liveBuffer);

  const labels = liveBuffer.map((p) => toLabel(p.ts));
  const cpu = liveBuffer.map((p) => Number(p.cpu_percent ?? 0));
  const mem = liveBuffer.map((p) => Number(p.mem_percent ?? 0));
  const disk = liveBuffer.map((p) => Number(p.disk_percent ?? 0));

  setChart(cpuChart, labels, cpu);
  setChart(memChart, labels, mem);
  setChart(diskChart, labels, disk);
}



// Clear any existing error message
function clearError() {
  const alert = $("errorAlert");
  if (!alert) return;
  alert.textContent = "";
  alert.classList.add("d-none");
}

// Show or hide the range selection container
function setRangeVisible(isVisible) {
  const range = $("rangeContainer");
  if (!range) return;

  // Bootstrap way: hide/show with d-none
  range.classList.toggle("d-none", !isVisible);
}

// Get selected mode from dropdown
function getMode() {
  return $("modeSelect")?.value || "latest";
}

// Get selected minutes from dropdown
function getMinutes() {
  return parseInt($("rangeSelect")?.value || "15", 10);
}

// Update the "Last Updated" timestamp
function setLastUpdated(metricRow) {
  const el = $("lastUpdate");
  if (!el) return;
  el.textContent = metricRow?.ts ? formatTime(metricRow.ts) : "-";
}

// Format percentages
function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${Number(value).toFixed(2)} %`;
}

// Convert bytes to gigabytes
function bytesToGB(bytes) {
  if (bytes == null || Number.isNaN(Number(bytes))) return null;
  return Number(bytes) / (1024 ** 3);
}

// Formats bytes as gigabytes with units
function formatGB(bytes) {
  const gb = bytesToGB(bytes);
  if (gb == null) return "-";
  return `${gb.toFixed(2)} GB`;
}

// Format bytes with appropriate units
function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(Number(bytes))) return "-";
  let byte = Number(bytes);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (byte >= 1024 && i < units.length - 1) {
    byte /= 1024;
    i++;
  }
  return `${byte.toFixed(2)} ${units[i]}`;

}

// Format load averages
function formatLoads(a, b, c) {
  const parts = [a, b, c].map((v) => {
    if (v == null || Number.isNaN(Number(v))) return "-";
    return Number(v).toFixed(2);
  });
  return `${parts[0]}, ${parts[1]}, ${parts[2]}`;
}

// Render the dashboard data into the tables
function renderRows(tBodyID, rows) {
  const tBody = $(tBodyID);
  if (!tBody) return;

  // Clear existing rows
  tBody.innerHTML = "";

  // Add new rows
  tBody.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.metric}</td>
      <td>${row.value}</td>
    </tr>
  `).join("");
}

// Fetch JSON data from the API
async function fetchJSON(path) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${API_BASE}${path}${sep}t=${Date.now()}`; // cache-buster

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} from ${url}${text ? `\n${text}` : ""}`);
  }
  return res.json();
}

// Update the "Last Poll" timestamp
function setLastPollNow() {
  const el = $("lastPoll");
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString();
}


// Get the correct metrics based on mode
async function getDataForMode() {
  const mode = getMode();

  if (mode === "latest") {
    const data = await fetchJSON("/api/latest");
    return { mode: "latest", row: data.latest };
  }

  if (mode === "range") {
    const minutes = getMinutes();
    const data = await fetchJSON(`/api/range?minutes=${minutes}&limit=2000`);
    const points = data.points || [];
    const last = points.length ? points[points.length - 1] : null;
    return { mode: "range", points, last };
  }

  const data = await fetchJSON("/api/latest");
  return { mode: "latest", row: data.latest };
}



// Table rows in correct format
function metricRowsToTableRows(m) {
  const cpuRows = [
    { metric: "Total Usage Percentage", value: formatPercent(m.cpu_percent) },
    { metric: "User Percentage", value: formatPercent(m.cpu_user_percent) },
    { metric: "System Percentage", value: formatPercent(m.cpu_system_percent) },
    { metric: "Load Averages", value: formatLoads(m.load_1, m.load_5, m.load_15) },
  ];

  const memUsedLine = m.mem_used_bytes != null && m.mem_total_bytes != null ?
    `${formatGB(m.mem_used_bytes)} / ${formatGB(m.mem_total_bytes)}` : "-";

  const memFreeAvailLine = `${formatGB(m.mem_free_bytes)}   Available Memory: ${formatGB(
    m.mem_available_bytes
  )}` || "-";

  const memRows = [
    { metric: "Used Memory", value: memUsedLine },
    { metric: "Free/Available Memory", value: memFreeAvailLine },
  ];

  const diskUsedLine =
    m.disk_used_bytes != null && m.disk_total_bytes != null
      ? `${formatPercent(m.disk_percent, 1)}  (${formatGB(m.disk_used_bytes)} / ${formatGB(
        m.disk_total_bytes
      )})`
      : formatPercent(m.disk_percent);

  const diskRows = [
    { metric: "Used Disk Space", value: diskUsedLine },
    { metric: "Free Disk Space", value: formatGB(m.disk_free_bytes) },
  ];

  return { cpuRows, memRows, diskRows };
}

// For range mode, compute table rows with summaries
function metricRangeToTables(points, last) {
  // CPU summaries
  const cpuSum = summarize(points.map((p) => p.cpu_percent));
  const userSum = summarize(points.map((p) => p.cpu_user_percent));
  const sysSum = summarize(points.map((p) => p.cpu_system_percent));
  const load1Sum = summarize(points.map((p) => p.load_1));
  const load5Sum = summarize(points.map((p) => p.load_5));
  const load15Sum = summarize(points.map((p) => p.load_15));

  const cpuRows = [
    {
      metric: "Total Percentage",
      value: `${formatPercent(last?.cpu_percent)} (${fmtSummaryPercent(cpuSum)})`,
    },
    {
      metric: "User Percentage",
      value: `${formatPercent(last?.cpu_user_percent)} (${fmtSummaryPercent(userSum)})`,
    },
    {
      metric: "System Percentage",
      value: `${formatPercent(last?.cpu_system_percent)} (${fmtSummaryPercent(sysSum)})`,
    },
    {
      metric: "Load 1",
      value: `${isNumber(last?.load_1) ? Number(last.load_1).toFixed(2) : "-"} (${fmtSummaryLoad(load1Sum)})`,
    },
    {
      metric: "Load 5",
      value: `${isNumber(last?.load_5) ? Number(last.load_5).toFixed(2) : "-"} (${fmtSummaryLoad(load5Sum)})`,
    },
    {
      metric: "Load 15",
      value: `${isNumber(last?.load_15) ? Number(last.load_15).toFixed(2) : "-"} (${fmtSummaryLoad(load15Sum)})`,
    },
  ];

  // Memory summaries
  const memPctSum = summarize(points.map((p) => p.mem_percent));
  const memUsedSum = summarize(points.map((p) => p.mem_used_bytes));
  const memTotalSum = summarize(points.map((p) => p.mem_total_bytes));
  const memFreeSum = summarize(points.map((p) => p.mem_free_bytes));
  const memAvailSum = summarize(points.map((p) => p.mem_available_bytes));

  const memRows = [
    {
      metric: "Used Memory",
      value: `${formatPercent(last?.mem_percent)} (avg ${memPctSum ? memPctSum.avg.toFixed(1) : "-"}%)`,
    },
    {
      metric: "Used Memory (Bytes)",
      value: `${formatGB(last?.mem_used_bytes)} (avg ${memUsedSum ? formatGB(memUsedSum.avg) : "-"})`,
    },
    {
      metric: "Free Memory (Bytes)",
      value: `${formatGB(last?.mem_free_bytes)} (avg ${memFreeSum ? formatGB(memFreeSum.avg) : "-"})`,
    },
    {
      metric: "Available Memory (Bytes)",
      value: `${formatGB(last?.mem_available_bytes)} (avg ${memAvailSum ? formatGB(memAvailSum.avg) : "-"})`,
    },
    {
      metric: "Total Memory (Bytes)",
      value: `${formatGB(last?.mem_total_bytes)} (avg ${memTotalSum ? formatGB(memTotalSum.avg) : "-"})`,
    },
  ];

  // Disk summaries (usually last is enough, but we’ll compute anyway)
  const diskPctSum = summarize(points.map((p) => p.disk_percent));
  const diskUsedSum = summarize(points.map((p) => p.disk_used_bytes));
  const diskFreeSum = summarize(points.map((p) => p.disk_free_bytes));
  const diskTotalSum = summarize(points.map((p) => p.disk_total_bytes));

  const mount = last?.disk_mount || "/";

  const diskRows = [
    {
      metric: `Used Percentage`,
      value: `${formatPercent(last?.disk_percent)} (${fmtSummaryPercent(diskPctSum)})`,
    },
    {
      metric: "Used bytes",
      value: `${formatGB(last?.disk_used_bytes)} (avg ${diskUsedSum ? formatGB(diskUsedSum.avg) : "-"})`,
    },
    {
      metric: "Free bytes",
      value: `${formatGB(last?.disk_free_bytes)} (avg ${diskFreeSum ? formatGB(diskFreeSum.avg) : "-"})`,
    },
    {
      metric: "Total bytes",
      value: `${formatGB(last?.disk_total_bytes)} (avg ${diskTotalSum ? formatGB(diskTotalSum.avg) : "-"})`,
    },
  ];

  return { cpuRows, memRows, diskRows };
}


// Update the dashboard data
async function updateDashboard() {
  if (isUpdating) return;
  isUpdating = true;

  clearError();
  setStatus("Loading...");
  setLastPollNow();

  try {
    const data = await getDataForMode();

    ensureCharts();

    if (data.mode === "latest") {
      const row = data.row;
      if (!row) throw new Error("No metrics found yet.");

      setLastUpdated(row);

      const { cpuRows, memRows, diskRows } = metricRowsToTableRows(row);
      renderRows("cpuTableBody", cpuRows);
      renderRows("memoryTableBody", memRows);
      renderRows("diskTableBody", diskRows);
      updateChartsLatest(row);
    } else {
      const { points, last } = data;
      if (!points?.length || !last) throw new Error("No metrics found in selected range.");

      setLastUpdated(last);

      const { cpuRows, memRows, diskRows } = metricRangeToTables(points, last);
      renderRows("cpuTableBody", cpuRows);
      renderRows("memoryTableBody", memRows);
      renderRows("diskTableBody", diskRows);
      updateChartsRange(points);
    }

    setStatus("Ready");
  } catch (err) {
    console.error(err);
    showError(err?.message || "Failed to load metrics");
    setStatus("Error");
  } finally {
    isUpdating = false;
  }
}

// Start auto-refreshing
function startAutoRefresh() {
  stopAutoRefresh(); // avoid duplicates

  autoRefreshTimer = setInterval(() => {
    // only refresh while still in latest mode
    if (getMode() === "latest") {
      updateDashboard();
    }
  }, AUTO_REFRESH_MS);
}

// Stop auto-refreshing
function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

// Initialize controls and event listeners
function initControls() {
  const modeSelect = $("modeSelect");
  const rangeSelect = $("rangeSelect");
  const refreshBtn = $("refreshBtn");

  if (!modeSelect) {
    console.error("modeSelect not found");
    return;
  }

  // initial state
  setRangeVisible(getMode() === "range");
  setStatus("Ready");

  // update on mode change
  modeSelect.addEventListener("change", () => {
    setRangeVisible(getMode() === "range");
    syncAutoRefreshToMode();
    updateDashboard();
  });

  // update on range change (only matters in range mode)
  rangeSelect?.addEventListener("change", () => {
    if (getMode() === "range") updateDashboard();
  });

  // update on refresh
  refreshBtn?.addEventListener("click", updateDashboard);

  // first load
  updateDashboard();
  syncAutoRefreshToMode();
}

document.addEventListener("DOMContentLoaded", initControls);

