import os
from hashlib import sha1
from functools import lru_cache

from arango import ArangoClient
from flask import Flask, jsonify, request
from flask_cors import CORS


ARANGO_HOST = os.getenv("ARANGO_HOST", "http://127.0.0.1:8529")
ARANGO_DB = os.getenv("ARANGO_DB", "hotpotqa_arango")
ARANGO_USER = os.getenv("ARANGO_USER", "web_hotpot")
ARANGO_PASSWORD = os.getenv("ARANGO_PASSWORD", "change-me")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
POINT_COLLECTIONS = ["questions", "pages", "sentences", "answers", "clusters"]
EDGE_COLLECTIONS = [
    "question_context",
    "question_support",
    "question_answer",
    "question_cluster",
    "support_page_pair",
]

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": CORS_ORIGINS}})


@lru_cache(maxsize=1)
def get_db():
    client = ArangoClient(hosts=ARANGO_HOST)
    return client.db(ARANGO_DB, username=ARANGO_USER, password=ARANGO_PASSWORD)


def aql(query, bind_vars=None):
    cursor = get_db().aql.execute(query, bind_vars=bind_vars or {})
    return list(cursor)


def safe_limit(default=30, max_value=100):
    try:
        value = int(request.args.get("limit", str(default)))
    except (TypeError, ValueError):
        value = default
    return max(1, min(value, max_value))


def has_collection(name):
    try:
        return get_db().has_collection(name)
    except Exception:
        return False


def collection_count(name):
    try:
        db = get_db()
        return db.collection(name).count() if db.has_collection(name) else 0
    except Exception:
        return 0


@app.errorhandler(Exception)
def handle_exception(error):
    app.logger.exception("api error")
    return jsonify({"error": str(error), "type": error.__class__.__name__}), 500


@app.get("/api/health")
def health():
    collections = {name: collection_count(name) for name in POINT_COLLECTIONS + EDGE_COLLECTIONS}
    return jsonify({"status": "ok", "database": ARANGO_DB, "collections": collections})


@app.get("/api/search")
def search():
    keyword = request.args.get("q", "").strip()[:200]
    level = request.args.get("level", "").strip()
    qtype = request.args.get("type", "").strip()
    split = request.args.get("split", "").strip()
    limit = safe_limit()

    query = """
    FOR q IN questions
      FILTER @kw == ""
        OR CONTAINS(LOWER(q.question), LOWER(@kw))
        OR CONTAINS(LOWER(q.answer), LOWER(@kw))
      FILTER @level == "" OR q.level == @level
      FILTER @type == "" OR q.type == @type
      FILTER @split == "" OR q.split == @split
      SORT q.split, q._key
      LIMIT @limit
      RETURN {
        key: q._key,
        orig_id: q.orig_id,
        split: q.split,
        question: q.question,
        answer: q.answer,
        type: q.type,
        level: q.level,
        n_context_pages: q.n_context_pages,
        n_supporting_facts: q.n_supporting_facts
      }
    """
    return jsonify(
        aql(
            query,
            {
                "kw": keyword,
                "level": level,
                "type": qtype,
                "split": split,
                "limit": limit,
            },
        )
    )


@app.get("/api/question/<qid>")
def question_detail(qid):
    rows = aql(
        """
    LET q = DOCUMENT(CONCAT("questions/", @qid))
    FILTER q != null
    RETURN {
      key: q._key,
      orig_id: q.orig_id,
      split: q.split,
      question: q.question,
      answer: q.answer,
      answer_doc: null,
      type: q.type,
      level: q.level,
      context_titles: q.context_titles,
      support_titles: q.support_titles
    }
    """,
        {"qid": qid},
    )
    if not rows:
        return jsonify({})

    detail = rows[0]
    detail["answer_doc"] = None
    detail["cluster"] = None

    if has_collection("question_answer") and has_collection("answers"):
        answer_rows = aql(
            """
        FOR e IN question_answer
          FILTER e._from == CONCAT("questions/", @qid)
          RETURN DOCUMENT(e._to)
        """,
            {"qid": qid},
        )
        detail["answer_doc"] = answer_rows[0] if answer_rows else None

    if has_collection("question_cluster") and has_collection("clusters"):
        cluster_rows = aql(
            """
        FOR e IN question_cluster
          FILTER e._from == CONCAT("questions/", @qid)
          RETURN DOCUMENT(e._to)
        """,
            {"qid": qid},
        )
        detail["cluster"] = cluster_rows[0] if cluster_rows else None

    return jsonify(detail)


