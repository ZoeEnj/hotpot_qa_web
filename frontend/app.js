const API_BASE = (window.HOTPOT_API_BASE || "").replace(/\/$/, "");

const state = {
  results: [],
  selectedKey: null,
  lastGraph: null,
};

const resultTemplate = document.querySelector("#resultTemplate");
const resultsEl = document.querySelector("#results");
const resultCountEl = document.querySelector("#resultCount");
const questionTitleEl = document.querySelector("#questionTitle");
const supportFactsEl = document.querySelector("#supportFacts");
const graphEl = document.querySelector("#graph");
const healthStatusEl = document.querySelector("#healthStatus");

function endpoint(path) {
  return `${API_BASE}${path}`;
}

async function fetchJson(path) {
  const res = await fetch(endpoint(path));
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json();
}

function setStatus(text, className) {
  healthStatusEl.textContent = text;
  healthStatusEl.className = `status ${className || ""}`.trim();
}

async function checkHealth() {
  try {
    const data = await fetchJson("/api/health");
    setStatus(`backend ok · ${data.collections.questions} questions`, "ok");
  } catch (err) {
    setStatus("backend unreachable", "fail");
  }
}

async function runSearch(event) {
  if (event) event.preventDefault();
  const keyword = document.querySelector("#keyword").value.trim();
  const type = document.querySelector("#typeFilter").value;
  const level = document.querySelector("#levelFilter").value;
  const params = new URLSearchParams({ q: keyword, type, level, limit: "30" });

  resultsEl.innerHTML = '<div class="empty">检索中...</div>';
  try {
    state.results = await fetchJson(`/api/search?${params.toString()}`);
    renderResults();
    if (state.results.length) {
      selectQuestion(state.results[0].key);
    }
  } catch (err) {
    resultsEl.innerHTML = `<div class="empty">检索失败：${err.message}</div>`;
  }
}

function renderResults() {
  resultCountEl.textContent = String(state.results.length);
  resultsEl.innerHTML = "";
  if (!state.results.length) {
    resultsEl.innerHTML = '<div class="empty">没有匹配的问题</div>';
    return;
  }

  for (const row of state.results) {
    const node = resultTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.key = row.key;
    node.querySelector(".meta").textContent = `${row.split || "-"} · ${row.type || "-"} · ${row.level || "-"}`;
    node.querySelector("strong").textContent = row.question;
    node.querySelector("small").textContent = `answer: ${row.answer}`;
    node.addEventListener("click", () => selectQuestion(row.key));
    if (row.key === state.selectedKey) node.classList.add("active");
    resultsEl.appendChild(node);
  }
}

async function selectQuestion(key) {
  state.selectedKey = key;
  renderResults();
  questionTitleEl.textContent = "加载多跳路径...";
  supportFactsEl.innerHTML = "";
  try {
    const data = await fetchJson(`/api/question/${encodeURIComponent(key)}/path`);
    state.lastGraph = data;
    questionTitleEl.textContent = data.question?.text || "未找到问题";
    renderGraph(data.nodes || [], data.edges || []);
    renderSupport(data.support || []);
  } catch (err) {
    questionTitleEl.textContent = "路径查询失败";
    graphEl.innerHTML = `<div class="empty">${err.message}</div>`;
  }
}

function renderSupport(rows) {
  if (!rows.length) {
    supportFactsEl.innerHTML = '<div class="empty">没有支持事实</div>';
    return;
  }
  supportFactsEl.innerHTML = rows
    .map(
      (row) => `
      <div class="support-item">
        <b>#${row.rank ?? ""}</b>
        <div><strong>${escapeHtml(row.page_title)} · sent ${row.sent_id}</strong><br>${escapeHtml(row.sentence)}</div>
      </div>
    `
    )
    .join("");
}

function nodeColor(kind) {
  return {
    question: "#0f6b73",
    answer: "#4d7c45",
    page: "#315f91",
    sentence: "#c44f35",
  }[kind] || "#66767d";
}

function renderGraph(nodes, edges) {
  graphEl.innerHTML = "";
  if (!nodes.length) {
    graphEl.innerHTML = '<div class="empty">没有图谱数据</div>';
    return;
  }

  const width = graphEl.clientWidth || 800;
  const height = graphEl.clientHeight || 460;
  const svg = d3
    .select(graphEl)
    .append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("role", "img");

  const link = svg
    .append("g")
    .selectAll("line")
    .data(edges)
    .join("line")
    .attr("class", "edge");

  const label = svg
    .append("g")
    .selectAll("text")
    .data(edges)
    .join("text")
    .attr("class", "edge-label")
    .text((d) => d.label);

  const node = svg
    .append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", "node")
    .call(
      d3
        .drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
    );

  node
    .append("circle")
    .attr("r", (d) => (d.kind === "question" ? 18 : d.kind === "answer" ? 16 : 13))
    .attr("fill", (d) => nodeColor(d.kind));

  node.append("title").text((d) => `${d.label}\n${d.detail || ""}`);

  node
    .append("text")
    .attr("x", 16)
    .attr("y", 4)
    .text((d) => truncate(d.label, 28));

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(edges)
        .id((d) => d.id)
        .distance((d) => (d.label === "context" ? 125 : 95))
    )
    .force("charge", d3.forceManyBody().strength(-380))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(42));

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    label
      .attr("x", (d) => (d.source.x + d.target.x) / 2)
      .attr("y", (d) => (d.source.y + d.target.y) / 2);

    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}

async function loadClusters() {
  const clustersEl = document.querySelector("#clusters");
  clustersEl.innerHTML = '<div class="empty">加载聚类...</div>';
  try {
    const rows = await fetchJson("/api/clusters");
    clustersEl.innerHTML = rows
      .map(
        (c) => `
        <article class="cluster">
          <strong>Cluster ${escapeHtml(String(c.cluster_id))}</strong>
          <p>${c.size} questions · ${escapeHtml(c.source || "kmeans")}</p>
          <div>${(c.keywords || []).map((w) => `<span>${escapeHtml(String(w))}</span>`).join("")}</div>
        </article>
      `
      )
      .join("");
  } catch (err) {
    clustersEl.innerHTML = `<div class="empty">聚类加载失败：${err.message}</div>`;
  }
}

async function loadStats() {
  const statsEl = document.querySelector("#stats");
  try {
    const stats = await fetchJson("/api/stats");
    const rows = [...(stats.by_type || []), ...(stats.by_level || [])];
    const max = Math.max(...rows.map((r) => r.value), 1);
    statsEl.innerHTML = rows
      .map(
        (r) => `
        <div class="bar-row">
          <span>${escapeHtml(r.name || "-")}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${(r.value / max) * 100}%"></div></div>
          <strong>${r.value}</strong>
        </div>
      `
      )
      .join("");
  } catch (err) {
    statsEl.innerHTML = `<div class="empty">统计加载失败：${err.message}</div>`;
  }
}

function truncate(text, max) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.querySelector("#searchForm").addEventListener("submit", runSearch);
document.querySelector("#fitGraph").addEventListener("click", () => {
  if (state.lastGraph) renderGraph(state.lastGraph.nodes || [], state.lastGraph.edges || []);
});
document.querySelector("#reloadClusters").addEventListener("click", loadClusters);
window.addEventListener("resize", () => {
  if (state.lastGraph) renderGraph(state.lastGraph.nodes || [], state.lastGraph.edges || []);
});

if (window.lucide) window.lucide.createIcons();
checkHealth();
loadClusters();
loadStats();
runSearch();
