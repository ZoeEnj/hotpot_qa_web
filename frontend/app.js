const DEMO_MODE_LABEL = "demo data";
const STORAGE_KEY = "hotpot_api_base";

const demo = {
  health: {
    status: "demo",
    collections: {
      questions: 192606,
      pages: 5239,
      sentences: 446122,
      clusters: 128,
    },
  },
  results: [
    {
      key: "demo_question_1",
      orig_id: "5ad3a5e45542994a48eab92a",
      split: "train",
      question: "What is the nationality of the director of The Patriot?",
      answer: "German",
      type: "bridge",
      level: "medium",
      n_supporting_facts: 4,
      n_context_pages: 3,
    },
    {
      key: "demo_question_2",
      orig_id: "demo_2",
      split: "train",
      question: "What country does the player who plays Harry Potter for Chelsea represent?",
      answer: "England",
      type: "bridge",
      level: "medium",
      n_supporting_facts: 4,
      n_context_pages: 4,
    },
    {
      key: "demo_question_3",
      orig_id: "demo_3",
      split: "validation",
      question: "Which author wrote the book that inspired the movie Shrek?",
      answer: "William Steig",
      type: "bridge",
      level: "easy",
      n_supporting_facts: 3,
      n_context_pages: 5,
    },
    {
      key: "demo_question_4",
      orig_id: "demo_4",
      split: "train",
      question: "Which city is the birthplace of the author of The Da Vinci Code?",
      answer: "New York City",
      type: "bridge",
      level: "medium",
      n_supporting_facts: 3,
      n_context_pages: 4,
    },
  ],
  path: {
    question: {
      key: "demo_question_1",
      text: "What is the nationality of the director of The Patriot?",
      answer: "German",
      type: "bridge",
      level: "medium",
      orig_id: "5ad3a5e45542994a48eab92a",
      split: "train",
    },
    nodes: [
      { id: "q:demo_question_1", label: "Question", detail: "What is the nationality of the director of The Patriot?", kind: "question" },
      { id: "p:patriot", label: "The Patriot (2000 film)", detail: "support page", kind: "page" },
      { id: "p:roland", label: "Roland Emmerich", detail: "support page", kind: "page" },
      { id: "p:germany", label: "Germany", detail: "context page", kind: "page" },
      { id: "s:1", label: "S1", detail: "The Patriot is a 2000 historical war film.", kind: "sentence" },
      { id: "s:2", label: "S2", detail: "It was directed by Roland Emmerich.", kind: "sentence" },
      { id: "s:3", label: "S3", detail: "Roland Emmerich is a German film director.", kind: "sentence" },
      { id: "s:4", label: "S4", detail: "Emmerich was born in Stuttgart, Germany.", kind: "sentence" },
      { id: "a:demo_question_1", label: "Answer", detail: "German", kind: "answer" },
    ],
    edges: [
      { source: "q:demo_question_1", target: "p:patriot", label: "context" },
      { source: "q:demo_question_1", target: "p:roland", label: "context" },
      { source: "q:demo_question_1", target: "p:germany", label: "context" },
      { source: "p:patriot", target: "s:1", label: "support" },
      { source: "p:patriot", target: "s:2", label: "support" },
      { source: "p:roland", target: "s:3", label: "support" },
      { source: "p:roland", target: "s:4", label: "support" },
      { source: "p:patriot", target: "p:roland", label: "co-support" },
      { source: "p:roland", target: "a:demo_question_1", label: "answer" },
      { source: "p:germany", target: "a:demo_question_1", label: "answer" },
    ],
    support: [
      { rank: 1, page_title: "The Patriot (2000 film)", sent_id: 0, sentence: "The Patriot is a 2000 historical war film directed by Roland Emmerich." },
      { rank: 2, page_title: "The Patriot (2000 film)", sent_id: 1, sentence: "It was directed by Roland Emmerich." },
      { rank: 3, page_title: "Roland Emmerich", sent_id: 0, sentence: "Roland Emmerich is a German film director, producer, and screenwriter." },
      { rank: 4, page_title: "Roland Emmerich", sent_id: 3, sentence: "Emmerich was born in Stuttgart, Germany." },
    ],
    context: [
      { rank: 1, page_key: "patriot", page_title: "The Patriot (2000 film)" },
      { rank: 2, page_key: "roland", page_title: "Roland Emmerich" },
      { rank: 3, page_key: "germany", page_title: "Germany" },
    ],
  },
  clusters: [
    { key: "cluster_12", cluster_id: "12", size: 2184, keywords: ["film", "director", "germany", "europe", "biography"], source: "kmeans" },
    { key: "cluster_7", cluster_id: "7", size: 1736, keywords: ["book", "author", "novel", "writer", "literature"], source: "kmeans" },
    { key: "cluster_3", cluster_id: "3", size: 1523, keywords: ["city", "born", "birthplace", "american", "state"], source: "kmeans" },
    { key: "cluster_9", cluster_id: "9", size: 1287, keywords: ["sports", "team", "player", "league", "football"], source: "kmeans" },
  ],
  stats: {
    by_type: [
      { name: "bridge", value: 97842 },
      { name: "comparison", value: 94764 },
    ],
    by_level: [
      { name: "easy", value: 64912 },
      { name: "medium", value: 74245 },
      { name: "hard", value: 53449 },
    ],
  },
};

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
  searchRun: 0,
  pathRun: 0,
  searchAbort: null,
  pathAbort: null,
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
  if (configured) return configured;
  if (["localhost", "127.0.0.1", ""].includes(window.location.hostname)) {
    return "http://127.0.0.1:5000";
  }
  return "";
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

