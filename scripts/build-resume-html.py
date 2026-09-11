#!/usr/bin/env python3
"""Render resume.json to a designed PDF via headless Chrome.

This is the locked visual resume: a two-column layout (narrow Skills/Education
rail, wide Experience column) set in Instrument Serif + Open Sans, the same type
pairing as whoischrislam.github.io, so the resume and the portfolio read as one
system. Approved by Chris 2026-09-10.

Like build-resume.py (the plain reportlab/ATS builder) it is deliberately dumb:
it reads resume.json, optionally swaps label/summary for a role-family variant,
and lays the whole thing out. It selects no bullets and scores nothing.

Content rules:
- Each work entry may carry a "location" string; it renders after the company.
- Each skills group may carry "resumeShow": N to cap how many keywords appear in
  the rail (the full list still feeds the reportlab/ATS build). Order the
  keywords so the ones that should show lead.
- Languages are intentionally not rendered here.

Usage:
    uv run scripts/build-resume-html.py
    uv run scripts/build-resume-html.py --variant design-engineer
    uv run scripts/build-resume-html.py --out chris-lam-resume-cisco.pdf \
        --label "Lead Product Designer" --summary "..."

Needs Google Chrome (set $CHROME to override the path).
"""

import argparse
import html
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

CHROME_CANDIDATES = [
    os.environ.get("CHROME", ""),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    shutil.which("google-chrome-stable") or "",
    shutil.which("chromium") or "",
]


def fmt_date(value):
    if not value:
        return ""
    parts = str(value).split("-")
    if len(parts) >= 2 and parts[1].isdigit():
        m = int(parts[1])
        if 1 <= m <= 12:
            return f"{MONTHS[m - 1]} {parts[0]}"
    return parts[0]


def date_range(entry):
    start = fmt_date(entry.get("startDate"))
    end = fmt_date(entry.get("endDate")) or "Present"
    return f"{start} – {end}" if start else end


def esc(text):
    return html.escape(str(text), quote=False)


def resolve_variant(data, key, label_override, summary_override):
    basics = data["basics"]
    label, summary = basics.get("label", ""), basics.get("summary", "")
    if key:
        variants = data.get("meta", {}).get("variants", {})
        variant = variants.get(key)
        if variant is None:
            avail = [k for k in variants if not k.startswith("_")]
            sys.exit(f"Unknown variant '{key}'. Available: {', '.join(avail)}")
        label = variant.get("label") or label
        summary = variant.get("summary") or summary
    return (label_override or label, summary_override or summary)


def find_chrome():
    for c in CHROME_CANDIDATES:
        if c and Path(c).exists():
            return c
    sys.exit("Google Chrome not found. Set $CHROME to the executable path.")


def render_html(data, label, summary):
    basics = data["basics"]

    def strip(url):
        return (url.replace("https://", "").replace("http://", "")
                   .replace("www.", "").rstrip("/"))

    contacts = []  # (href, display)
    if basics.get("email"):
        contacts.append((f'mailto:{basics["email"]}', basics["email"]))
    if basics.get("url"):
        contacts.append((basics["url"], strip(basics["url"])))
    for p in basics.get("profiles", []):
        if p.get("network") == "Dribbble" or not p.get("url"):
            continue
        contacts.append((p["url"], strip(p["url"])))
    contact = " · ".join(
        f'<a href="{esc(href)}">{esc(disp)}</a>' for href, disp in contacts)

    # Skills rail
    skill_html = ['<h2>Skills</h2>']
    for group in data.get("skills", []):
        kws = group.get("keywords", [])
        show = group.get("resumeShow")
        if isinstance(show, int):
            kws = kws[:show]
        skill_html.append('<div class="skillgroup">')
        skill_html.append(f'<div class="cat">{esc(group["name"])}</div>')
        for kw in kws:
            skill_html.append(f'<div class="s">{esc(kw)}</div>')
        skill_html.append('</div>')

    edu_html = ['<h2>Education</h2>']
    for s in data.get("education", []):
        deg = f'{esc(s.get("studyType",""))}, {esc(s.get("area",""))}'
        line = esc(s.get("institution", ""))
        if s.get("endDate"):
            line += f' · {esc(s["endDate"])}'
        edu_html.append(f'<div class="edu"><div class="deg">{deg}</div>'
                        f'<div class="school">{line}</div></div>')

    # Experience
    jobs = ['<h2>Experience</h2>']
    for job in data.get("work", []):
        loc = job.get("location", "")
        jobs.append('<div class="job">')
        jobs.append(f'<div class="l1"><span class="co">{esc(job.get("name",""))}</span>'
                    + (f'<span class="loc">{esc(loc)}</span>' if loc else '') + '</div>')
        jobs.append(f'<div class="l1"><span class="role">{esc(job.get("position",""))}</span>'
                    f'<span class="dates">{date_range(job)}</span></div>')
        if job.get("summary"):
            jobs.append(f'<div class="ctx">{esc(job["summary"])}</div>')
        if job.get("highlights"):
            jobs.append('<ul>')
            for h in job["highlights"]:
                jobs.append(f'<li>{esc(h)}</li>')
            jobs.append('</ul>')
        jobs.append('</div>')

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>{esc(basics.get('name',''))} — Resume</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root{{ --ink:#1a1a1a; --head:#111; --muted:#8a8a8a;
  --serif:"Instrument Serif",Georgia,"Times New Roman",serif;
  --sans:"Open Sans",-apple-system,Helvetica,Arial,sans-serif; }}