@app.get("/api/question/<qid>/path")
def evidence_path(qid):
    question_rows = aql(
        """
    LET q = DOCUMENT(CONCAT("questions/", @qid))
    FILTER q != null
    RETURN {
        key: q._key,
        orig_id: q.orig_id,
        split: q.split,
        text: q.question,
        answer: q.answer,
        type: q.type,
        level: q.level
    }
    """,
        {"qid": qid},
    )
    if not question_rows:
        return jsonify({"nodes": [], "edges": [], "support": [], "context": []})

    q = question_rows[0]
    support = []
    context = []
    pairs = []
    cluster = None

    if has_collection("question_support") and has_collection("sentences") and has_collection("pages"):
        support = aql(
            """
        FOR e IN question_support
          FILTER e._from == CONCAT("questions/", @qid)
          LET s = DOCUMENT(e._to)
          FILTER s != null
          LET p = DOCUMENT(CONCAT("pages/", s.page_key))
          FILTER p != null
          SORT e.support_rank
          RETURN {
            rank: e.support_rank,
            sentence_key: s._key,
            page_key: p._key,
            page_title: p.title,
            sent_id: s.sent_id,
            sentence: s.text
          }
        """,
            {"qid": qid},
        )

    if has_collection("question_context") and has_collection("pages"):
        context = aql(
            """
        FOR e IN question_context
          FILTER e._from == CONCAT("questions/", @qid)
          LET p = DOCUMENT(e._to)
          FILTER p != null
          SORT e.rank
          RETURN {rank: e.rank, page_key: p._key, page_title: p.title}
        """,
            {"qid": qid},
        )

    if has_collection("support_page_pair") and has_collection("pages"):
        pairs = aql(
            """
        FOR e IN support_page_pair
          FILTER e.question_key == @qid
          LET source = DOCUMENT(e._from)
          LET target = DOCUMENT(e._to)
          FILTER source != null AND target != null
          RETURN {
            source_key: PARSE_IDENTIFIER(e._from).key,
            target_key: PARSE_IDENTIFIER(e._to).key,
            source_title: e.source_title ? e.source_title : source.title,
            target_title: e.target_title ? e.target_title : target.title
          }
        """,
            {"qid": qid},
        )

    if has_collection("question_cluster") and has_collection("clusters"):
        cluster_rows = aql(
            """
        FOR e IN question_cluster
          FILTER e._from == CONCAT("questions/", @qid)
          LET c = DOCUMENT(e._to)
          FILTER c != null
          LIMIT 1
          RETURN {
            key: c._key,
            cluster_id: c.cluster_id,
            size: c.size,
            keywords: c.keywords,
            source: "kmeans"
          }
        """,
            {"qid": qid},
        )
        cluster = cluster_rows[0] if cluster_rows else None

    if cluster is None:
        cluster_id = f"{q.get('type') or '-'} / {q.get('level') or '-'}"
        cluster = {
            "key": sha1(cluster_id.encode("utf-8")).hexdigest(),
            "cluster_id": cluster_id,
            "size": None,
            "keywords": cluster_id.split(" / "),
            "source": "type_level_fallback",
        }

    nodes = []
    edges = []
    seen = set()

    def add_node(node_id, label, detail, kind):
        if not node_id or node_id in seen:
            return
        seen.add(node_id)
        nodes.append({"id": node_id, "label": label or node_id, "detail": detail or "", "kind": kind})

    qid_node = f"q:{q['key']}"
    answer_node = f"a:{q['key']}"
    add_node(qid_node, "Question", q["text"], "question")
    add_node(answer_node, "Answer", q["answer"], "answer")
    edges.append({"source": qid_node, "target": answer_node, "label": "answer"})

    for row in context:
        pid = f"p:{row['page_key']}"
        add_node(pid, row["page_title"], f"context rank {row['rank']}", "page")
        edges.append({"source": qid_node, "target": pid, "label": "context"})

    for row in support:
        pid = f"p:{row['page_key']}"
        sid = f"s:{row['sentence_key']}"
        add_node(pid, row["page_title"], "support page", "page")
        add_node(sid, f"S{row['sent_id']}", row["sentence"], "sentence")
        edges.append({"source": qid_node, "target": sid, "label": f"support {row['rank']}"})
        edges.append({"source": pid, "target": sid, "label": "support"})
        if q.get("answer") and q["answer"].lower() in (row.get("sentence") or "").lower():
            edges.append({"source": pid, "target": answer_node, "label": "answer"})

    for row in pairs:
        source = f"p:{row['source_key']}"
        target = f"p:{row['target_key']}"
        add_node(source, row["source_title"], "co-support page", "page")
        add_node(target, row["target_title"], "co-support page", "page")
        edges.append({"source": source, "target": target, "label": "co-support"})

    # Keep edge endpoints valid even if upstream data is sparse.
    valid_ids = {node["id"] for node in nodes}
    edges = [edge for edge in edges if edge["source"] in valid_ids and edge["target"] in valid_ids]

    return jsonify(
        {
            "question": q,
            "nodes": nodes,
            "edges": edges,
            "support": support,
            "context": context,
            "cluster": cluster,
        }
    )


