#!/usr/bin/env python3
"""Render resume.json to a PDF.

Deliberately dumb. It reads resume.json, optionally swaps the label and summary
for a role-family variant, and lays the whole thing out. It does not select
bullets, read job descriptions, or score anything. That is the resume compiler
described in RESUME_COMPILER_PLAN.md, and it stays parked.

Usage:
    uv run --with reportlab scripts/build-resume.py
    uv run --with reportlab scripts/build-resume.py --variant design-engineer
    uv run --with reportlab scripts/build-resume.py --variant design-engineer \
        --out chris-lam-resume-design-engineer.pdf

Variants live in resume.json under meta.variants. An empty field falls back to
basics.label / basics.summary, so a variant with no summary written yet still
renders correctly.
"""

import argparse
import json
import sys
from pathlib import Path

from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)

REPO = Path(__file__).resolve().parent.parent
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def fmt_date(value):
    """'2026-03' -> 'Mar 2026'. '2025' -> '2025'. '' -> ''."""
    if not value:
        return ""
    parts = str(value).split("-")
    if len(parts) >= 2 and parts[1].isdigit():
        month = int(parts[1])
        if 1 <= month <= 12:
            return f"{MONTHS[month - 1]} {parts[0]}"
    return parts[0]


def date_range(entry):
    start = fmt_date(entry.get("startDate"))
    end = fmt_date(entry.get("endDate")) or "Present"
    return f"{start} to {end}" if start else end


def esc(text):
    """Escape for reportlab's mini-HTML paragraph parser."""
    return (str(text).replace("&", "&amp;")
                     .replace("<", "&lt;")
                     .replace(">", "&gt;"))


def build_styles():
    base = dict(fontName="Helvetica", textColor="#1a1a1a")
    return {
        "name": ParagraphStyle("name", fontName="Helvetica-Bold", fontSize=19,
                               leading=22, spaceAfter=2, textColor="#111111"),
        "label": ParagraphStyle("label", fontName="Helvetica-Bold", fontSize=10,
                                leading=13, spaceAfter=4, textColor="#333333"),
        "contact": ParagraphStyle("contact", fontSize=8.4, leading=11,
                                  spaceAfter=1, **base),
        "location": ParagraphStyle("location", fontSize=8.4, leading=11,
                                   spaceAfter=8, textColor="#444444",
                                   fontName="Helvetica"),
        "section": ParagraphStyle("section", fontName="Helvetica-Bold",
                                  fontSize=9.2, leading=12, spaceBefore=10,
                                  spaceAfter=3, textColor="#111111"),
        "summary": ParagraphStyle("summary", fontSize=9, leading=12.6,
                                  alignment=TA_JUSTIFY, spaceAfter=2, **base),
        "role": ParagraphStyle("role", fontName="Helvetica-Bold", fontSize=9.6,
                               leading=12, spaceBefore=6, textColor="#111111"),
        "meta": ParagraphStyle("meta", fontSize=8.2, leading=10.5,
                               spaceAfter=2, textColor="#555555",
                               fontName="Helvetica"),
        "bullet": ParagraphStyle("bullet", fontSize=8.8, leading=11.6,
                                 spaceAfter=1.5, **base),
        "skill": ParagraphStyle("skill", fontSize=8.8, leading=11.6,
                                spaceAfter=2, **base),
    }


def resolve_variant(data, key):
    """Return (label, summary), falling back to basics for empty fields."""
    basics = data["basics"]
    label, summary = basics.get("label", ""), basics.get("summary", "")
    if not key:
        return label, summary
    variants = data.get("meta", {}).get("variants", {})
    variant = variants.get(key)
    if variant is None:
        available = [k for k in variants if not k.startswith("_")]
        sys.exit(f"Unknown variant '{key}'. Available: {', '.join(available)}")
    return (variant.get("label") or label, variant.get("summary") or summary)


def build_story(data, label, summary, styles):
    basics, story = data["basics"], []

    story.append(Paragraph(esc(basics["name"]), styles["name"]))
    story.append(Paragraph(esc(label), styles["label"]))

    links = [basics.get("email", ""), basics.get("url", "")]
    links += [p["url"].replace("https://", "").rstrip("/")
              for p in basics.get("profiles", [])]
    story.append(Paragraph(esc(" · ".join(x for x in links if x)),
                           styles["contact"]))

    location_line = data.get("meta", {}).get("locationLine")
    if location_line:
        story.append(Paragraph(esc(location_line), styles["location"]))

    story.append(HRFlowable(width="100%", thickness=0.6, color="#cccccc",
                            spaceAfter=6))

    story.append(Paragraph("SUMMARY", styles["section"]))
    story.append(Paragraph(esc(summary), styles["summary"]))

    story.append(Paragraph("EXPERIENCE", styles["section"]))
    for job in data.get("work", []):
        block = [Paragraph(
            f"{esc(job.get('position', ''))} · {esc(job.get('name', ''))}",
            styles["role"])]
        meta = date_range(job)
        if job.get("summary"):
            meta = f"{meta} · {esc(job['summary'])}"
        block.append(Paragraph(meta, styles["meta"]))
        if job.get("highlights"):
            block.append(ListFlowable(
                [ListItem(Paragraph(esc(h), styles["bullet"]), leftIndent=12)
                 for h in job["highlights"]],
                bulletType="bullet", bulletFontSize=5, start="circle",
                leftIndent=10, spaceAfter=2))
        # Keep the role header with at least its first line of detail.
        story.append(KeepTogether(block[:2]))
        story.extend(block[2:])

    story.append(Paragraph("EDUCATION", styles["section"]))
    for school in data.get("education", []):
        line = (f"<b>{esc(school.get('studyType', ''))}, "
                f"{esc(school.get('area', ''))}</b> · "
                f"{esc(school.get('institution', ''))}")
        if school.get("endDate"):
            line += f" · {esc(school['endDate'])}"
        story.append(Paragraph(line, styles["skill"]))

    story.append(Paragraph("SKILLS", styles["section"]))
    for group in data.get("skills", []):
        story.append(Paragraph(
            f"<b>{esc(group['name'])}:</b> "
            f"{esc(' · '.join(group.get('keywords', [])))}",
            styles["skill"]))

    return story


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--variant", help="key under meta.variants")
    parser.add_argument("--out", default="chris-lam-resume.pdf")
    parser.add_argument("--source", default=str(REPO / "resume.json"))
    args = parser.parse_args()

    data = json.loads(Path(args.source).read_text())
    label, summary = resolve_variant(data, args.variant)

    out_path = Path(args.out)
    if not out_path.is_absolute():
        out_path = REPO / out_path

    doc = SimpleDocTemplate(
        str(out_path), pagesize=LETTER,
        leftMargin=0.62 * inch, rightMargin=0.62 * inch,
        topMargin=0.55 * inch, bottomMargin=0.5 * inch,
        # The old PDF shipped with empty Title/Author, which ATS parsers read.
        title=f"{data['basics']['name']} - {label}",
        author=data["basics"]["name"],
        subject=label,
    )
    doc.build(build_story(data, label, summary, build_styles()))

    print(f"Wrote {out_path} ({doc.page} pages, variant={args.variant or 'canonical'})")
    if doc.page > 2:
        print(f"WARNING: {doc.page} pages. A senior IC resume should be 2. "
              f"Trim work entries or highlights in resume.json.")


if __name__ == "__main__":
    main()
