#!/usr/bin/env python3
"""Validate the primary portfolio's inline company/story model and local assets.

The portfolio data remains inline while the information architecture is evolving. This
check gives that temporary representation schema-like protection without making
the renderer migration a prerequisite.

    python3 scripts/check-portfolio-v3.py [index.html]
"""

from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
from typing import Any


ROOT = pathlib.Path(__file__).resolve().parent.parent
ALLOWED_PLACEHOLDERS = {"READY", "CURATE", "CAPTURE", "RECREATE", "TEXT ONLY"}
ALLOWED_PORTFOLIO_SHAPES = {"company", "founder"}
ALLOWED_CONTENT_TYPES = {"project", "product-decision"}


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
    path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "index.html"
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

    if "—" in source:
        failures.append("public portfolio copy contains an em dash")

    required_homepage_fragments = {
        '<meta name="robots" content="index, follow">':
            "primary homepage must remain indexable",
        '<link rel="icon" href="favicon.svg" type="image/svg+xml" />':
            "primary homepage must declare its favicon",
        'class="hero-lockup"': "homepage hero needs the one-line lockup hook",
        "I <span class=\"lit-word\">design</span> the product &amp; <span class=\"lit-word\">ship</span> the code.":
            "homepage hero statement changed",
        "Product design engineer &amp; 0→1 builder.":
            "homepage market-facing line changed",
        "14+ years shipping software across healthcare, marketplaces, education, and creative tools. I learn new domains and technologies quickly without compromising product judgment, design craft, or engineering rigor.":
            "homepage adaptability line changed",
        "14+ years": "homepage must use the confirmed 14+ years notation",
        'class="hero-logo-more"': "credibility rail needs its and-more close",
        'mask-image:var(--logo-mask)':
            "company logos need their exact green hover masks",
        'class="work-head"': "work heading and controls need one shared row",
        'class="work-filter-indicator"': "work filter needs its sliding selected-state indicator",
        'data-work-kind-filter="experiment"': "work mosaic needs its experiment filter",
        'class="work-shuffle-label"': "shuffle needs an accessible text label",
        "workTiles = ordered.concat(missing);":
            "shuffle must update the layout engine's in-memory tile order",
    }
    for fragment, message in required_homepage_fragments.items():
        if fragment not in source:
            failures.append(message)

    forbidden_homepage_fragments = {
        '<meta name="robots" content="noindex">':
            "primary homepage must not retain the former draft noindex directive",
        'class="hero-availability"':
            "homepage hero must not restore the seniority/location availability strip",
        "Fourteen years": "homepage must not spell out the confirmed 14+ years notation",
        '<p class="work-history"><b>Also:</b>':
            "homepage must not restore the detached Also: work-history line",
        '<details class="side-projects"':
            "experiments belong in the shared work mosaic, not a separate accordion",
        "portfolio-v3-work-order":
            "work mosaic order must be fresh per page load, not session-persistent",
        'class="work-count"': "homepage must not restore a visible mosaic count",
        'class="work-control-meta"': "work controls belong directly beside the Work heading",
    }
    for fragment, message in forbidden_homepage_fragments.items():
        if fragment in source:
            failures.append(message)

    for favicon in ("favicon.svg", "favicon.ico"):
        if not (ROOT / favicon).is_file():
            failures.append(f"primary homepage favicon is missing: {favicon}")

    hero_lockup_rule = re.search(r"\.hero h1\.hero-lockup\{([^}]*)\}", source, re.DOTALL)
    if not hero_lockup_rule or "white-space:nowrap" not in hero_lockup_rule.group(1):
        failures.append("homepage hero statement must remain one line at every viewport")

    tile_tags = re.findall(r'<button class="work-tile"([^>]*)>', source)
    tile_ids: set[str] = set()
    for index, attributes in enumerate(tile_tags, start=1):
        project_match = re.search(r'data-project="([^"]+)"', attributes)
        tile_id_match = re.search(r'data-tile-id="([^"]+)"', attributes)
        kind_match = re.search(r'data-kind="([^"]+)"', attributes)
        if not project_match or project_match.group(1) not in projects:
            failures.append(f"work tile {index} references an unknown portfolio record")
        if not tile_id_match:
            failures.append(f"work tile {index} is missing data-tile-id")
        elif tile_id_match.group(1) in tile_ids:
            failures.append(f"work tile id {tile_id_match.group(1)!r} is duplicated")
        else:
            tile_ids.add(tile_id_match.group(1))
        if not kind_match or kind_match.group(1) not in {"work", "experiment"}:
            failures.append(f"work tile {index} has an unknown or missing data-kind")

    for key, project in projects.items():
        for field in ("name", "summary", "result", "actions"):
            if field not in project:
                failures.append(f"company {key} is missing {field}")
        missing_scan = [field for field in ("dates", "role", "context", "facts") if field not in project]
        if missing_scan:
            warnings.append(
                f"company {key} still uses the compact fallback; missing {', '.join(missing_scan)}"
            )
        portfolio_shape = project.get("portfolioShape", "company")
        if portfolio_shape not in ALLOWED_PORTFOLIO_SHAPES:
            failures.append(
                f"company {key} has unknown portfolio shape {portfolio_shape!r}"
            )
        if portfolio_shape == "founder":
            for field in ("storySectionTitle", "storySectionIntro"):
                if field not in project:
                    warnings.append(f"founder company {key} is missing {field}")

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
        content_type = story.get("contentType", "project")
        if content_type not in ALLOWED_CONTENT_TYPES:
            failures.append(f"story {key} has unknown content type {content_type!r}")
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
        f"\nchecked {len(projects)} portfolio records, {len(stories)} stories, "
        f"{len(slugs)} unique story slugs, and {len(tile_ids)} mosaic tiles"
    )
    if failures:
        print(f"FAIL  portfolio model has {len(failures)} blocking problem(s).")
        return 1
    print(f"PASS  portfolio model is coherent ({len(warnings)} migration warning(s)).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
