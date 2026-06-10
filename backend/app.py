import os
from functools import lru_cache

from arango import ArangoClient
from flask import Flask, jsonify, request
from flask_cors import CORS


ARANGO_HOST = os.getenv("ARANGO_HOST", "http://127.0.0.1:8529")
ARANGO_DB = os.getenv("ARANGO_DB", "hotpotqa_arango")
ARANGO_USER = os.getenv("ARANGO_USER", "web_hotpot")
ARANGO_PASSWORD = os.getenv("ARANGO_PASSWORD", "设置一个只读密码")

app = Flask(__name__)
CORS(app)


@lru_cache(maxsize=1)
def get_db():
    client = ArangoClient(hosts=ARANGO_HOST)
    return client.db(ARANGO_DB, username=ARANGO_USER, password=ARANGO_PASSWORD)


def aql(query, bind_vars=None):
    cursor = get_db().aql.execute(query, bind_vars=bind_vars or {})
    return list(cursor)


@app.get("/api/health")
def health():
    return jsonify(
        {
            "status": "ok",
            "database": ARANGO_DB,
            "collections": {
                "questions": get_db().collection("questions").count(),
                "pages": get_db().collection("pages").count(),
                "sentences": get_db().collection("sentences").count(),
                "clusters": get_db().collection("clusters").count()
                if get_db().has_collection("clusters")
                else 0,
            },
        }
    )


