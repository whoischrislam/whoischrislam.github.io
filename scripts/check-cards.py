#!/usr/bin/env python3
"""Enforce the work-card structure on the homepage.

The cards drifted into five different element orders because the format lived in
prose and got appended to one slot at a time. A reader pays for that drift: when
every card is shaped differently, nothing is scannable and the strong cards look
the same as the weak ones. This script makes the format executable, so it fails
loudly instead of eroding.

Three tiers, declared here rather than in the markup so a new card cannot appear
without someone deciding what it is:

    lead   y30, PlaySesh, Pathstream    current work and the craft receipt
    proof  GoodRx, Clover, TaskRabbit   a metric and a checkable receipt
    row    everything else              a role and a capability, nothing more

Rules are per tier: which slots are required, which are allowed, and how many
words of free prose the tier may carry. Order is checked against one canonical
sequence for every card.

    python3 scripts/check-cards.py [--file index-v2.html] [--quiet]

Exit 0 clean, 1 on any FAIL. WARNs never fail the run; they are things that must
be resolved before publish, not before commit.
"""

import argparse
import html
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent.parent

# Canonical reading order. Rank, not position: a card may skip any slot, but the
# slots it has must appear in this order.
ORDER = [
    "card-head",     # who, what title, when
    "ctx",           # what it was, for whom
    "impact",        # the number that earns the next line
    "facts",         # scale and ownership, for the now-interested reader
    "lineage",       # two-company continuity, GoodRx only
    "prose",         # the call
    "todo",          # a blank waiting on Chris, sits with what it is about
    "ruleslabel",
    "hl",            # the enumerated calls
    "limit",         # what was refused, and what refusing cost
    "vids",
    "shot",
    "proof",         # receipts
    "card-cta",      # case study
    "ref-offer",     # talk to someone
]
RANK = {name: i for i, name in enumerate(ORDER)}

TIERS = {
    "y30": "lead",
    "PlaySesh": "lead",
    "Pathstream": "lead",
    "GoodRx": "proof",
    "Clover Health": "proof",
    "TaskRabbit": "proof",
    "Blue Startups": "row",
    "Modus Create": "row",
    "StartPlaying": "row",
    "doc.ai": "row",
    "Amazon": "row",
}

SPEC = {
    "lead": {
        "required": {"card-head", "ctx", "impact"},
        "allowed": {"facts", "prose", "ruleslabel", "hl", "limit",
                    "vids", "shot", "proof", "card-cta", "ref-offer", "todo"},
        "prose_words": 180,
    },
    "proof": {
        "required": {"card-head", "ctx", "impact", "proof"},
        "allowed": {"prose", "lineage", "vids", "shot", "card-cta", "todo"},
        "prose_words": 60,
    },
    "row": {
        "required": {"card-head", "ctx"},
        "allowed": {"prose", "proof", "todo"},
        "prose_words": 45,
    },
}

# Slots that may appear at most once anywhere, in any tier. A card with two hooks
# has no hook.
SINGLETON = {"card-head", "ctx", "impact", "facts", "limit", "ruleslabel", "hl", "ref-offer"}

CLASSED = re.compile(
    r'<(?:div|dl|p|ul|h4|img|a)\s[^>]*class="([a-z-]+)"[^>]*>|<p>'
)
ALIAS = {"card-head": "card-head", "facts": "facts", "ctx": "ctx", "impact": "impact",
         "buyer": "buyer", "lineage": "lineage", "limit": "limit", "vids": "vids",
         "ruleslabel": "ruleslabel", "hl": "hl", "shot": "shot", "proof": "proof",
         "card-cta": "card-cta", "ref-offer": "ref-offer", "todo": "todo",
         "role": None, "fig": None, "qual": None, "tech": None, "wide": None,
         "who": None, "rec": None, "tag": None, "proj": "PROJ", "embed": None,
         "facade": None, "play": None, "cap": None, "lbl": None, "card": None,
         "reveal": None}


def slots(inner):
    """Sequence of recognised slot names, in document order."""
    out = []
    for m in CLASSED.finditer(inner):
        if m.group(0) == "<p>":
            out.append("prose")
            continue
        for cls in m.group(1).split():
            name = ALIAS.get(cls, "?" + cls)
            if name:
                out.append(name)
                break
    return out


def words(fragment):
    return len(html.unescape(re.sub(r"<[^>]+>", " ", fragment)).split())


def prose_words(inner):
    total = 0
    for m in re.finditer(r"<p>(.*?)</p>", inner, re.S):
        total += words(m.group(1))
    return total


def check(path, quiet=False):
    src = path.read_text(encoding="utf-8")
    try:
        work = src.split('<h2 class="sec" id="work">')[1].split('<h2 class="sec">What they said')[0]
    except IndexError:
        print("FAIL  cannot locate the work section in %s" % path.name)
        return 1

    fails, warns = [], []
    seen = set()

    for m in re.finditer(r"<article ([^>]*)>(.*?)</article>", work, re.S):
        attrs, inner = m.group(1), m.group(2)
        h3 = re.search(r"<h3>([^<]+)</h3>", inner)
        if not h3:
            fails.append(("(unnamed)", "no <h3> name"))
            continue
        name = html.unescape(h3.group(1)).strip()
        seen.add(name)

        tier = TIERS.get(name)
        if tier is None:
            fails.append((name, "no tier declared. Add it to TIERS in this script"))
            continue
        spec = SPEC[tier]
        seq = slots(inner)

        unknown = [s for s in seq if s.startswith("?")]
        for u in unknown:
            warns.append((name, "unrecognised class %s, not in ALIAS" % u[1:]))
        seq = [s for s in seq if not s.startswith("?")]

        if "PROJ" in seq:
            fails.append((name, "uses nested .proj blocks. No other card does. "
                                "Split into separate cards or flatten to one hook"))
            seq = [s for s in seq if s != "PROJ"]

        for req in sorted(spec["required"] - set(seq)):
            fails.append((name, "tier %s requires %s, missing" % (tier, req)))

        for got in sorted(set(seq) - spec["required"] - spec["allowed"]):
            fails.append((name, "tier %s does not allow %s" % (tier, got)))

        for s in sorted(SINGLETON):
            n = seq.count(s)
            if n > 1:
                fails.append((name, "%d x %s. Allowed once" % (n, s)))

        ranks = [RANK[s] for s in seq if s in RANK]
        if ranks != sorted(ranks):
            out_of_order = [seq[i] for i in range(1, len(ranks)) if ranks[i] < ranks[i - 1]]
            fails.append((name, "out of canonical order at %s" % ", ".join(out_of_order)))

        pw = prose_words(inner)
        if pw > spec["prose_words"]:
            fails.append((name, "%d words of prose, tier %s caps at %d"
                          % (pw, tier, spec["prose_words"])))

        if "todo" in seq:
            warns.append((name, "has an unfilled blank. Not publishable yet"))

    for missing in sorted(set(TIERS) - seen):
        warns.append((missing, "declared in TIERS but not on the page"))

    for form, label in ((chr(8212), "em dash"), ("&mdash;", "&mdash;")):
        if form in work:
            fails.append(("(work section)", "contains %s x%d" % (label, work.count(form))))

    if not quiet:
        for name, msg in fails:
            print("FAIL  %-20s %s" % (name[:20], msg))
        for name, msg in warns:
            print("WARN  %-20s %s" % (name[:20], msg))
        print("\n%d cards checked, %d fail, %d warn" % (len(seen), len(fails), len(warns)))
    return 1 if fails else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", default="index-v2.html")
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()
    sys.exit(check(HERE / a.file, a.quiet))


if __name__ == "__main__":
    main()
