(function () {
  const DATA_BASE = "data/";
  const cache = new Map();

  function abortError() {
    const error = new Error("request aborted");
    error.name = "AbortError";
    return error;
  }

  function assertNotAborted(signal) {
    if (signal && signal.aborted) throw abortError();
  }

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function clampLimit(value, fallback = 30) {
    const number = Number.parseInt(value || String(fallback), 10);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(1, Math.min(number, 100));
  }

  function delay(ms, signal) {
    return new Promise((resolve, reject) => {
      assertNotAborted(signal);
      const timer = window.setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener(
          "abort",
          () => {
            window.clearTimeout(timer);
            reject(abortError());
          },
          { once: true }
        );
      }
    });
  }

  async function readJson(filename, signal) {
    assertNotAborted(signal);
    if (cache.has(filename)) return clone(cache.get(filename));
    const response = await fetch(`${DATA_BASE}${filename}`, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`data file missing ${filename}: ${response.status}`);
    }
    const data = await response.json();
    cache.set(filename, data);
    return clone(data);
  }

  function filterSearch(rows, params) {
    const keyword = (params.get("q") || "").trim().toLowerCase();
    const type = params.get("type") || "";
    const level = params.get("level") || "";
    const split = params.get("split") || "";
    const limit = clampLimit(params.get("limit"));
    return rows
      .filter((row) => !keyword || `${row.question} ${row.answer}`.toLowerCase().includes(keyword))
      .filter((row) => !type || row.type === type)
      .filter((row) => !level || row.level === level)
      .filter((row) => !split || row.split === split)
      .sort((a, b) => `${a.split}:${a.key}`.localeCompare(`${b.split}:${b.key}`))
      .slice(0, limit);
  }

  async function fetchJson(path, options = {}) {
    const signal = options.controller ? options.controller.signal : options.signal;
    const url = new URL(path, window.location.origin);
    await delay(90 + Math.floor(Math.random() * 70), signal);
    assertNotAborted(signal);

    if (url.pathname === "/api/health") {
      return readJson("health.json", signal);
    }

    if (url.pathname === "/api/search") {
      const rows = await readJson("search-index.json", signal);
      return filterSearch(rows, url.searchParams);
    }

    const pathMatch = url.pathname.match(/^\/api\/question\/([^/]+)\/path$/);
    if (pathMatch) {
      const key = decodeURIComponent(pathMatch[1]);
      const paths = await readJson("paths.json", signal);
      if (paths[key]) return paths[key];
      const error = new Error(`data package does not include question path: ${key}`);
      error.status = 404;
      error.type = "SnapshotMiss";
      throw error;
    }

    if (url.pathname === "/api/clusters") {
      return readJson("clusters.json", signal);
    }

    const clusterMatch = url.pathname.match(/^\/api\/cluster\/([^/]+)\/questions$/);
    if (clusterMatch) {
      const key = decodeURIComponent(clusterMatch[1]);
      const limit = clampLimit(url.searchParams.get("limit"), 5);
      const clusterQuestions = await readJson("cluster-questions.json", signal);
      return (clusterQuestions[key] || []).slice(0, limit);
    }

    if (url.pathname === "/api/stats") {
      return readJson("stats.json", signal);
    }

    const error = new Error(`data route not found: ${url.pathname}`);
    error.status = 404;
    error.type = "NotFound";
    throw error;
  }

  window.hotpotDataService = {
    mode: "data_package",
    fetchJson,
  };
})();
