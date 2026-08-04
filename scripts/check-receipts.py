#!/usr/bin/env python3
"""Verify every receipt cited by the y30 case study still resolves.

A receipts page whose receipts have rotted is worse than no page at all: the
whole premise is that a skeptic could check. The repo is private so a reader
can't run this, but Chris can, and it has to pass before publish and after any
edit to either the page or the spine.

Checks commit SHAs against the source repo, and file paths against HEAD (falling
back to history, since some cited files were deleted in later consolidations —
that's expected and reported separately, not as a failure).

    python3 scripts/check-receipts.py [--repo PATH]
"""

import argparse
import json
import pathlib
import re
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_REPO = HERE.parent / "y30-voice"
SOURCES = [HERE / ".jobhunt" / "y30-spine.json", HERE / "work" / "y30.html"]

# 7-40 hex chars standing alone. Excludes hex colours (preceded by #) and any
# run of digits that happens to look like a SHA.
SHA = re.compile(r"(?<![#\w])\b([0-9a-f]{7,40})\b(?!\w)")
# Repo-relative paths with a known source/doc extension.
PATH = re.compile(r"\b((?:agent|docs|web|scripts|\.claude)/[\w./-]+\.(?:py|md|ts|tsx|css|yaml|json))\b")


def git(repo, *args):
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        capture_output=True, text=True,
    )


def harvest(text):
    shas = {s for s in SHA.findall(text) if not s.isdigit()}
    return shas, set(PATH.findall(text))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=str(DEFAULT_REPO))
    args = ap.parse_args()
    repo = pathlib.Path(args.repo).expanduser()

    if not (repo / ".git").exists():
        print(f"FAIL  no git repo at {repo}")
        return 2

    shas, paths = set(), set()
    for src in SOURCES:
        if not src.exists():
            print(f"WARN  missing source {src.relative_to(HERE)}")
            continue
        text = src.read_text()
        s, p = harvest(text)
        shas |= s
        paths |= p
        print(f"read  {src.relative_to(HERE)}  ({len(s)} SHAs, {len(p)} paths)")

    failures, historical = [], []

    print(f"\ncommits ({len(shas)})")
    for sha in sorted(shas):
        if git(repo, "cat-file", "-e", f"{sha}^{{commit}}").returncode == 0:
            subject = git(repo, "log", "-1", "--format=%ad %s", "--date=short", sha).stdout.strip()
            print(f"  ok    {sha}  {subject[:72]}")
        else:
            print(f"  FAIL  {sha}  does not resolve to a commit")
            failures.append(sha)

    print(f"\npaths ({len(paths)})")
    for path in sorted(paths):
        if (repo / path).exists():
            print(f"  ok    {path}")
        elif git(repo, "log", "--oneline", "-1", "--all", "--", path).stdout.strip():
            print(f"  hist  {path}  (deleted, exists in history)")
            historical.append(path)
        else:
            print(f"  FAIL  {path}  never existed at any commit")
            failures.append(path)

    print()
    if historical:
        print(f"NOTE  {len(historical)} cited path(s) exist only in history. Expected for "
              f"files removed in consolidation. The page must not imply they are current.")
    if failures:
        print(f"FAIL  {len(failures)} receipt(s) do not resolve. Do not publish.")
        for f in failures:
            print(f"      {f}")
        return 1
    print("PASS  every receipt resolves.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
