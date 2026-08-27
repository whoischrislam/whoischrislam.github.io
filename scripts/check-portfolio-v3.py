#!/usr/bin/env python3
"""Validate the inline v3 company/story model and its local assets.

The v3 data remains inline while the information architecture is evolving. This
check gives that temporary representation schema-like protection without making
the renderer migration a prerequisite.

    python3 scripts/check-portfolio-v3.py [index-v3.html]
"""

from __future__ import annotations

import json
import pathlib
import subprocess
import sys
from typing import Any


ROOT = pathlib.Path(__file__).resolve().parent.parent
ALLOWED_PLACEHOLDERS = {"READY", "CURATE", "CAPTURE", "RECREATE", "TEXT ONLY"}


def extract_object(source: str, declaration: str) -> str:
    marker = f"var {declaration} ="
    marker_at = source.find(marker)
    if marker_at < 0:
        raise ValueError(f"cannot find {marker}")
    start = source.find("{", marker_at + len(marker))
    if start < 0:
        raise ValueError(f"cannot find opening brace for {declaration}")

    depth = 0
    quote: str | None = None
    escaped = False
    line_comment = False
    block_comment = False
    i = start
    while i < len(source):
        char = source[i]
        nxt = source[i + 1] if i + 1 < len(source) else ""

        if line_comment:
            if char == "\n":
                line_comment = False
        elif block_comment:
            if char == "*" and nxt == "/":
                block_comment = False
                i += 1
        elif quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
        elif char == "/" and nxt == "/":
            line_comment = True
            i += 1
        elif char == "/" and nxt == "*":
            block_comment = True
            i += 1
        elif char in ("'", '"', "`"):
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return source[start : i + 1]
        i += 1

    raise ValueError(f"unterminated object for {declaration}")


def evaluate_object(literal: str, name: str) -> dict[str, Any]:
    node = subprocess.run(
        [
            "node",
            "-e",
            (
                "const vm=require('node:vm');let s='';"
                "process.stdin.setEncoding('utf8');"
                "process.stdin.on('data',d=>s+=d);"
                "process.stdin.on('end',()=>{"
                "const value=vm.runInNewContext('('+s+')',{}, {timeout:1000});"
                "process.stdout.write(JSON.stringify(value));});"
            ),
        ],
        input=literal,
        capture_output=True,
        text=True,
    )
    if node.returncode != 0:
        raise ValueError(f"cannot evaluate {name}: {node.stderr.strip()}")
    value = json.loads(node.stdout)
    if not isinstance(value, dict):
        raise ValueError(f"{name} did not evaluate to an object")
    return value


def walk(value: Any, trail: str = ""):
    if isinstance(value, dict):
        for key, child in value.items():
            next_trail = f"{trail}.{key}" if trail else str(key)
            yield from walk(child, next_trail)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk(child, f"{trail}[{index}]")
    else:
        yield trail, value


def main() -> int:
    path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "index-v3.html"
    if not path.is_absolute():
        path = ROOT / path
    failures: list[str] = []
    warnings: list[str] = []

    try:
        source = path.read_text(encoding="utf-8")
        projects = evaluate_object(extract_object(source, "workProjects"), "workProjects")
        stories = evaluate_object(extract_object(source, "workStories"), "workStories")
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"FAIL  {exc}")
        return 1

    for key, project in projects.items():
        for field in ("name", "summary", "result", "actions"):
            if field not in project:
                failures.append(f"company {key} is missing {field}")
        missing_scan = [field for field in ("dates", "role", "context", "facts") if field not in project]
        if missing_scan:
            warnings.append(
                f"company {key} still uses the compact fallback; missing {', '.join(missing_scan)}"
            )

    slugs: dict[str, str] = {}
    for key, story in stories.items():
        for field in ("company", "slug", "name", "delivery", "summary", "result", "chapters"):
            if field not in story:
                failures.append(f"story {key} is missing {field}")
        company = story.get("company")
        if company not in projects:
            failures.append(f"story {key} references unknown company {company!r}")
        slug = story.get("slug")
        if slug in slugs:
            failures.append(f"story slug {slug!r} is shared by {slugs[slug]} and {key}")
        elif isinstance(slug, str):
            slugs[slug] = key
        chapters = story.get("chapters")
        if not isinstance(chapters, list) or not chapters:
            failures.append(f"story {key} needs at least one chapter")
        else:
            for index, chapter in enumerate(chapters):
                for field in ("step", "title", "copy", "media"):
                    if field not in chapter:
                        failures.append(f"story {key} chapter {index + 1} is missing {field}")

    for collection_name, collection in (("company", projects), ("story", stories)):
        for key, record in collection.items():
            for trail, value in walk(record):
                if trail.endswith(".status") and isinstance(value, str):
                    if value not in ALLOWED_PLACEHOLDERS:
                        failures.append(
                            f"{collection_name} {key} has unknown placeholder status {value!r} at {trail}"
                        )
                if isinstance(value, str) and value.startswith("images/"):
                    asset = ROOT / value
                    if not asset.is_file():
                        failures.append(
                            f"{collection_name} {key} references missing asset {value} at {trail}"
                        )

    for warning in warnings:
        print(f"WARN  {warning}")
    for failure in failures:
        print(f"FAIL  {failure}")

    print(
        f"\nchecked {len(projects)} companies, {len(stories)} stories, "
        f"and {len(slugs)} unique story slugs"
    )
    if failures:
        print(f"FAIL  v3 model has {len(failures)} blocking problem(s).")
        return 1
    print(f"PASS  v3 model is coherent ({len(warnings)} migration warning(s)).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
