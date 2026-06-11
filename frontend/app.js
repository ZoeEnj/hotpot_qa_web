const STORAGE_KEY = "hotpot_api_base";

const state = {
  apiBase: initialApiBase(),
  results: [],
  selectedKey: null,
  selectedPath: null,
  clusters: [],
  activeClusterKey: null,
  showLabels: true,
  graphZoom: 1,
  apiOnline: false,
  useStaticFallback: false,
  searchRun: 0,
  pathRun: 0,
  clusterRun: 0,
  clusterQuestionRun: 0,
  statsRun: 0,
  searchAbort: null,
  pathAbort: null,
  clusterAbort: null,
  clusterQuestionAbort: null,
  statsAbort: null,
};

const els = {
  apiForm: document.querySelector("#apiForm"),
  apiBase: document.querySelector("#apiBase"),
  healthStatus: document.querySelector("#healthStatus"),
  questionsCount: document.querySelector("#questionsCount"),
  pagesCount: document.querySelector("#pagesCount"),
  sentencesCount: document.querySelector("#sentencesCount"),
  clustersCount: document.querySelector("#clustersCount"),
  searchForm: document.querySelector("#searchForm"),
  keyword: document.querySelector("#keyword"),
  typeFilter: document.querySelector("#typeFilter"),
  levelFilter: document.querySelector("#levelFilter"),
  splitFilter: document.querySelector("#splitFilter"),
  limitFilter: document.querySelector("#limitFilter"),
  clearSearch: document.querySelector("#clearSearch"),
  clearKeyword: document.querySelector("#clearKeyword"),
  results: document.querySelector("#results"),
  resultCount: document.querySelector("#resultCount"),
  resultTemplate: document.querySelector("#resultTemplate"),
  graphTitle: document.querySelector("#graphTitle"),
  graphCanvas: document.querySelector("#graphCanvas"),
  fitGraph: document.querySelector("#fitGraph"),
  toggleLabels: document.querySelector("#toggleLabels"),
  selectedState: document.querySelector("#selectedState"),
  questionMeta: document.querySelector("#questionMeta"),
  answerText: document.querySelector("#answerText"),
  supportFacts: document.querySelector("#supportFacts"),
  contextPages: document.querySelector("#contextPages"),
  clusterInfo: document.querySelector("#clusterInfo"),
  clusters: document.querySelector("#clusters"),
  reloadClusters: document.querySelector("#reloadClusters"),
  stats: document.querySelector("#stats"),
  toastHost: document.querySelector("#toastHost"),
};

function initialApiBase() {
  const stored = safeStorageGet(STORAGE_KEY);
  if (stored !== null) return normalizeApiBase(stored);
  const configured = normalizeApiBase(window.HOTPOT_API_BASE || "");
  return configured;
}

function normalizeApiBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore private-mode storage failures.
  }
}

function canUseApi() {
  return Boolean(state.apiBase);
}

function hasStaticSnapshot() {
  return window.pseudoBackend && typeof window.pseudoBackend.fetchJson === "function";
}

function canUseStaticSnapshot() {
  return hasStaticSnapshot() && (!canUseApi() || state.useStaticFallback);
}

function endpoint(path) {
  return `${state.apiBase}${path}`;
}