@app.get("/api/evidence/search")
def evidence_search():
    keyword = request.args.get("q", "").strip()[:200]
    limit = safe_limit()
    query = """
    FOR s IN sentences
      FILTER @kw == "" OR CONTAINS(LOWER(s.text), LOWER(@kw))
      LET p = DOCUMENT(CONCAT("pages/", s.page_key))
      FILTER p != null
      LIMIT @limit
      RETURN {
        sentence_key: s._key,
        page_title: p.title,
        sent_id: s.sent_id,
        sentence: s.text
      }
    """
    return jsonify(aql(query, {"kw": keyword, "limit": limit}))


@app.get("/api/clusters")
def clusters():
    if has_collection("clusters") and get_db().collection("clusters").count() > 0:
        query = """
        FOR c IN clusters
          SORT c.cluster_id
          RETURN {
            key: c._key,
            cluster_id: c.cluster_id,
            size: c.size,
            keywords: c.keywords,
            source: "kmeans"
          }
        """
        return jsonify(aql(query))

    query = """
    FOR q IN questions
      COLLECT cluster_id = CONCAT(q.type, " / ", q.level) WITH COUNT INTO size
      SORT size DESC
      RETURN {
        key: SHA1(cluster_id),
        cluster_id: cluster_id,
        size: size,
        keywords: SPLIT(cluster_id, " / "),
        source: "type_level_fallback"
      }
    """
    return jsonify(aql(query))


@app.get("/api/cluster/<cluster_key>/questions")
def cluster_questions(cluster_key):
    limit = safe_limit()
    if has_collection("question_cluster") and has_collection("clusters"):
        query = """
        FOR e IN question_cluster
          FILTER e._to == CONCAT("clusters/", @cluster_key)
          LET q = DOCUMENT(e._from)
          FILTER q != null
          LIMIT @limit
          RETURN {
            key: q._key,
            orig_id: q.orig_id,
            question: q.question,
            answer: q.answer,
            type: q.type,
            level: q.level,
            split: q.split,
            n_context_pages: q.n_context_pages,
            n_supporting_facts: q.n_supporting_facts
          }
        """
        rows = aql(query, {"cluster_key": cluster_key, "limit": limit})
        if rows:
            return jsonify(rows)

    query = """
    FOR q IN questions
      LET fallback_key = SHA1(CONCAT(q.type, " / ", q.level))
      FILTER fallback_key == @cluster_key
      LIMIT @limit
      RETURN {
        key: q._key,
        orig_id: q.orig_id,
        question: q.question,
        answer: q.answer,
        type: q.type,
        level: q.level,
        split: q.split,
        n_context_pages: q.n_context_pages,
        n_supporting_facts: q.n_supporting_facts
      }
    """
    return jsonify(aql(query, {"cluster_key": cluster_key, "limit": limit}))


@app.get("/api/stats")
def stats():
    query = """
    RETURN {
      by_type: (
        FOR q IN questions
          COLLECT name = q.type WITH COUNT INTO value
          SORT value DESC
          RETURN {name, value}
      ),
      by_level: (
        FOR q IN questions
          COLLECT name = q.level WITH COUNT INTO value
          SORT value DESC
          RETURN {name, value}
      )
    }
    """
    rows = aql(query)
    return jsonify(rows[0] if rows else {"by_type": [], "by_level": []})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)
