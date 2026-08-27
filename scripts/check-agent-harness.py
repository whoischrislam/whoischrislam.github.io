#!/usr/bin/env python3
"""Validate the cross-agent continuity and privacy harness.

This check intentionally covers structural invariants, not whether an LLM will
obey prose perfectly. It catches the failures that are easy to make silently:
forking CLAUDE.md away from AGENTS.md, deleting a required workflow source,
publishing a private path, or letting the active handoff lose its shape.

    python3 scripts/check-agent-harness.py
"""

from __future__ import annotations

import datetime as dt
import pathlib
import re
import subprocess
import sys


ROOT = pathlib.Path(__file__).resolve().parent.parent

REQUIRED = [
    "AGENTS.md",
    "CLAUDE.md",
    "AGENT_HARNESS.md",
    ".jobhunt/README.md",
    ".jobhunt/ACTIVE_PORTFOLIO_HANDOFF.md",
    ".jobhunt/CANONICAL_WORK_HISTORY.md",
    ".jobhunt/COMPANY_STORY_BRIEF_TEMPLATE.md",
    ".claude/skills/session-start/SKILL.md",
    ".claude/skills/session-end/SKILL.md",
    "scripts/check-portfolio-v3.py",
]

AGENT_MARKERS = [
    "One instruction source for every agent",
    "Never infer, assume, or fabricate facts",
    "Portfolio evidence workflow",
    ".jobhunt/ACTIVE_PORTFOLIO_HANDOFF.md",
    "scripts/check-portfolio-v3.py",
]

HANDOFF_HEADINGS = [
    "North star",
    "Structure to preserve",
    "Current public implementation",
    "Current private evidence state",
    "Current workstream",
    "Next recommended action",
    "Deliberate deferrals",
    "Required checks",
]

PUBLICATION_FILES = [
    "index.html",
    "index-v2.html",
    "index-v3.html",
    "candidate.html",
    "llms.txt",
    "resume.json",
]


def git(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(ROOT), *args], capture_output=True, text=True
    )


def main() -> int:
    failures: list[str] = []
    warnings: list[str] = []

    for relative in REQUIRED:
        if not (ROOT / relative).is_file():
            failures.append(f"missing required harness file: {relative}")

    if failures:
        return report(failures, warnings)

    agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    agent_lines = len(agents.splitlines())
    if agent_lines > 200:
        warnings.append(
            f"AGENTS.md is {agent_lines} lines; keep always-loaded guidance near or below 200"
        )
    for marker in AGENT_MARKERS:
        if marker not in agents:
            failures.append(f"AGENTS.md lost required marker: {marker}")

    claude = (ROOT / "CLAUDE.md").read_text(encoding="utf-8")
    nonempty = [line.strip() for line in claude.splitlines() if line.strip()]
    if not nonempty or nonempty[0] != "@AGENTS.md":
        failures.append("CLAUDE.md must begin with the exact @AGENTS.md import")
    if len(claude.splitlines()) > 30:
        failures.append("CLAUDE.md is no longer a thin adapter (over 30 lines)")
    duplicated = [marker for marker in AGENT_MARKERS if marker in claude]
    if duplicated:
        failures.append(
            "CLAUDE.md duplicates canonical AGENTS.md rules: " + ", ".join(duplicated)
        )

    for name in ("session-start", "session-end"):
        skill_path = ROOT / ".claude" / "skills" / name / "SKILL.md"
        skill = skill_path.read_text(encoding="utf-8")
        if f"name: {name}" not in skill:
            failures.append(f"{skill_path.relative_to(ROOT)} has the wrong skill name")
        if "[TODO" in skill:
            failures.append(f"{skill_path.relative_to(ROOT)} still contains scaffold TODOs")

    private_paths = [
        ".jobhunt/README.md",
        ".jobhunt/ACTIVE_PORTFOLIO_HANDOFF.md",
        ".jobhunt/CANONICAL_WORK_HISTORY.md",
        ".jobhunt/COMPANY_STORY_BRIEF_TEMPLATE.md",
    ]
    for relative in private_paths:
        ignored = git("check-ignore", "-q", relative)
        if ignored.returncode != 0:
            failures.append(f"private evidence path is not gitignored: {relative}")

    handoff = (ROOT / ".jobhunt/ACTIVE_PORTFOLIO_HANDOFF.md").read_text(
        encoding="utf-8"
    )
    for heading in HANDOFF_HEADINGS:
        if not re.search(rf"^## {re.escape(heading)}\s*$", handoff, re.MULTILINE):
            failures.append(f"active handoff lost section: {heading}")

    date_match = re.search(r"\*\*Last updated:\*\*\s*(\d{4}-\d{2}-\d{2})", handoff)
    if not date_match:
        failures.append("active handoff has no YYYY-MM-DD Last updated date")
    else:
        age = (dt.date.today() - dt.date.fromisoformat(date_match.group(1))).days
        if age > 14:
            warnings.append(
                f"active handoff is {age} days old; refresh it if portfolio work resumed"
            )

    for relative in PUBLICATION_FILES:
        path = ROOT / relative
        if path.is_file() and ".jobhunt/" in path.read_text(
            encoding="utf-8", errors="replace"
        ):
            failures.append(f"publication surface references private .jobhunt path: {relative}")
    for path in sorted((ROOT / "work").glob("*.html")) if (ROOT / "work").is_dir() else []:
        if ".jobhunt/" in path.read_text(encoding="utf-8", errors="replace"):
            failures.append(
                f"publication surface references private .jobhunt path: {path.relative_to(ROOT)}"
            )

    return report(failures, warnings)


def report(failures: list[str], warnings: list[str]) -> int:
    for warning in warnings:
        print(f"WARN  {warning}")
    for failure in failures:
        print(f"FAIL  {failure}")
    if failures:
        print(f"\nFAIL  agent harness has {len(failures)} blocking problem(s).")
        return 1
    print(
        f"PASS  cross-agent harness is coherent ({len(warnings)} warning(s))."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
