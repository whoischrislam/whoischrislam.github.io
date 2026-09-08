#!/usr/bin/env python3
"""Drift gate for the career corpus registry (.jobhunt/INDEX.md).

Checks, in the same spirit as check-portfolio-v3.py:
  1. Every canon file registered in INDEX.md exists on disk.
  2. Every canon row carries a last_verified date; stale dates (default > 90 days)
     are warnings, because facts rot silently (see external-ai-boundaries rule 4).
  3. No un-registered file claims authority: files under .jobhunt/, the memory
     store, or the repo root that say "source of truth" / "canonical" / "this
     wins" / "supersedes" must either be in INDEX's canon table, be a dated
     snapshot (born superseded), or be on the known-pointer exemption list.

Exit 1 only on hard failures (missing canon file, unparseable INDEX). Staleness
and unregistered-authority findings print as warnings for review: this gate
informs the human, it does not silently rewrite anything.

Run from the repository root: python3 scripts/check-canon.py
"""

import datetime
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
INDEX = REPO / ".jobhunt" / "INDEX.md"
MEMORY_DIR = Path.home() / (
    ".claude/projects/-Users-whoischrislam-Documents-GitHub-"
    "whoischrislam-github-io/memory"
)
STALE_DAYS = 90

# Files allowed to carry authority-ish language without an INDEX canon row,
# because they are pointers to an authority that lives elsewhere, or they are
# the rule/tooling layer rather than a fact store.
EXEMPT_NAMES = {
    "INDEX.md",  # the registry itself
    "AGENTS.md",  # repo contract (rule layer, not a fact store)
    "CLAUDE.md",
    "JOB_SEARCH_PRIORITY.md",  # delegates pipeline status to Notion
    "MEMORY.md",  # memory index: pointers only
    "builder-training.md",  # memory pointer out to repo BUILDER_TRAINING.md
    "HIRING_SURFACES_REBUILD_PLAN.md",  # points at GTM as the authority
}

# A file claims authority for ITSELF in its header region; prose that merely
# discusses sources of truth (interview scripts, audits, plans) is not a claim.
HEADER_LINES = 20

AUTHORITY_RE = re.compile(
    r"source of truth|canonical record|this wins|supersedes every", re.IGNORECASE
)
DATED_NAME_RE = re.compile(r"\d{4}[-_]\d{2}[-_]\d{2}")
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")


def parse_canon_rows(text):
    """Yield (raw_path, last_verified_date_or_None) from the Canon table."""
    in_canon = False
    for line in text.splitlines():
        if line.startswith("## "):
            in_canon = line.startswith("## Canon")
            continue
        if not in_canon or not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 3 or cells[0].startswith("---") or cells[0] == "File":
            continue
        m = re.search(r"`([^`]+)`", cells[0])
        if not m:
            continue  # off-filesystem authority (e.g. Notion) — nothing to check
        date_m = DATE_RE.search(cells[2])
        date = (
            datetime.date.fromisoformat(date_m.group(0)) if date_m else None
        )
        yield m.group(1), cells[0], date


def resolve(raw_path, row_label):
    if row_label.lower().startswith("memory"):
        return MEMORY_DIR / raw_path.split("§")[0].strip()
    p = raw_path.split("§")[0].strip()
    if p.startswith(".jobhunt/") or "/" in p:
        return REPO / p
    if (REPO / p).exists() or "(repo root)" in row_label:
        return REPO / p
    return REPO / p


def main():
    if not INDEX.exists():
        print(f"FAIL  registry missing: {INDEX}")
        return 1
    text = INDEX.read_text(encoding="utf-8")
    today = datetime.date.today()
    failures, warnings = [], []

    canon_paths = set()
    rows = list(parse_canon_rows(text))
    if not rows:
        print("FAIL  could not parse any canon rows from INDEX.md")
        return 1

    for raw, label, date in rows:
        path = resolve(raw, label)
        canon_paths.add(path.name)
        if not path.exists():
            failures.append(f"canon file missing on disk: {raw} -> {path}")
            continue
        if date is None:
            warnings.append(f"no last_verified date parsed for {raw}")
        elif (today - date).days > STALE_DAYS:
            warnings.append(
                f"stale: {raw} last verified {date} "
                f"({(today - date).days}d > {STALE_DAYS}d)"
            )

    # Sweep for unregistered authority claims.
    sweep_files = list((REPO / ".jobhunt").glob("*.md")) + list(
        MEMORY_DIR.glob("*.md")
    ) + list(REPO.glob("*.md"))
    for f in sweep_files:
        if f.name in EXEMPT_NAMES or f.name in canon_paths:
            continue
        if DATED_NAME_RE.search(f.name):
            continue  # dated snapshot: born superseded, may describe authority
        try:
            body = f.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for line in body.splitlines()[:HEADER_LINES]:
            if line.lstrip().startswith(">"):
                continue  # quoted text (e.g. a tombstone citing a retired claim)
            if AUTHORITY_RE.search(line):
                warnings.append(
                    f"unregistered authority claim in {f.name}: "
                    f"{line.strip()[:90]}"
                )
                break

    for w in warnings:
        print(f"WARN  {w}")
    for e in failures:
        print(f"FAIL  {e}")
    if failures:
        print(f"FAIL  canon check: {len(failures)} failure(s), "
              f"{len(warnings)} warning(s)")
        return 1
    print(f"PASS  canon check ({len(rows)} canon rows, "
          f"{len(warnings)} warning(s) for review)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
