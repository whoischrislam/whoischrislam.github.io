#!/usr/bin/env python3
"""Guard public career facts that must stay aligned across publication surfaces."""

from __future__ import annotations

import json
import pathlib
import shutil
import subprocess
import sys


ROOT = pathlib.Path(__file__).resolve().parent.parent
TEXT_SURFACES = ["index.html", "resume.json", "llms.txt", "candidate.html"]
OPTIONAL_DRAFTS = ["work/y30.html"]

BANNED = {
    "1,400 commits": "y30 code-volume count is not a public claim",
    "product shipped July 2025": "PlaySesh's live Discord product launched November 2025",
    "100% on-time payouts": "StartPlaying has no verified percentage outcome",
    "6,220 active users": "Discord authorizations are not active users",
    "6,220 installs": "Discord authorizations are not installs",
    "127 test files": "the old y30 test-file count is stale",
    "pre-production, in pilot": "y30 was tested live but never entered a senior pilot",
    "no elder has ever evaluated": "at least one senior tried y30 by phone; sustained at-home evaluation did not happen",
    "owned the dev documentation and the ci pipeline": "Modus used the team's existing CI/CD pipeline",
}

PLAYSESH_REQUIRED = [
    "authorized",
    "138",
    "server install",
    "67",
    "individual-user install",
    "1,043",
]


def pdf_text(path: pathlib.Path) -> str:
    executable = shutil.which("pdftotext")
    if not executable:
        raise RuntimeError("pdftotext is required to verify the generated résumé PDF")
    result = subprocess.run(
        [executable, str(path), "-"], capture_output=True, text=True, check=True
    )
    return result.stdout


def main() -> int:
    failures: list[str] = []
    surfaces: dict[str, str] = {}

    for relative in TEXT_SURFACES:
        path = ROOT / relative
        if not path.is_file():
            failures.append(f"missing public fact surface: {relative}")
            continue
        surfaces[relative] = path.read_text(encoding="utf-8", errors="replace")

    for relative in OPTIONAL_DRAFTS:
        path = ROOT / relative
        if path.is_file():
            surfaces[relative] = path.read_text(encoding="utf-8", errors="replace")

    try:
        json.loads(surfaces.get("resume.json", ""))
    except json.JSONDecodeError as error:
        failures.append(f"resume.json is invalid JSON: {error}")

    resume_pdf = ROOT / "chris-lam-resume.pdf"
    if not resume_pdf.is_file():
        failures.append("missing public fact surface: chris-lam-resume.pdf")
    else:
        try:
            surfaces["chris-lam-resume.pdf"] = pdf_text(resume_pdf)
        except (RuntimeError, subprocess.CalledProcessError) as error:
            failures.append(str(error))

    for name, content in surfaces.items():
        lowered = content.lower()
        for needle, reason in BANNED.items():
            if needle.lower() in lowered:
                failures.append(f'{name}: banned phrase "{needle}" — {reason}')

    # These five surfaces carry the PlaySesh adoption summary. The hidden agent
    # catalog is checked separately in portfolio-voice-backend/test-facts.mjs.
    for name in (
        "index.html",
        "resume.json",
        "llms.txt",
        "candidate.html",
        "chris-lam-resume.pdf",
    ):
        content = surfaces.get(name, "").lower()
        for needle in PLAYSESH_REQUIRED:
            if needle not in content:
                failures.append(
                    f'{name}: missing separately labelled PlaySesh fact "{needle}"'
                )

    if failures:
        for failure in failures:
            print(f"FAIL  {failure}")
        print(f"\nFAIL  public facts have {len(failures)} blocking problem(s).")
        return 1

    print("PASS  public facts align across five core surfaces and available supporting evidence.")
    print("NOTE  run ../portfolio-voice-backend/test-facts.mjs for the sixth, hidden agent catalog.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