function endpoint(path) {
  return `${state.apiBase}${path}`;
}

async function fetchJson(path, options = {}) {
  if (!canUseApi()) throw new Error("API Base 未配置");
  const timeout = options.timeout || 12000;
  const controller = options.controller || new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
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
  } finally {
    window.clearTimeout(timer);
  }
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
  if (!canUseApi()) {
    setHealth("fail", "未配置后端", DEMO_MODE_LABEL);
    setCounts(demo.health.collections);
    return false;
  }
  try {
    const data = await fetchJson("/api/health", { timeout: 8000 });
    state.apiOnline = true;
    setHealth("ok", "后端连接正常", "200 OK");
    setCounts(data.collections || {});
    return true;
  } catch (error) {
    state.apiOnline = false;
    setHealth("fail", "后端不可达", shortError(error));
    setCounts(demo.health.collections);
    toast("后端不可达，页面保留演示数据。检查 API Base、CORS、HTTPS。");
    return false;
  }
}

async function runSearch(event) {
  if (event) event.preventDefault();
  const runId = ++state.searchRun;
  if (state.searchAbort) state.searchAbort.abort();
  state.searchAbort = new AbortController();

  clearPathState("正在检索...");
  renderLoading(els.results, 4);
  els.resultCount.textContent = "0";

  const filters = getFilters();
  try {
    const rows = canUseApi() && state.apiOnline
      ? await fetchJson(`/api/search?${filters.toString()}`, { controller: state.searchAbort })
      : await demoSearch(filters);
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
      state.results = await demoSearch(filters);
      renderResults();
      toast(`检索接口不可用，显示演示数据：${shortError(error)}`);
      if (state.results.length) await selectQuestion(state.results[0].key);
      return;
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

function demoSearch(params) {
  const keyword = (params.get("q") || "").toLowerCase();
  const type = params.get("type") || "";
  const level = params.get("level") || "";
  const split = params.get("split") || "";
  const limit = clampNumber(params.get("limit"), 1, 100, 30);
  const rows = demo.results
    .filter((row) => !keyword || `${row.question} ${row.answer}`.toLowerCase().includes(keyword))
    .filter((row) => !type || row.type === type)
    .filter((row) => !level || row.level === level)
    .filter((row) => !split || row.split === split)
    .slice(0, limit);
  return delay(rows, 180);
}

function delay(value, ms) {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), ms));
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
    const data = canUseApi() && state.apiOnline
      ? await fetchJson(`/api/question/${encodeURIComponent(key)}/path`, { controller: state.pathAbort })
      : await demoPath(key);
    if (runId !== state.pathRun) return;
    state.selectedPath = normalizePath(data);
    state.graphZoom = 1;
    renderSelectedPath();
  } catch (error) {
    if (error.name === "AbortError") return;
    if (runId !== state.pathRun) return;
    if (canUseApi()) {
      state.apiOnline = false;
      state.selectedPath = normalizePath(await demoPath(key));
      renderSelectedPath();
      toast(`路径接口不可用，显示演示路径：${shortError(error)}`);
      return;
    }
    clearPathState("路径查询失败");
    renderError(els.graphCanvas, "路径查询失败", shortError(error));
    renderError(els.supportFacts, "支持事实不可用", shortError(error));
  }
}