@page{{ size:Letter; margin:0.55in 0.62in; }}
*{{ box-sizing:border-box; }}
html,body{{ margin:0; padding:0; }}
body{{ font-family:var(--sans); color:var(--ink); font-size:9.2px; line-height:1.42;
  -webkit-print-color-adjust:exact; }}
h1{{ font-family:var(--serif); font-weight:400; font-size:42px; line-height:1;
  color:var(--head); margin:0 0 6px; letter-spacing:.2px; }}
.contact{{ font-size:9px; color:var(--ink); }}
.contact a{{ color:var(--ink); text-decoration:none; }}
.summary{{ margin:16px 0 0; font-size:9.3px; line-height:1.55; color:var(--ink); max-width:96%; }}
.body{{ display:grid; grid-template-columns:29% 1fr; gap:26px; margin-top:26px; }}
h2{{ font-family:var(--serif); font-weight:400; font-size:20px; line-height:1;
  color:var(--head); margin:0 0 9px; letter-spacing:.2px; }}
aside section{{ break-inside:avoid; }}
.skillgroup{{ margin-bottom:12px; }}
.skillgroup .cat{{ font-weight:700; font-size:8.2px; text-transform:uppercase;
  letter-spacing:.7px; color:var(--head); margin-bottom:4px; }}
.skillgroup .s{{ font-size:9px; color:var(--ink); line-height:1.62; }}
.edu{{ margin-bottom:8px; }}
.edu .deg{{ font-weight:700; font-size:9px; color:var(--head); }}
.edu .school{{ font-size:8.8px; color:var(--muted); }}
.exp h2{{ margin-top:0; }}
.job{{ margin-bottom:13px; break-inside:avoid; }}
.job .l1{{ margin-bottom:1px; }}
.job .co{{ font-weight:700; font-size:10px; color:var(--head); }}
.job .loc{{ font-size:9.4px; color:var(--muted); margin-left:7px; }}
.job .role{{ font-weight:600; font-size:9.4px; color:var(--ink); }}
.job .dates{{ font-size:9.2px; color:var(--muted); margin-left:7px; }}
.job .ctx{{ font-size:8.9px; color:var(--muted); margin:3px 0 2px; }}
ul{{ margin:2px 0 0; padding-left:12px; }}
li{{ font-size:9px; line-height:1.45; margin-bottom:2.5px; padding-left:3px;
  list-style-type:"\\2013\\00a0\\00a0"; }}
li::marker{{ color:var(--muted); }}
</style></head><body>
<header>
  <h1>{esc(basics.get('name',''))}</h1>
  <div class="contact">{contact}</div>
  <p class="summary">{esc(summary)}</p>
</header>
<div class="body">
  <aside class="rail"><section>{''.join(skill_html)}</section>
    <section>{''.join(edu_html)}</section></aside>
  <main class="exp">{''.join(jobs)}</main>
</div>
</body></html>"""


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--variant", help="key under meta.variants")
    ap.add_argument("--label", help="override the label directly")
    ap.add_argument("--summary", help="override the summary directly")
    ap.add_argument("--out", default="chris-lam-resume.pdf")
    ap.add_argument("--source", default=str(REPO / "resume.json"))
    args = ap.parse_args()

    data = json.loads(Path(args.source).read_text())
    label, summary = resolve_variant(data, args.variant, args.label, args.summary)
    doc_html = render_html(data, label, summary)

    out_path = Path(args.out)
    if not out_path.is_absolute():
        out_path = REPO / out_path

    chrome = find_chrome()
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write(doc_html)
        html_path = f.name
    try:
        subprocess.run([
            chrome, "--headless=new", "--disable-gpu", "--no-sandbox",
            "--virtual-time-budget=15000", "--run-all-compositor-stages-before-draw",
            "--no-pdf-header-footer", f"--print-to-pdf={out_path}",
            f"file://{html_path}",
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    finally:
        os.unlink(html_path)

    print(f"Wrote {out_path} (variant={args.variant or 'canonical'})")


if __name__ == "__main__":
    main()