@app.get("/api/search")
def search():
    keyword = request.args.get("q", "").strip()
    level = request.args.get("level", "").strip()
    qtype = request.args.get("type", "").strip()
    limit = min(int(request.args.get("limit", "30")), 100)

    query = """
    FOR q IN questions
      FILTER @kw == ""
        OR CONTAINS(LOWER(q.question), LOWER(@kw))
        OR CONTAINS(LOWER(q.answer), LOWER(@kw))
      FILTER @level == "" OR q.level == @level
      FILTER @type == "" OR q.type == @type
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
    return jsonify(aql(query, {"kw": keyword, "level": level, "type": qtype, "limit": limit}))


@app.get("/api/question/<qid>")
def question_detail(qid):
    query = """
    LET q = DOCUMENT(CONCAT("questions/", @qid))
    FILTER q != null
    LET answer = FIRST(
      FOR e IN question_answer
        FILTER e._from == q._id
        RETURN DOCUMENT(e._to)
    )
    LET cluster = FIRST(
      FOR e IN question_cluster
        FILTER e._from == q._id
        RETURN DOCUMENT(e._to)
    )
    RETURN {
      key: q._key,
      orig_id: q.orig_id,
      split: q.split,
      question: q.question,
      answer: q.answer,
      answer_doc: answer,
      type: q.type,
      level: q.level,
      context_titles: q.context_titles,
      support_titles: q.support_titles,
      cluster: cluster
    }
    """
    rows = aql(query, {"qid": qid})
    return jsonify(rows[0] if rows else {})


@app.get("/api/question/<qid>/path")
def evidence_path(qid):
    query = """
    LET q = DOCUMENT(CONCAT("questions/", @qid))
    FILTER q != null
    LET support = (
      FOR e IN question_support
        FILTER e._from == q._id
        LET s = DOCUMENT(e._to)
        LET p = DOCUMENT(CONCAT("pages/", s.page_key))
        SORT e.support_rank
        RETURN {
          rank: e.support_rank,
          sentence_key: s._key,
          page_key: p._key,
          page_title: p.title,
          sent_id: s.sent_id,
          sentence: s.text
        }
    )
    LET context = (
      FOR e IN question_context
        FILTER e._from == q._id
        LET p = DOCUMENT(e._to)
        SORT e.rank
        RETURN {rank: e.rank, page_key: p._key, page_title: p.title}
    )
    LET answer = FIRST(
      FOR e IN question_answer
        FILTER e._from == q._id
        LET a = DOCUMENT(e._to)
        RETURN a
    )
    LET pairs = (
      FOR e IN support_page_pair
        FILTER e.question_key == q._key
        RETURN {
          source_key: PARSE_IDENTIFIER(e._from).key,
          target_key: PARSE_IDENTIFIER(e._to).key,
          source_title: e.source_title,
          target_title: e.target_title
        }
    )
    RETURN {
      question: {
        key: q._key,
        text: q.question,
        answer: q.answer,
        type: q.type,
        level: q.level
      },
      answer: answer,
      support: support,
      context: context,
      support_pairs: pairs
    }
    """
    rows = aql(query, {"qid": qid})
    if not rows:
        return jsonify({"nodes": [], "edges": [], "support": [], "context": []})

    data = rows[0]
    q = data["question"]
    nodes = [
        {
            "id": f"q:{q['key']}",
            "label": "Question",
            "detail": q["text"],
            "kind": "question",
        },
        {
            "id": f"a:{q['key']}",
            "label": "Answer",
            "detail": q["answer"],
            "kind": "answer",
        },
    ]
    edges = [{"source": f"q:{q['key']}", "target": f"a:{q['key']}", "label": "answers"}]

    seen_pages = set()
    for row in data["context"]:
        pid = f"p:{row['page_key']}"
        if pid not in seen_pages:
            nodes.append(
                {
                    "id": pid,
                    "label": row["page_title"],
                    "detail": f"context rank {row['rank']}",
                    "kind": "page",
                }
            )
            seen_pages.add(pid)
        edges.append({"source": f"q:{q['key']}", "target": pid, "label": "context"})

    for row in data["support"]:
        pid = f"p:{row['page_key']}"
        sid = f"s:{row['sentence_key']}"
        if pid not in seen_pages:
            nodes.append({"id": pid, "label": row["page_title"], "detail": "", "kind": "page"})
            seen_pages.add(pid)
        nodes.append(
            {
                "id": sid,
                "label": f"S{row['sent_id']}",
                "detail": row["sentence"],
                "kind": "sentence",
            }
        )
        edges.append({"source": f"q:{q['key']}", "target": sid, "label": f"support {row['rank']}"})
        edges.append({"source": sid, "target": pid, "label": "in page"})

    for row in data["support_pairs"]:
        edges.append(
            {
                "source": f"p:{row['source_key']}",
                "target": f"p:{row['target_key']}",
                "label": "co-support",
            }
        )

    return jsonify(
        {
            "question": q,
            "nodes": nodes,
            "edges": edges,
            "support": data["support"],
            "context": data["context"],
        }
    )


@app.get("/api/evidence/search")
def evidence_search():
    keyword = request.args.get("q", "").strip()
    limit = min(int(request.args.get("limit", "30")), 100)
    query = """
    FOR s IN sentences
      FILTER @kw == "" OR CONTAINS(LOWER(s.text), LOWER(@kw))
      LET p = DOCUMENT(CONCAT("pages/", s.page_key))
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
    query = """
    LET stored = (
      FOR c IN clusters
        SORT c.cluster_id
        RETURN {
          key: c._key,
          cluster_id: c.cluster_id,
          size: c.size,
          keywords: c.keywords,
          source: "kmeans"
        }
    )
    RETURN LENGTH(stored) > 0 ? stored : (
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
    )
    """
    rows = aql(query)
    return jsonify(rows[0] if rows else [])


@app.get("/api/cluster/<cluster_key>/questions")
def cluster_questions(cluster_key):
    limit = min(int(request.args.get("limit", "30")), 100)
    query = """
    LET direct = (
      FOR e IN question_cluster
        FILTER e._to == CONCAT("clusters/", @cluster_key)
        LET q = DOCUMENT(e._from)
        LIMIT @limit
        RETURN {
          key: q._key,
          question: q.question,
          answer: q.answer,
          type: q.type,
          level: q.level
        }
    )
    RETURN direct
    """
    rows = aql(query, {"cluster_key": cluster_key, "limit": limit})
    return jsonify(rows[0] if rows else [])


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
