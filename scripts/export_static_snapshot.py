"""Export a small HotpotQA static API snapshot for GitHub Pages.

The snapshot mirrors the Flask API contract used by the frontend. It is a
public sample data package, not a replacement for the internal ArangoDB backend.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pyarrow.parquet as pq


DEFAULT_INPUT = Path("../hotpot_qa/fullwiki/train-00000-of-00002.parquet")
DEFAULT_OUTPUT = Path("frontend/static-api")
DEFAULT_SAMPLE_SIZE = 600

STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "what",
    "which",
    "were",
    "where",
    "when",
    "who",
    "whose",
    "does",
    "did",
    "are",
    "was",
    "same",
    "than",
    "have",
    "has",
    "his",
    "her",
    "their",
    "its",
    "into",
    "between",
    "about",
    "after",
    "before",
    "first",
    "name",
}


def sha1(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def doc_key(prefix: str, value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", value.lower()).strip("_")
    slug = slug[:40] or "item"
    return f"{prefix}_{slug}_{sha1(value)[:8]}"


def question_key(split: str, orig_id: str) -> str:
    return f"fullwiki__{split}__{orig_id}"


def clean_sentence(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def top_keywords(rows: list[dict], max_words: int = 6) -> list[str]:
    counter: Counter[str] = Counter()
    for row in rows:
        text = f"{row.get('question', '')} {row.get('answer', '')}".lower()
        for word in re.findall(r"[a-z][a-z0-9]{2,}", text):
            if word not in STOPWORDS:
                counter[word] += 1
    return [word for word, _ in counter.most_common(max_words)]


def make_search_row(row: dict, split: str) -> dict:
    support_titles = row["supporting_facts"]["title"] or []
    context_titles = row["context"]["title"] or []
    return {
        "key": question_key(split, row["id"]),
        "orig_id": row["id"],
        "split": split,
        "question": clean_sentence(row["question"]),
        "answer": clean_sentence(row["answer"]),
        "type": row["type"],
        "level": row["level"],
        "n_context_pages": len(context_titles),
        "n_supporting_facts": len(support_titles),
    }


def make_path(row: dict, split: str, cluster: dict) -> dict:
    q_key = question_key(split, row["id"])
    q_node = f"q:{q_key}"
    a_node = f"a:{q_key}"
    answer = clean_sentence(row["answer"])
    context_titles = row["context"]["title"] or []
    context_sentences = row["context"]["sentences"] or []
    support_titles = row["supporting_facts"]["title"] or []
    support_sent_ids = row["supporting_facts"]["sent_id"] or []

    nodes: list[dict] = [
        {"id": q_node, "label": "Question", "detail": clean_sentence(row["question"]), "kind": "question"},
        {"id": a_node, "label": "Answer", "detail": answer, "kind": "answer"},
    ]
    edges: list[dict] = [{"source": q_node, "target": a_node, "label": "answer"}]
    context: list[dict] = []
    support: list[dict] = []
    page_ids: dict[str, str] = {}

    for rank, title in enumerate(context_titles, start=1):
        title = str(title)
        p_id = f"p:{doc_key('page', title)}"
        page_ids[title] = p_id
        nodes.append({"id": p_id, "label": title, "detail": f"context rank {rank}", "kind": "page"})
        edges.append({"source": q_node, "target": p_id, "label": "context"})
        context.append({"rank": rank, "page_key": p_id.split(":", 1)[1], "page_title": title})

    for rank, (title, sent_id) in enumerate(zip(support_titles, support_sent_ids), start=1):
        title = str(title)
        p_id = page_ids.get(title)
        if not p_id:
            p_id = f"p:{doc_key('page', title)}"
            page_ids[title] = p_id
            nodes.append({"id": p_id, "label": title, "detail": "support page", "kind": "page"})

        sentence_text = ""
        if title in context_titles:
            title_index = context_titles.index(title)
            sentences = context_sentences[title_index] or []
            if 0 <= sent_id < len(sentences):
                sentence_text = clean_sentence(sentences[sent_id])
        if not sentence_text:
            sentence_text = f"Supporting sentence {sent_id} from {title}."

        s_id = f"s:{doc_key('sent', f'{title}:{sent_id}:{q_key}')}"
        nodes.append({"id": s_id, "label": f"S{sent_id}", "detail": sentence_text, "kind": "sentence"})
        edges.append({"source": q_node, "target": s_id, "label": f"support {rank}"})
        edges.append({"source": p_id, "target": s_id, "label": "support"})
        if answer and answer.lower() in sentence_text.lower():
            edges.append({"source": p_id, "target": a_node, "label": "answer"})

        support.append(
            {
                "rank": rank,
                "sentence_key": s_id.split(":", 1)[1],
                "page_key": p_id.split(":", 1)[1],
                "page_title": title,
                "sent_id": sent_id,
                "sentence": sentence_text,
            }
        )

    support_pages = []
    for title in support_titles:
        p_id = page_ids.get(str(title))
        if p_id and p_id not in support_pages:
            support_pages.append(p_id)
    for source, target in zip(support_pages, support_pages[1:]):
        edges.append({"source": source, "target": target, "label": "co-support"})

    if not any(edge["target"] == a_node and edge["source"] != q_node for edge in edges) and support_pages:
        edges.append({"source": support_pages[-1], "target": a_node, "label": "answer"})

    valid = {node["id"] for node in nodes}
    edges = [edge for edge in edges if edge["source"] in valid and edge["target"] in valid]

    return {
        "question": {
            "key": q_key,
            "orig_id": row["id"],
            "split": split,
            "text": clean_sentence(row["question"]),
            "answer": answer,
            "type": row["type"],
            "level": row["level"],
        },
        "nodes": nodes,
        "edges": edges,
        "support": support,
        "context": context,
        "cluster": cluster,
    }


def select_rows(rows: list[dict], sample_size: int) -> list[dict]:
    priority_terms = ["nationality", "director", "birthplace", "author", "country", "same"]
    per_term_limit = max(20, sample_size // (len(priority_terms) * 3))
    selected: list[dict] = []
    seen: set[str] = set()

    for term in priority_terms:
        added = 0
        for row in rows:
            if row["id"] in seen:
                continue
            haystack = f"{row['question']} {row['answer']}".lower()
            if term in haystack:
                selected.append(row)
                seen.add(row["id"])
                added += 1
                if len(selected) >= sample_size:
                    return selected
                if added >= per_term_limit:
                    break

    buckets: defaultdict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in rows:
        if row["id"] not in seen:
            buckets[(row["type"], row["level"])].append(row)

    while len(selected) < sample_size and any(buckets.values()):
        for key in sorted(list(buckets.keys())):
            if buckets[key]:
                row = buckets[key].pop(0)
                selected.append(row)
                seen.add(row["id"])
                if len(selected) >= sample_size:
                    break
    return selected


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--sample-size", type=int, default=DEFAULT_SAMPLE_SIZE)
    parser.add_argument("--split", default="train")
    args = parser.parse_args()

    table = pq.read_table(args.input)
    rows = table.to_pylist()
    selected = select_rows(rows, args.sample_size)

    all_search_rows = [make_search_row(row, args.split) for row in rows]
    search_rows = [make_search_row(row, args.split) for row in selected]

    type_counts = Counter(row["type"] for row in rows)
    level_counts = Counter(row["level"] for row in rows)

    clusters: list[dict] = []
    cluster_rows: dict[str, list[dict]] = {}
    grouped_all: defaultdict[tuple[str, str], list[dict]] = defaultdict(list)
    grouped_selected: defaultdict[tuple[str, str], list[dict]] = defaultdict(list)

    for row in rows:
        grouped_all[(row["type"], row["level"])].append(make_search_row(row, args.split))
    for row in search_rows:
        grouped_selected[(row["type"], row["level"])].append(row)

    for (qtype, level), full_group in sorted(grouped_all.items(), key=lambda item: len(item[1]), reverse=True):
        cluster_id = f"{qtype} / {level}"
        key = sha1(cluster_id)
        representative = grouped_selected.get((qtype, level), full_group[:20])
        clusters.append(
            {
                "key": key,
                "cluster_id": cluster_id,
                "size": len(full_group),
                "keywords": top_keywords(representative),
                "source": "type_level_fallback_snapshot",
                "sample_question": clean_sentence(representative[0]["question"]) if representative else "",
            }
        )
        cluster_rows[key] = representative[:30]

    cluster_by_question = {
        row["key"]: {
            "key": sha1(f"{row['type']} / {row['level']}"),
            "cluster_id": f"{row['type']} / {row['level']}",
            "size": len(grouped_all[(row["type"], row["level"])]),
            "keywords": top_keywords(grouped_selected.get((row["type"], row["level"]), [row])),
            "source": "type_level_fallback_snapshot",
        }
        for row in search_rows
    }

    paths = {
        make_search_row(row, args.split)["key"]: make_path(
            row,
            args.split,
            cluster_by_question[make_search_row(row, args.split)["key"]],
        )
        for row in selected
    }
    snapshot_page_titles: set[str] = set()
    for path in paths.values():
        snapshot_page_titles.update(item["page_title"] for item in path["context"])
        snapshot_page_titles.update(item["page_title"] for item in path["support"])

    page_titles: set[str] = set()
    sentence_count = 0
    context_edge_count = 0
    support_edge_count = 0
    for row in rows:
        titles = row["context"]["title"] or []
        sentence_lists = row["context"]["sentences"] or []
        page_titles.update(str(title) for title in titles)
        sentence_count += sum(len(sentences or []) for sentences in sentence_lists)
        context_edge_count += len(titles)
        support_edge_count += len(row["supporting_facts"]["title"] or [])

    generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    health = {
        "status": "ok",
        "database": "hotpotqa_arango_static_snapshot",
        "collections": {
            "questions": len(search_rows),
            "pages": len(snapshot_page_titles),
            "sentences": sum(len(path["support"]) for path in paths.values()),
            "answers": len(search_rows),
            "clusters": len(clusters),
            "question_context": sum(len(path["context"]) for path in paths.values()),
            "question_support": sum(len(path["support"]) for path in paths.values()),
            "question_answer": len(search_rows),
            "question_cluster": len(search_rows),
            "support_page_pair": sum(max(0, item["n_supporting_facts"] - 1) for item in search_rows),
        },
        "mode": "static_snapshot",
        "pseudo": True,
        "snapshot": {
            "generated_at": generated_at,
            "source": str(args.input).replace("\\", "/"),
            "available_questions": len(search_rows),
            "available_paths": len(paths),
            "scope": f"HotpotQA fullwiki {args.split} static sample",
            "source_counts": {
                "questions": len(rows),
                "pages": len(page_titles),
                "sentences": sentence_count,
                "question_context": context_edge_count,
                "question_support": support_edge_count,
                "question_answer": len(rows),
                "question_cluster": len(rows),
                "support_page_pair": sum(max(0, item["n_supporting_facts"] - 1) for item in all_search_rows),
            },
        },
    }

    stats = {
        "by_type": [{"name": name, "value": value} for name, value in type_counts.most_common()],
        "by_level": [{"name": name, "value": value} for name, value in level_counts.most_common()],
    }
    manifest = {
        "name": "HotpotQA static API snapshot",
        "generated_at": generated_at,
        "source": str(args.input).replace("\\", "/"),
        "api_contract": "compatible with backend/app.py read-only endpoints",
        "files": [
            "health.json",
            "stats.json",
            "clusters.json",
            "search-index.json",
            "paths.json",
            "cluster-questions.json",
        ],
    }

    args.output.mkdir(parents=True, exist_ok=True)
    payloads = {
        "manifest.json": manifest,
        "health.json": health,
        "stats.json": stats,
        "clusters.json": clusters,
        "search-index.json": search_rows,
        "paths.json": paths,
        "cluster-questions.json": cluster_rows,
    }
    for filename, payload in payloads.items():
        target = args.output / filename
        target.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"wrote {target} ({target.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
