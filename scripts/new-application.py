#!/usr/bin/env python3
"""Start an application from a door template.

    python3 scripts/new-application.py <pd|de|pe> <slug> "Company" ["Role title"]

Creates .jobhunt/applications/<slug>/ with:
  page.md     copied from templates/apply-<door>.md (pd, de; pe has no page by default)
  PACKET.md   posting, path to a human, resume summary, build commands, outcome row
  chris-lam-resume-<slug>.pdf   the door's foundation resume (rebuild after editing the summary)
and a local draft preview at _draft-<slug>.html.

Templates are the permanent foundation. To make an improvement permanent, edit
templates/apply-<door>.md (page) or meta.variants in resume.json (resume). Sent
applications stay as sent.
"""
import datetime
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOORS = {
    "pd": {"template": "templates/apply-pd.md", "variant": None, "role": "Product Designer"},
    "de": {"template": "templates/apply-de.md", "variant": None, "role": "Design Engineer"},
    "pe": {"template": None, "variant": "product-engineer", "role": "Product Engineer"},
}

if len(sys.argv) < 4 or sys.argv[1] not in DOORS:
    sys.exit(__doc__)
door, slug, company = sys.argv[1], sys.argv[2], sys.argv[3]
cfg = DOORS[door]
role = sys.argv[4] if len(sys.argv) > 4 else cfg["role"]
if not re.fullmatch(r"[a-z0-9-]+", slug):
    sys.exit("slug must be lowercase letters, digits, hyphens")

app = ROOT / ".jobhunt" / "applications" / slug
if app.exists():
    sys.exit(f"{app} already exists")
app.mkdir(parents=True)
rel = app.relative_to(ROOT)

page_cmds = "No page for this door by default. To add one: copy templates/apply-de.md to page.md."
if cfg["template"]:
    text = (ROOT / cfg["template"]).read_text()
    for key, val in {"company": company, "role": role, "slug": slug,
                     "email_subject": f"{company}: {role}"}.items():
        text = re.sub(rf"^{key}: .*$", f"{key}: {val}", text, count=1, flags=re.M)
    (app / "page.md").write_text(text)
    page_cmds = (
        f"- Preview: `node scripts/build-apply-page.cjs {rel}/page.md --draft --out _draft-{slug}.html`, "
        f"then open http://localhost:8765/_draft-{slug}.html\n"
        f"- Final (refuses while any blank is left): `node scripts/build-apply-page.cjs {rel}/page.md`"
        f" writes `{slug}-application.html`")

variant = f" --variant {cfg['variant']}" if cfg["variant"] else ""
pdf = f"{rel}/chris-lam-resume-{slug}.pdf"
resume_cmd = f'python3 scripts/build-resume-html.py{variant} --summary "<summary above>" --out {pdf}'

(app / "PACKET.md").write_text(f"""# {company} · {role}

Door: **{door}** · created {datetime.date.today()} from `{cfg['template'] or 'resume variant ' + cfg['variant']}`.
Matched test row: `.jobhunt/MATCHED_DOOR_TEST.md`. Run `.jobhunt/APPLICATION_GATE.md` before sending.

- Posting: [[url]]
- Path to a human: [[Clera / Jack & Jill / warm intro / named email]]
- Before any technical stage, ask: live or take-home? AI allowed?

## Page
{page_cmds}

## Resume
Summary for this company (blank = the door's foundation summary): [[optional]]
- Build: `{resume_cmd}`

## Make it permanent
An improvement every future {door} application should get goes in `{cfg['template'] or 'resume.json meta.variants.' + cfg['variant']}`.

## Outcome
| Applied | Channel | Reached a human | Stopped at | Reason (verbatim) |
|---|---|---|---|---|
| | | | | |
""")

subprocess.run([sys.executable, "scripts/build-resume-html.py", *variant.split(), "--out", pdf],
               cwd=ROOT, check=True)
if cfg["template"]:
    subprocess.run(["node", "scripts/build-apply-page.cjs", f"{rel}/page.md", "--draft",
                    "--out", f"_draft-{slug}.html"], cwd=ROOT, check=True)
    print(f"Preview: http://localhost:8765/_draft-{slug}.html")
print(f"Packet: {rel}/PACKET.md")