async function fetchJson(path, options = {}) {
  if (canUseStaticSnapshot()) {
    return window.pseudoBackend.fetchJson(path, options);
  }
  if (!canUseApi()) throw new Error("API Base 未配置，且静态快照不可用");
  const timeout = options.timeout || 12000;
  const controller = options.controller || new AbortController();
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);
  try {
    const response = await fetch(endpoint(path), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      const message = typeof body === "object" && body && body.error ? body.error : `${response.status} ${response.statusText}`;
      throw new Error(message);
    }
    return body;
  } catch (error) {
    if (timedOut && error.name === "AbortError") {
      const timeoutError = new Error(`request timeout after ${timeout}ms`);
      timeoutError.name = "TimeoutError";
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchStaticJson(path, options = {}) {
  if (!hasStaticSnapshot()) {
    throw new Error("静态快照不可用");
  }
  return window.pseudoBackend.fetchJson(path, options);
}

function activateStaticFallback(detail = "真实后端不可达，已回退") {
  state.apiOnline = false;
  state.useStaticFallback = true;
  setHealth("ok", "静态快照", detail);
}

function cancelInFlightRequests() {
  for (const controller of [state.searchAbort, state.pathAbort, state.clusterAbort, state.clusterQuestionAbort, state.statsAbort]) {
    if (controller) controller.abort();
  }
  state.searchRun += 1;
  state.pathRun += 1;
  state.clusterRun += 1;
  state.clusterQuestionRun += 1;
  state.statsRun += 1;
}

function setHealth(status, title, detail) {
  const dot = els.healthStatus.querySelector(".status-dot");
  dot.className = `status-dot ${status}`;
  els.healthStatus.querySelector("strong").textContent = title;
  els.healthStatus.querySelector("small").textContent = detail;
}

function setCounts(collections = {}) {
  els.questionsCount.textContent = formatNumber(collections.questions);
  els.pagesCount.textContent = formatNumber(collections.pages);
  els.sentencesCount.textContent = formatNumber(collections.sentences);
  els.clustersCount.textContent = formatNumber(collections.clusters);
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("en-US") : "-";
}

async function checkHealth() {
  els.apiBase.value = state.apiBase;
  state.useStaticFallback = false;
  try {
    const data = await fetchJson("/api/health", { timeout: 8000 });
    state.apiOnline = canUseApi();
    if (canUseApi()) {
      setHealth("ok", "后端连接正常", "200 OK");
    } else {
      setHealth("ok", "静态快照", data.snapshot?.scope || "frontend/static-api");
    }
    setCounts(data.collections || {});
    return true;
  } catch (error) {
    state.apiOnline = false;
    setHealth("fail", "后端不可达", shortError(error));
    try {
      const fallback = await fetchStaticJson("/api/health", { timeout: 3000 });
      activateStaticFallback(fallback.snapshot?.scope || "真实后端不可达，已回退");
      setCounts(fallback.collections || {});
      toast("真实后端不可达，已回退到静态快照。检查 API Base、CORS、HTTPS。");
    } catch {
      setCounts({});
      toast("后端和静态快照都不可用。检查部署文件是否完整。");
    }
    return false;
  }
}

async function runSearch(event) {
  if (event) event.preventDefault();
  const runId = ++state.searchRun;
  if (state.searchAbort) state.searchAbort.abort();
  if (state.pathAbort) state.pathAbort.abort();
  state.pathRun += 1;
  state.searchAbort = new AbortController();

  clearPathState("正在检索...");
  renderLoading(els.results, 4);
  els.resultCount.textContent = "0";

  const filters = getFilters();
  try {
    const rows = await fetchJson(`/api/search?${filters.toString()}`, { controller: state.searchAbort });
    if (runId !== state.searchRun) return;
    state.results = Array.isArray(rows) ? rows : [];
    renderResults();
    if (state.results.length) {
      await selectQuestion(state.results[0].key);
    } else {
      clearPathState("没有匹配的问题");
      renderEmpty(els.results, "未搜索到结果", "请尝试其他关键词或调整筛选条件。");
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    if (runId !== state.searchRun) return;
    if (canUseApi()) {
      state.apiOnline = false;
      try {
        state.results = await fetchStaticJson(`/api/search?${filters.toString()}`);
        if (runId !== state.searchRun) return;
        renderResults();
        activateStaticFallback("真实检索接口不可用，已回退");
        toast(`真实检索接口不可用，已回退静态快照：${shortError(error)}`);
        if (state.results.length) await selectQuestion(state.results[0].key);
        return;
      } catch (fallbackError) {
        renderError(els.results, "静态快照检索失败", shortError(fallbackError));
      }
    }
    state.results = [];
    renderResults();
    clearPathState("检索失败");
    renderError(els.results, "检索失败", shortError(error));
  }
}

function getFilters() {
  const params = new URLSearchParams();
  params.set("q", els.keyword.value.trim());
  params.set("type", els.typeFilter.value);
  params.set("level", els.levelFilter.value);
  params.set("split", els.splitFilter.value);
  params.set("limit", els.limitFilter.value);
  return params;
}

function renderResults() {
  els.results.textContent = "";
  els.resultCount.textContent = String(state.results.length);
  if (!state.results.length) return;

  const fragment = document.createDocumentFragment();
  for (const row of state.results) {
    const card = els.resultTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.key = safeText(row.key);
    card.classList.toggle("active", row.key === state.selectedKey);
    card.setAttribute("aria-pressed", row.key === state.selectedKey ? "true" : "false");
    card.querySelector(".result-question").textContent = safeText(row.question || "(no question)");
    card.querySelector(".result-answer").textContent = `答案：${safeText(row.answer || "-")}`;

    const tags = card.querySelector(".result-tags");
    tags.append(
      tag(row.type || "-", "blue"),
      tag(row.level || "-", row.level === "hard" ? "red" : row.level === "medium" ? "amber" : ""),
      tag(row.split || "-"),
      tag(`support:${safeNumber(row.n_supporting_facts, 0)}`)
    );
    card.addEventListener("click", () => selectQuestion(row.key));
    fragment.appendChild(card);
  }
  els.results.appendChild(fragment);
}

async function selectQuestion(key) {
  const runId = ++state.pathRun;
  state.selectedKey = key;
  state.selectedPath = null;
  if (state.pathAbort) state.pathAbort.abort();
  state.pathAbort = new AbortController();
  renderResults();
  clearPathState("正在加载多跳路径...", false);
  renderLoading(els.supportFacts, 3);

  try {
    const data = await fetchJson(`/api/question/${encodeURIComponent(key)}/path`, { controller: state.pathAbort });
    if (runId !== state.pathRun) return;
    state.selectedPath = normalizePath(data);
    state.graphZoom = 1;
    renderSelectedPath();
  } catch (error) {
    if (error.name === "AbortError") return;
    if (runId !== state.pathRun) return;
    if (canUseApi()) {
      state.apiOnline = false;
      try {
        state.selectedPath = normalizePath(await fetchStaticJson(`/api/question/${encodeURIComponent(key)}/path`));
        if (runId !== state.pathRun) return;
        renderSelectedPath();
        activateStaticFallback("真实路径接口不可用，已回退");
        toast(`真实路径接口不可用，已回退静态快照：${shortError(error)}`);
        return;
      } catch (fallbackError) {
        clearPathState("静态路径快照失败", false);
        renderError(els.graphCanvas, "静态路径快照失败", shortError(fallbackError));
        renderError(els.supportFacts, "支持事实不可用", shortError(fallbackError));
        return;
      }
    }
    clearPathState("路径查询失败");
    renderError(els.graphCanvas, "路径查询失败", shortError(error));
    renderError(els.supportFacts, "支持事实不可用", shortError(error));
  }
}

function normalizePath(data) {
  const path = data && typeof data === "object" ? data : {};
  const question = path.question || {};
  return {
    question: {
      key: safeText(question.key || state.selectedKey || ""),
      orig_id: safeText(question.orig_id || findSelectedResult()?.orig_id || ""),
      split: safeText(question.split || findSelectedResult()?.split || ""),
      text: safeText(question.text || question.question || findSelectedResult()?.question || ""),
      answer: safeText(question.answer || findSelectedResult()?.answer || ""),
      type: safeText(question.type || findSelectedResult()?.type || ""),
      level: safeText(question.level || findSelectedResult()?.level || ""),
    },
    nodes: Array.isArray(path.nodes) ? path.nodes : [],
    edges: Array.isArray(path.edges) ? path.edges : [],
    support: Array.isArray(path.support) ? path.support : [],
    context: Array.isArray(path.context) ? path.context : [],
    cluster: path.cluster && typeof path.cluster === "object" ? path.cluster : null,
  };
}

function findSelectedResult() {
  return state.results.find((row) => row.key === state.selectedKey);
}

function renderSelectedPath() {
  const data = state.selectedPath;
  if (!data) return;
  els.graphTitle.textContent = "多跳证据路径图";
  els.selectedState.textContent = data.question.key ? "已选择" : "未选择";
  els.answerText.textContent = data.question.answer || "-";
  renderQuestionMeta(data);
  renderSupport(data.support);
  renderContext(data.context);
  renderClusterInfo(data.cluster);
  renderGraph(data.nodes, data.edges);
}

function renderQuestionMeta(data) {
  const q = data.question;
  els.questionMeta.textContent = "";
  const pairs = [
    ["Question ID", q.orig_id || q.key || "-"],
    ["类型", q.type || "-"],
    ["数据集", q.split || "-"],
    ["难度", q.level || "-"],
    ["支持句子数", data.support.length],
    ["上下文页面数", data.context.length],
  ];
  for (const [name, value] of pairs) {
    const dt = document.createElement("dt");
    dt.textContent = name;
    const dd = document.createElement("dd");
    dd.textContent = String(value);
    els.questionMeta.append(dt, dd);
  }
}

function renderSupport(rows) {
  els.supportFacts.textContent = "";
  if (!rows.length) {
    renderEmpty(els.supportFacts, "没有支持事实", "该问题没有返回 supporting facts。");
    return;
  }
  const fragment = document.createDocumentFragment();
  rows.forEach((row, index) => {
    const item = document.createElement("article");
    item.className = "support-item";
    const rank = document.createElement("span");
    rank.className = "support-rank";
    rank.textContent = String(safeNumber(row.rank, index + 1));
    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${safeText(row.page_title || "Unknown page")} / sent ${safeText(row.sent_id ?? "-")}`;
    const text = document.createElement("p");
    text.textContent = safeText(row.sentence || "");
    body.append(title, text);
    const ext = document.createElement("span");
    ext.className = "tiny-chip";
    ext.textContent = "fact";
    item.append(rank, body, ext);
    fragment.appendChild(item);
  });
  els.supportFacts.appendChild(fragment);
}

function renderContext(rows) {
  els.contextPages.textContent = "";
  if (!rows.length) {
    const li = document.createElement("li");
    li.textContent = "无上下文页面";
    els.contextPages.appendChild(li);
    return;
  }
  for (const row of rows) {
    const li = document.createElement("li");
    li.textContent = safeText(row.page_title || row.title || "-");
    els.contextPages.appendChild(li);
  }
}

function renderClusterInfo(cluster) {
  els.clusterInfo.textContent = "";
  const active = cluster || state.clusters.find((item) => item.key === state.activeClusterKey);
  if (!active) {
    els.clusterInfo.append(tag("未选择聚类"));
    return;
  }
  els.clusterInfo.append(tag(`Cluster ${safeText(active.cluster_id ?? active.key)}`, "blue"));
  els.clusterInfo.append(tag(`${formatNumber(active.size)} questions`, "amber"));
  for (const word of (active.keywords || []).slice(0, 6)) {
    els.clusterInfo.append(tag(word));
  }
}

function renderGraph(rawNodes, rawEdges) {
  els.graphCanvas.textContent = "";
  els.graphCanvas.classList.toggle("hide-labels", !state.showLabels);

  const { nodes, edges } = sanitizeGraph(rawNodes, rawEdges);
  if (!nodes.length) {
    renderEmpty(els.graphCanvas, "没有图谱数据", "后端未返回 nodes / edges。");
    return;
  }

  const width = Math.max(820, els.graphCanvas.clientWidth || 820);
  const height = Math.max(520, els.graphCanvas.clientHeight || 520);
  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    "data-base-width": String(width),
    "data-base-height": String(height),
    "aria-label": "多跳证据路径图",
  });
  const defs = svgEl("defs");
  const marker = svgEl("marker", {
    id: "arrow",
    markerWidth: "9",
    markerHeight: "9",
    refX: "8",
    refY: "4.5",
    orient: "auto",
  });
  marker.appendChild(svgEl("path", { d: "M0,0 L9,4.5 L0,9 Z", fill: "rgba(24,33,38,.58)" }));
  defs.appendChild(marker);
  svg.appendChild(defs);

  const positions = layoutNodes(nodes, width, height);
  const edgeLayer = svgEl("g");
  const labelLayer = svgEl("g");
  const nodeLayer = svgEl("g");
  svg.append(edgeLayer, labelLayer, nodeLayer);

  for (const edge of edges) {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) continue;
    const path = edgePath(source, target);
    const line = svgEl("path", {
      d: path,
      class: `graph-edge ${edgeClass(edge.label)}`,
      "marker-end": "url(#arrow)",
    });
    edgeLayer.appendChild(line);

    const mid = midpoint(source, target);
    const text = svgEl("text", {
      x: String(mid.x),
      y: String(mid.y - 6),
      class: "edge-label",
      "text-anchor": "middle",
    });
    text.textContent = safeText(edge.label || "edge");
    labelLayer.appendChild(text);
  }

  for (const node of nodes) {
    nodeLayer.appendChild(renderGraphNode(node, positions.get(node.id)));
  }

  els.graphCanvas.appendChild(svg);
  renderMiniMap(nodes, edges, positions, width, height);
  applyGraphZoom();
}

function sanitizeGraph(rawNodes, rawEdges) {
  const byId = new Map();
  for (const node of rawNodes || []) {
    const id = safeText(node.id);
    if (!id || byId.has(id)) continue;
    byId.set(id, {
      id,
      label: safeText(node.label || id),
      detail: safeText(node.detail || ""),
      kind: safeKind(node.kind),
    });
  }

  const edges = [];
  for (const edge of rawEdges || []) {
    const source = edgeEndpoint(edge.source);
    const target = edgeEndpoint(edge.target);
    if (!source || !target || !byId.has(source) || !byId.has(target)) continue;
    edges.push({
      source,
      target,
      label: safeText(edge.label || "edge"),
    });
  }
  return { nodes: Array.from(byId.values()), edges };
}

function edgeEndpoint(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && value.id) return String(value.id);
  return "";
}

function safeKind(kind) {
  return ["question", "answer", "page", "sentence"].includes(kind) ? kind : "page";
}

function layoutNodes(nodes, width, height) {
  const groups = {
    question: nodes.filter((node) => node.kind === "question"),
    page: nodes.filter((node) => node.kind === "page"),
    sentence: nodes.filter((node) => node.kind === "sentence"),
    answer: nodes.filter((node) => node.kind === "answer"),
  };
  const map = new Map();
  placeGroup(groups.question, 0.18, [0.48], width, height, map);
  placeGroup(groups.page, 0.48, spread(groups.page.length, 0.28, 0.73), width, height, map);
  placeGroup(groups.sentence, 0.75, spread(groups.sentence.length, 0.20, 0.58), width, height, map);
  placeGroup(groups.answer, 0.75, [0.76], width, height, map);

  const leftovers = nodes.filter((node) => !map.has(node.id));
  placeGroup(leftovers, 0.62, spread(leftovers.length, 0.28, 0.72), width, height, map);
  return map;
}

function placeGroup(nodes, xRatio, yRatios, width, height, map) {
  nodes.forEach((node, index) => {
    map.set(node.id, {
      ...node,
      x: width * xRatio,
      y: height * (yRatios[index] ?? yRatios[yRatios.length - 1] ?? 0.5),
    });
  });
}

function spread(count, start, end) {
  if (count <= 0) return [];
  if (count === 1) return [(start + end) / 2];
  return Array.from({ length: count }, (_, index) => start + ((end - start) * index) / (count - 1));
}

function edgePath(source, target) {
  const dx = Math.abs(target.x - source.x);
  const c1 = source.x + dx * 0.42;
  const c2 = target.x - dx * 0.42;
  return `M ${source.x} ${source.y} C ${c1} ${source.y}, ${c2} ${target.y}, ${target.x} ${target.y}`;
}

function midpoint(source, target) {
  return {
    x: (source.x + target.x) / 2,
    y: (source.y + target.y) / 2,
  };
}

function edgeClass(label) {
  const text = String(label || "").toLowerCase();
  if (text.includes("context")) return "context";
  if (text.includes("co")) return "co-support";
  if (text.includes("answer")) return "answer";
  return "support";
}

function renderGraphNode(node, pos) {
  const group = svgEl("g", { class: `graph-node ${node.kind}`, transform: `translate(${pos.x}, ${pos.y})` });
  const color = nodeColor(node.kind);
  if (node.kind === "page") {
    group.appendChild(svgEl("rect", { x: "-24", y: "-24", width: "48", height: "48", rx: "10", fill: color }));
    const icon = svgEl("text", { x: "0", y: "7", "text-anchor": "middle", fill: "#fff", "font-size": "20" });
    icon.textContent = "▣";
    group.appendChild(icon);
  } else {
    group.appendChild(svgEl("circle", { r: node.kind === "question" ? "30" : "26", fill: color }));
    const icon = svgEl("text", { x: "0", y: "8", "text-anchor": "middle", fill: "#fff", "font-size": node.kind === "sentence" ? "26" : "24" });
    icon.textContent = node.kind === "question" ? "Q" : node.kind === "answer" ? "A" : "S";
    group.appendChild(icon);
  }
  const label = svgEl("text", { x: node.kind === "question" ? "-74" : "38", y: "48", "text-anchor": node.kind === "question" ? "middle" : "start" });
  label.textContent = truncate(node.label, 26);
  const subtitle = svgEl("text", { x: node.kind === "question" ? "-74" : "38", y: "64", class: "node-subtitle", "text-anchor": node.kind === "question" ? "middle" : "start" });
  subtitle.textContent = truncate(node.detail, 32);
  group.append(label, subtitle);
  const title = svgEl("title");
  title.textContent = `${node.label}\n${node.detail}`;
  group.appendChild(title);
  return group;
}

function nodeColor(kind) {
  return {
    question: "#0e6f75",
    answer: "#2f7d59",
    page: "#3f668c",
    sentence: "#b84a3a",
  }[kind] || "#647179";
}

function renderMiniMap(nodes, edges, positions, width, height) {
  const box = document.createElement("div");
  box.className = "mini-map";
  const svg = svgEl("svg", { viewBox: "0 0 132 70", "aria-hidden": "true" });
  for (const edge of edges) {
    const s = positions.get(edge.source);
    const t = positions.get(edge.target);
    if (!s || !t) continue;
    svg.appendChild(svgEl("line", {
      x1: String((s.x / width) * 132),
      y1: String((s.y / height) * 70),
      x2: String((t.x / width) * 132),
      y2: String((t.y / height) * 70),
      stroke: "#9ba8a5",
      "stroke-width": "1",
    }));
  }
  for (const node of nodes) {
    const p = positions.get(node.id);
    if (!p) continue;
    svg.appendChild(svgEl("circle", {
      cx: String((p.x / width) * 132),
      cy: String((p.y / height) * 70),
      r: node.kind === "question" ? "5" : "3",
      fill: nodeColor(node.kind),
    }));
  }
  box.appendChild(svg);

  const rail = document.createElement("div");
  rail.className = "zoom-rail";
  const actions = [
    ["+", "放大", () => setGraphZoom(state.graphZoom * 1.25)],
    ["-", "缩小", () => setGraphZoom(state.graphZoom / 1.25)],
    ["□", "重置视图", () => setGraphZoom(1)],
  ];
  for (const [label, ariaLabel, action] of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-label", ariaLabel);
    button.addEventListener("click", action);
    rail.appendChild(button);
  }
  els.graphCanvas.append(box, rail);
}

function setGraphZoom(nextZoom) {
  state.graphZoom = clampNumber(nextZoom, 0.75, 2.5, 1);
  applyGraphZoom();
}

function applyGraphZoom() {
  const svg = els.graphCanvas.querySelector("svg");
  if (!svg) return;
  const width = safeNumber(svg.getAttribute("data-base-width"), 820);
  const height = safeNumber(svg.getAttribute("data-base-height"), 520);
  const zoom = clampNumber(state.graphZoom, 0.75, 2.5, 1);
  const viewWidth = width / zoom;
  const viewHeight = height / zoom;
  const x = (width - viewWidth) / 2;
  const y = (height - viewHeight) / 2;
  svg.setAttribute("viewBox", `${x} ${y} ${viewWidth} ${viewHeight}`);
}

async function loadClusters() {
  const runId = ++state.clusterRun;
  if (state.clusterAbort) state.clusterAbort.abort();
  state.clusterAbort = new AbortController();
  renderLoading(els.clusters, 3);
  try {
    const rows = await fetchJson("/api/clusters", { controller: state.clusterAbort });
    if (runId !== state.clusterRun) return;
    state.clusters = Array.isArray(rows) ? rows : [];
    renderClusters();
  } catch (error) {
    if (error.name === "AbortError") return;
    if (runId !== state.clusterRun) return;
    try {
      state.clusters = await fetchStaticJson("/api/clusters");
      if (runId !== state.clusterRun) return;
      renderClusters();
      if (canUseApi()) activateStaticFallback("真实聚类接口不可用，已回退");
      toast(`真实聚类接口不可用，已回退静态快照：${shortError(error)}`);
    } catch (fallbackError) {
      if (runId !== state.clusterRun) return;
      state.clusters = [];
      renderClusters();
      toast(`聚类接口不可用：${shortError(fallbackError)}`);
    }
  }
}

function renderClusters() {
  els.clusters.textContent = "";
  if (!state.clusters.length) {
    renderEmpty(els.clusters, "暂无聚类", "请先运行聚类脚本或使用 type/level fallback。");
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const cluster of state.clusters) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "cluster-card";
    card.classList.toggle("active", cluster.key === state.activeClusterKey);
    card.setAttribute("aria-pressed", cluster.key === state.activeClusterKey ? "true" : "false");
    const title = document.createElement("strong");
    title.textContent = `Cluster ${safeText(cluster.cluster_id ?? cluster.key)}`;
    const count = document.createElement("small");
    count.textContent = `${formatNumber(cluster.size)} questions · ${safeText(cluster.source || "cluster")}`;
    const cloud = document.createElement("div");
    cloud.className = "keyword-cloud";
    for (const word of (cluster.keywords || []).slice(0, 5)) {
      cloud.appendChild(tag(word));
    }
    const sample = document.createElement("p");
    sample.className = "sample-question";
    sample.textContent = sampleClusterQuestion(cluster);
    card.append(title, count, cloud, sample);
    card.addEventListener("click", () => selectCluster(cluster));
    fragment.appendChild(card);
  }
  els.clusters.appendChild(fragment);
}

async function selectCluster(cluster) {
  const runId = ++state.clusterQuestionRun;
  if (state.clusterQuestionAbort) state.clusterQuestionAbort.abort();
  if (state.pathAbort) state.pathAbort.abort();
  state.pathRun += 1;
  state.clusterQuestionAbort = new AbortController();
  state.activeClusterKey = cluster.key;
  renderClusters();
  clearPathState("正在加载聚类问题...");
  renderClusterInfo(cluster);
  try {
    const rows = await fetchJson(`/api/cluster/${encodeURIComponent(cluster.key)}/questions?limit=5`, { controller: state.clusterQuestionAbort });
    if (runId !== state.clusterQuestionRun) return;
    state.results = Array.isArray(rows) ? rows : [];
    renderResults();
    if (state.results.length) {
      toast(`已载入 Cluster ${safeText(cluster.cluster_id)} 的 ${state.results.length} 个问题。`);
      await selectQuestion(state.results[0].key);
      return;
    }
    toast(`Cluster ${safeText(cluster.cluster_id)} 暂无可下钻样例。`);
  } catch (error) {
    if (error.name === "AbortError") return;
    if (runId !== state.clusterQuestionRun) return;
    if (canUseApi()) {
      try {
        const rows = await fetchStaticJson(`/api/cluster/${encodeURIComponent(cluster.key)}/questions?limit=5`);
        if (runId !== state.clusterQuestionRun) return;
        state.results = Array.isArray(rows) ? rows : [];
        renderResults();
        activateStaticFallback("真实聚类下钻失败，已回退");
        toast(`真实聚类下钻失败，已回退静态快照：${shortError(error)}`);
        if (state.results.length) await selectQuestion(state.results[0].key);
        return;
      } catch {
        // Fall through to the user-facing error below.
      }
    }
    toast(`聚类下钻失败：${shortError(error)}`);
  }
}

function sampleClusterQuestion(cluster) {
  const sample = safeText(cluster.sample_question).trim();
  if (sample) return `示例问题：${sample}`;
  return "点击查看该聚类的样例问题";
}

async function loadStats() {
  const runId = ++state.statsRun;
  if (state.statsAbort) state.statsAbort.abort();
  state.statsAbort = new AbortController();
  renderLoading(els.stats, 2);
  try {
    const stats = await fetchJson("/api/stats", { controller: state.statsAbort });
    if (runId !== state.statsRun) return;
    renderStats(stats);
  } catch (error) {
    if (error.name === "AbortError") return;
    if (runId !== state.statsRun) return;
    try {
      const stats = await fetchStaticJson("/api/stats");
      if (runId !== state.statsRun) return;
      renderStats(stats);
      if (canUseApi()) activateStaticFallback("真实统计接口不可用，已回退");
      toast(`真实统计接口不可用，已回退静态快照：${shortError(error)}`);
    } catch (fallbackError) {
      if (runId !== state.statsRun) return;
      renderError(els.stats, "统计接口不可用", shortError(fallbackError));
      toast(`统计接口不可用：${shortError(fallbackError)}`);
    }
  }
}

function renderStats(stats) {
  els.stats.textContent = "";
  const groups = [
    ["按类型分布", stats?.by_type || []],
    ["按难度分布", stats?.by_level || []],
  ];
  for (const [title, rows] of groups) {
    const group = document.createElement("section");
    group.className = "stat-group";
    const heading = document.createElement("h3");
    heading.textContent = title;
    group.appendChild(heading);
    const max = Math.max(...rows.map((row) => safeNumber(row.value, 0)), 1);
    rows.forEach((row, index) => {
      const value = safeNumber(row.value, 0);
      const bar = document.createElement("div");
      bar.className = "bar-row";
      const name = document.createElement("span");
      name.textContent = safeText(row.name || "-");
      const track = document.createElement("div");
      track.className = "bar-track";
      const fill = document.createElement("div");
      fill.className = `bar-fill ${index === 1 ? "green" : index === 2 ? "red" : ""}`;
      fill.style.width = `${Math.min(100, Math.max(0, (value / max) * 100))}%`;
      track.appendChild(fill);
      const count = document.createElement("strong");
      count.textContent = formatNumber(value);
      bar.append(name, track, count);
      group.appendChild(bar);
    });
    els.stats.appendChild(group);
  }
}

function clearPathState(title, resetSelection = true) {
  state.selectedPath = null;
  if (resetSelection) state.selectedKey = null;
  els.graphTitle.textContent = title;
  els.graphCanvas.textContent = "";
  els.questionMeta.textContent = "";
  els.answerText.textContent = "-";
  els.supportFacts.textContent = "";
  els.contextPages.textContent = "";
  els.clusterInfo.textContent = "";
  els.selectedState.textContent = "未选择";
}

function renderLoading(container, lines = 3) {
  container.textContent = "";
  const box = document.createElement("div");
  box.className = "loading-state";
  for (let i = 0; i < lines; i += 1) {
    const line = document.createElement("span");
    line.className = `skeleton ${i === lines - 1 ? "short" : ""}`;
    box.appendChild(line);
  }
  container.appendChild(box);
}

function renderEmpty(container, title, detail) {
  container.textContent = "";
  const box = document.createElement("div");
  box.className = "empty";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const p = document.createElement("p");
  p.textContent = detail;
  box.append(strong, p);
  container.appendChild(box);
}

function renderError(container, title, detail) {
  container.textContent = "";
  const box = document.createElement("div");
  box.className = "error-state";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const p = document.createElement("p");
  p.textContent = detail;
  box.append(strong, p);
  container.appendChild(box);
}

function tag(value, tone = "") {
  const node = document.createElement("span");
  node.className = `tag ${tone}`.trim();
  node.textContent = safeText(value);
  return node;
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  els.toastHost.appendChild(node);
  window.setTimeout(() => node.remove(), 4800);
}

function svgEl(tagName, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  return node;
}

function safeText(value) {
  return String(value ?? "");
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampNumber(value, min, max, fallback) {
  const number = safeNumber(value, fallback);
  return Math.min(max, Math.max(min, number));
}

function truncate(value, max) {
  const text = safeText(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function shortError(error) {
  if (!error) return "unknown error";
  if (error.name === "AbortError") return "request aborted";
  return truncate(error.message || String(error), 120);
}

function bindEvents() {
  els.apiForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    cancelInFlightRequests();
    state.apiBase = normalizeApiBase(els.apiBase.value);
    state.useStaticFallback = false;
    safeStorageSet(STORAGE_KEY, state.apiBase);
    const online = await checkHealth();
    await runSearch();
    loadClusters();
    loadStats();
    if (!online && canUseApi()) toast("已使用静态快照。请确认云主机 API 使用 HTTPS 并允许 GitHub Pages 跨域访问。");
  });

  els.searchForm.addEventListener("submit", runSearch);
  for (const control of [els.typeFilter, els.levelFilter, els.splitFilter, els.limitFilter]) {
    control.addEventListener("change", () => runSearch());
  }
  els.clearKeyword.addEventListener("click", () => {
    els.keyword.value = "";
    els.keyword.focus();
    runSearch();
  });
  els.clearSearch.addEventListener("click", () => {
    els.keyword.value = "";
    els.typeFilter.value = "";
    els.levelFilter.value = "";
    els.splitFilter.value = "";
    els.limitFilter.value = "30";
    runSearch();
  });
  els.fitGraph.addEventListener("click", () => {
    setGraphZoom(1);
  });
  els.toggleLabels.addEventListener("click", () => {
    state.showLabels = !state.showLabels;
    els.toggleLabels.setAttribute("aria-pressed", state.showLabels ? "true" : "false");
    if (state.selectedPath) renderGraph(state.selectedPath.nodes, state.selectedPath.edges);
  });
  els.reloadClusters.addEventListener("click", loadClusters);

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (state.selectedPath) renderGraph(state.selectedPath.nodes, state.selectedPath.edges);
    }, 140);
  });
}

function initIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

async function init() {
  els.apiBase.value = state.apiBase;
  bindEvents();
  await checkHealth();
  runSearch();
  loadClusters();
  loadStats();
  initIcons();
  window.addEventListener("load", initIcons);
}

init();