function demoPath() {
  return delay(demo.path, 160);
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
  renderLoading(els.clusters, 3);
  try {
    const rows = canUseApi() && state.apiOnline ? await fetchJson("/api/clusters") : await delay(demo.clusters, 150);
    state.clusters = Array.isArray(rows) ? rows : [];
    renderClusters();
  } catch (error) {
    state.clusters = demo.clusters;
    renderClusters();
    toast(`聚类接口不可用，显示演示聚类：${shortError(error)}`);
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
  state.activeClusterKey = cluster.key;
  renderClusters();
  renderClusterInfo(cluster);
  if (!canUseApi() || !state.apiOnline) {
    toast(`已选择 Cluster ${safeText(cluster.cluster_id)}（演示数据）。`);
    return;
  }
  try {
    const rows = await fetchJson(`/api/cluster/${encodeURIComponent(cluster.key)}/questions?limit=5`);
    state.results = Array.isArray(rows) ? rows : [];
    renderResults();
    if (state.results.length) {
      toast(`已载入 Cluster ${safeText(cluster.cluster_id)} 的 ${state.results.length} 个问题。`);
      await selectQuestion(state.results[0].key);
      return;
    }
    toast(`Cluster ${safeText(cluster.cluster_id)} 暂无可下钻样例。`);
  } catch (error) {
    toast(`聚类下钻失败：${shortError(error)}`);
  }
}

function sampleClusterQuestion(cluster) {
  const words = (cluster.keywords || []).join(", ");
  if (/book|author|writer/i.test(words)) return "示例问题：Who wrote the book that inspired the movie?";
  if (/city|born|birth/i.test(words)) return "示例问题：Which city is the birthplace of the author?";
  if (/sport|team|player/i.test(words)) return "示例问题：Which team did the player represent?";
  return "示例问题：Who is the director of the referenced work?";
}

async function loadStats() {
  renderLoading(els.stats, 2);
  try {
    const stats = canUseApi() && state.apiOnline ? await fetchJson("/api/stats") : await delay(demo.stats, 150);
    renderStats(stats);
  } catch (error) {
    renderStats(demo.stats);
    toast(`统计接口不可用，显示演示统计：${shortError(error)}`);
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
    state.apiBase = normalizeApiBase(els.apiBase.value);
    safeStorageSet(STORAGE_KEY, state.apiBase);
    const online = await checkHealth();
    await runSearch();
    loadClusters();
    loadStats();
    if (!online) toast("已使用演示数据。请确认云主机 API 使用 HTTPS 并允许 GitHub Pages 跨域访问。");
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

function init() {
  els.apiBase.value = state.apiBase;
  bindEvents();
  runSearch();
  loadClusters();
  loadStats();
  checkHealth().then(() => {
    if (state.apiOnline) {
      runSearch();
      loadClusters();
      loadStats();
    }
  });
  initIcons();
  window.addEventListener("load", initIcons);
}

init();
