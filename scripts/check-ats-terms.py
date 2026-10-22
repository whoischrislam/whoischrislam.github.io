#!/usr/bin/env python3
"""Compare a job description's terms against the resume PDF you will submit.

    python3 scripts/check-ats-terms.py <jd.md|jd.txt> [resume.pdf]

Default resume: chris-lam-resume.pdf at the repo root.

Why: a keyword screen can require a literal string. A resume that says "React"
can fail a filter set to "React.js". Reading the resume does not catch that;
comparing strings does.

What it does:
  1. Extracts the PDF text with pdftotext. Exits 1 if the text is missing or
     too short (an image PDF, or a builder that broke text extraction). This
     replaces the old manual "confirm text still extracts" packet step.
  2. For every term group below that appears in the JD, reports
       match       the JD's exact wording is in the resume
       alias only  the resume says the same thing another way (React vs React.js)
       missing     not in the resume in any form
  3. Lists tech-shaped words in the JD that no term group covers yet, so the
     list grows from real JDs instead of guesses.

Advisory only. It never edits the resume. Add a term only if it is true
(AGENTS.md: never write Chris's facts from a guess).

JD files under .jobhunt/jds/ start with private notes, then a line "---", then
the verbatim posting. If such a line appears in the first 40 lines, only the
text after it is read. Pass --whole to read everything.
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIN_CHARS = 1500

# Each group: (label, [aliases]). Aliases are matched case-insensitively with
# alphanumeric boundaries, longest first, so "React" inside "React.js" is not
# counted twice. Bare "Node" is left out on purpose: PlaySesh "logic nodes".
TERMS = [
    ("React", ["React.js", "ReactJS", "React"]),
    ("Next.js", ["Next.js", "NextJS"]),
    ("TypeScript", ["TypeScript"]),
    ("JavaScript", ["JavaScript"]),
    ("Node.js", ["Node.js", "NodeJS"]),
    ("HTML", ["HTML5", "HTML"]),
    ("CSS", ["CSS3", "CSS"]),
    ("Tailwind", ["Tailwind CSS", "Tailwind"]),
    ("Python", ["Python"]),
    ("SQL", ["PostgreSQL", "Postgres", "SQL"]),
    ("Supabase", ["Supabase"]),
    ("GraphQL", ["GraphQL"]),
    ("APIs", ["REST APIs", "REST API", "APIs", "API"]),
    ("Git", ["GitHub", "Git"]),
    ("CI/CD", ["CI/CD", "continuous integration"]),
    ("WebGL", ["WebGL", "Three.js"]),
    ("Figma", ["Figma"]),
    ("Storybook", ["Storybook"]),
    ("Framer", ["Framer"]),
    ("Prototyping", ["prototyping", "prototypes", "prototype"]),
    ("Design systems", ["design systems", "design system"]),
    ("User research", ["user research", "UX research", "customer research", "user interviews"]),
    ("Usability testing", ["usability testing", "user testing", "usability tests"]),
    ("Accessibility", ["accessibility", "WCAG", "a11y"]),
    ("Interaction design", ["interaction design"]),
    ("Visual design", ["visual design"]),
    ("Information architecture", ["information architecture"]),
    ("Motion", ["motion design", "animation", "motion"]),
    ("Data visualization", ["data visualization", "data viz", "dataviz"]),
    ("Front end", ["front-end", "frontend", "front end"]),
    ("Full stack", ["full-stack", "full stack", "fullstack"]),
    ("Product Designer", ["product designer", "product design"]),
    ("Design Engineer", ["design engineer", "design engineering"]),
    ("Product Engineer", ["product engineer", "product engineering"]),
    ("0 to 1", ["zero to one", "zero-to-one", "0-to-1", "0 to 1", "0-1", "0→1"]),
    ("B2B", ["B2B"]),
    ("SaaS", ["SaaS"]),
    ("LLM", ["large language models", "LLMs", "LLM"]),
    ("Machine learning", ["machine learning", "ML"]),
    ("AI agents", ["AI agents", "agentic", "agents"]),
    ("Evals", ["evaluations", "evals"]),
    ("Claude", ["Claude Code", "Claude"]),
    ("Cursor", ["Cursor"]),
    ("Analytics", ["PostHog", "Amplitude", "Mixpanel", "product analytics", "analytics"]),
    ("Experimentation", ["A/B testing", "A/B tests", "experimentation"]),
    ("Healthcare", ["healthcare", "health care", "HIPAA"]),
    ("Stripe", ["Stripe"]),
    ("iOS", ["iOS"]),
    ("Android", ["Android"]),
]

STOP = {"AI", "US", "USA", "UI", "UX", "JD", "PST", "EST", "ET", "PT", "SF", "NYC",
        "CA", "OK", "FAQ", "CEO", "CTO", "CPO", "COO", "VP", "HR", "PM", "PMs", "TBD",
        "LLC", "PBC", "e.g", "i.e", "PTO", "IC", "ICs", "EU", "UK", "HQ", "Q1", "Q2", "Q3", "Q4", "AM", "PM"}


def pattern(alias):
    return re.compile(r"(?<![A-Za-z0-9])" + re.escape(alias) + r"(?![A-Za-z0-9])", re.I)


def find_aliases(text, aliases):
    """Return {alias: count}, longest alias first, masking matched spans."""
    found = {}
    for alias in sorted(aliases, key=len, reverse=True):
        n = 0
        def mask(m):
            nonlocal n
            n += 1
            return " " * len(m.group(0))
        text = pattern(alias).sub(mask, text)
        if n:
            found[alias] = n
    return found


def read_jd(path, whole):
    lines = Path(path).read_text().splitlines()
    if not whole:
        for i, line in enumerate(lines[:40]):
            if line.strip() == "---":
                return "\n".join(lines[i + 1:])
    return "\n".join(lines)


def read_pdf(path):
    if not shutil.which("pdftotext"):
        sys.exit("pdftotext not found (brew install poppler)")
    out = subprocess.run(["pdftotext", "-layout", str(path), "-"],
                         capture_output=True, text=True)
    text = out.stdout
    if out.returncode or len(text.strip()) < MIN_CHARS:
        sys.exit(f"FAIL: {path} yields {len(text.strip())} characters of text "
                 f"(need {MIN_CHARS}+). An ATS cannot read it.")
    return text


def uncovered(jd):
    """Tech-shaped words in the JD that no term group covers."""
    covered = {a.lower() for _, aliases in TERMS for a in aliases}
    shaped = re.findall(r"(?<![A-Za-z0-9])([A-Za-z][A-Za-z0-9]*(?:[.+#][A-Za-z0-9]+)+"
                        r"|[a-z]+[A-Z][A-Za-z0-9]*|[A-Z][a-z]+[A-Z][A-Za-z0-9]*"
                        r"|[A-Z]{2,5}s?)(?![A-Za-z0-9])", jd)
    return sorted({w for w in shaped if w.lower() not in covered and w not in STOP})


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    jd = read_jd(args[0], "--whole" in sys.argv)
    pdf = Path(args[1]) if len(args) > 1 else ROOT / "chris-lam-resume.pdf"
    resume = read_pdf(pdf)
    print(f"Resume text: {len(resume.strip())} characters, extractable. ({pdf.name})\n")

    rows = {"missing": [], "alias only": [], "match": []}
    for label, aliases in TERMS:
        in_jd = find_aliases(jd, aliases)
        if not in_jd:
            continue
        in_resume = find_aliases(resume, aliases)
        jd_forms = ", ".join(f'"{a}"' for a in in_jd)
        if not in_resume:
            rows["missing"].append(f"{label}: JD says {jd_forms}")
        elif any(a in in_resume for a in in_jd):
            rows["match"].append(label)
        else:
            have = ", ".join(f'"{a}"' for a in in_resume)
            rows["alias only"].append(f"{label}: JD says {jd_forms}, resume says {have}")

    for status in ("missing", "alias only"):
        print(f"{status.upper()} ({len(rows[status])})")
        for row in rows[status]:
            print(f"  {row}")
        print()
    print(f"MATCH ({len(rows['match'])}): {', '.join(rows['match']) or '-'}\n")
    extra = uncovered(jd)
    if extra:
        print("Not in the term list (add a group if any is a real skill term):")
        print("  " + ", ".join(extra))
    print("\nAdvisory. Add a term to the resume only if it is true.")


if __name__ == "__main__":
    main()
