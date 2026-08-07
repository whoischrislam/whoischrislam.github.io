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
    "facts",         # scale, so the number can be calibrated
    "lineage",       # two-company continuity, GoodRx only
    "setup",         # optional, only when what happened diverged from the brief
    "prose",         # the decision: alternative, evidence, choice, cost
    "taught",        # what it changed about how he works
    "buyer",         # what that decision means for the reader
    "todo",          # a blank waiting on Chris, sits with what it is about
    "ruleslabel",
    "hl",            # the enumerated calls
    "limit",         # what was refused, and what refusing cost
    "vids",
    "shot",
    "rec",           # third-party corroboration, after the artifact
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
        "required": {"card-head", "ctx", "facts", "buyer", "taught"},
        "allowed": {"prose", "setup", "ruleslabel", "hl", "limit",
                    "vids", "shot", "rec", "proof", "card-cta", "ref-offer", "todo"},
        "prose_words": 180,
    },
    "proof": {
        "required": {"card-head", "ctx", "facts", "proof", "taught"},
        "allowed": {"prose", "setup", "buyer", "lineage", "vids", "shot", "rec", "card-cta", "todo"},
        "prose_words": 75,   # a four-beat decision runs 50-70; 60 strangled it
    },
    "row": {
        "required": {"card-head", "ctx", "facts"},
        "allowed": {"prose", "proof", "rec", "todo"},
        "prose_words": 45,
    },
}

# Slots that may appear at most once anywhere, in any tier. A card with two hooks
# has no hook.
SINGLETON = {"card-head", "ctx", "impact", "facts", "buyer", "setup", "taught", "limit", "ruleslabel", "hl",
             "ref-offer"}
# Quotes may pair, never stack. Two is corroboration; three is a wall.
MAX_RECS = 2

CLASSED = re.compile(
    r'<(?:div|dl|p|ul|h4|img|a)\s[^>]*class="([a-z-]+)"[^>]*>|<p>'
)
ALIAS = {"card-head": "card-head", "facts": "facts", "ctx": "ctx",          "buyer": "buyer", "setup": "setup", "taught": "taught", "impact": "impact", "outcome": None, "lineage": "lineage", "limit": "limit", "vids": "vids",
         "ruleslabel": "ruleslabel", "hl": "hl", "shot": "shot", "proof": "proof",
         "card-cta": "card-cta", "ref-offer": "ref-offer", "todo": "todo",
         "role": None, "fig": None, "qual": None, "tech": None, "wide": None,
         "who": None, "rec": "rec", "tag": None, "proj": "PROJ", "embed": None,
         "facade": None, "play": None, "cap": None, "lbl": None, "card": None, "when": None, "ch-top": None,
         "reveal": None, "reccluster": None}


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
    # Regex, not string split: adding an id to either heading used to silently
    # widen the audit to the side projects.
    try:
        start = re.search(r'<h2[^>]*id="work"[^>]*>', src).end()
        stop = re.search(r'<h2[^>]*>\s*Side projects', src[start:]).start() + start
        work = src[start:stop]
    except AttributeError:
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

        # A quote carries its own <p>. That is the recommender's sentence, not
        # Chris's read layer, so it must not count as prose or shift the order.
        recs = re.findall(r'<div class="rec">.*?<div class="who">.*?</div>\s*</div>',
                          inner, re.S)
        # Collapse each to an empty marker so the slot keeps its position in the
        # sequence while its <p> stops counting as Chris's prose.
        stripped = inner
        for r in recs:
            stripped = stripped.replace(r, '<div class="rec"></div>')

        seq = slots(stripped)

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

        if seq.count("rec") > MAX_RECS:
            fails.append((name, "%d quotes. Two is corroboration, more is a wall"
                          % seq.count("rec")))

        for s in sorted(SINGLETON):
            n = seq.count(s)
            if n > 1:
                fails.append((name, "%d x %s. Allowed once" % (n, s)))

        ranks = [RANK[s] for s in seq if s in RANK and s != "todo"]
        if ranks != sorted(ranks):
            ordered = [s for s in seq if s in RANK and s != "todo"]
            out_of_order = [ordered[i] for i in range(1, len(ranks)) if ranks[i] < ranks[i - 1]]
            fails.append((name, "out of canonical order at %s" % ", ".join(out_of_order)))

        pw = prose_words(stripped)
        if pw > spec["prose_words"]:
            fails.append((name, "%d words of prose, tier %s caps at %d"
                          % (pw, tier, spec["prose_words"])))

        cm = re.search(r'<p class="ctx">(.*?)</p>', stripped, re.S)
        if cm:
            cw = words(cm.group(1))
            if cw == 0:
                fails.append((name, "descriptor is empty. An empty slot passes the "
                                    "presence check and fails the reader"))
            elif cw > 20:
                fails.append((name, "descriptor is %d words, cap is 20. It is a one-liner, "
                                    "not a problem statement" % cw))

        dl = re.search(r'<dl class="facts">(.*?)</dl>', inner, re.S)
        if dl:
            got = re.findall(r"<dt>([^<]+)</dt>", dl.group(1))
            RESULT = {"Result", "Adoption", "Tradeoff"}
            fixed = [g for g in got if g in ("Stage", "Team", "Owned", "Stack")]
            extra = [g for g in got if g not in ("Stage", "Team", "Owned", "Stack")]
            want = [f for f in ("Stage", "Team", "Owned", "Stack") if f in got] + extra
            if tier in ("lead", "proof") and not extra:
                fails.append((name, "tier %s needs a result row after Stack, labeled "
                                    "one of Result / Adoption / Tradeoff" % tier))
            for e in extra:
                if e not in RESULT and name != "GoodRx":
                    fails.append((name, "result label %r not in Result / Adoption / Tradeoff" % e))
            if got != want:
                fails.append((name, "meta order is %s, must be Stage, Team, Owned, Stack"
                              % ", ".join(got)))

        if tier in ("lead", "proof") and not ("vids" in seq or "shot" in seq):
            fails.append((name, "tier %s needs an artifact, a video or an image" % tier))

        # Duty-list detector. The read layer exists for the decision; if a
        # paragraph mostly re-lists the OWNED and STACK fields and shows no sign
        # of a choice, it is written for the recruiter, who is already served by
        # the scan layer two inches higher. Heuristic, so it warns.
        if dl:
            vals = " ".join(re.findall(r"<dt>(?:Owned|Stack)</dt><dd[^>]*>(.*?)</dd>",
                                       dl.group(1), re.S))
            terms = [t.strip().lower() for t in re.split(r"[\u00b7\u2022]", re.sub(r"<[^>]+>", "", vals))]
            terms = [t for t in terms if len(t) > 4]
            prose = " ".join(re.findall(r"<p>(.*?)</p>", stripped, re.S)).lower()
            prose = re.sub(r"<[^>]+>", " ", prose)
            hits = [t for t in terms if t in prose]
            DECIDED = ("instead", "rather than", "first", "tried", "chose", "could not",
                       "couldn't", "wasn't", "so i ", "then i ", "moved", "replaced",
                       "shut it down", "gave up", "stopped", "backward")
            if len(hits) >= 3 and not any(d in prose for d in DECIDED):
                warns.append((name, "read layer re-lists %d meta terms (%s) with no sign "
                                    "of a decision. Written for the recruiter, not the "
                                    "hiring manager" % (len(hits), ", ".join(hits[:3]))))

        bm = re.search(r'<p class="buyer">(.*?)</p>', stripped, re.S)
        if bm:
            btxt = re.sub(r"<[^>]+>", " ", bm.group(1))
            if not re.search(r"\byou\b|\byour\b", btxt, re.I):
                fails.append((name, "buyer line does not address the reader. Its whole job "
                                    "is to name their situation, so it needs you or your"))
            if words(bm.group(1)) > 30:
                fails.append((name, "buyer line is %d words, cap is 30" % words(bm.group(1))))

        tm = re.search(r'<p class="taught">(.*?)</p>', stripped, re.S)
        if tm:
            tw = words(tm.group(1))
            if tw > 35:
                fails.append((name, "taught line is %d words, cap is 35. One sentence" % tw))
            flat = re.sub(r"<[^>]+>", " ", tm.group(1)).lower()
            PLATITUDE = ("communication is", "is important", "teamwork", "always test",
                         "users first", "iterate quickly", "fail fast", "collaboration is")
            for ph in PLATITUDE:
                if ph in flat:
                    warns.append((name, "taught line reads as a platitude (%r). It has to name "
                                        "something that changed how you work" % ph))

        if "todo" in seq:
            warns.append((name, "has an unfilled blank. Not publishable yet"))

    for missing in sorted(set(TIERS) - seen):
        warns.append((missing, "declared in TIERS but not on the page"))

    # Sweep the WHOLE file, not just the work section. A scoped dash check passed
    # while two sat in ported CSS comments, which is the false-confidence failure
    # the external-AI-boundaries rule describes: test every form, everywhere.
    for form, label in ((chr(8212), "em dash"), ("&mdash;", "&mdash;"),
                        ("EN_PROSE", "en dash used as prose punctuation")):
        if form == "EN_PROSE":
            # Legitimate: numeric ranges (2024 - 2026, 60-80). Not legitimate: an
            # en dash standing in for an em dash between words.
            n = len(re.findall(r"[A-Za-z]\s*" + chr(8211) + r"\s*[A-Za-z]", src))
        else:
            n = src.count(form)
        if n:
            fails.append(("(whole file)", "contains %s x%d" % (label, n)))

    # Renders-at-all check. Every other check in here passed while the page was a
    # blank rectangle, because they all validate content and none of them asked
    # whether the content is visible. A flat regex used to port CSS pulled
    # body > *:not(#va-dock){display:none!important} out of its @media print
    # wrapper, and that hides the entire site on screen.
    style = re.search(r"<style>(.*?)</style>", src, re.S)
    if style:
        css = re.sub(r"/\*.*?\*/", "", style.group(1), flags=re.S)
        screen = re.split(r"@media[^{]*\{", css)[0]
        for pat, why in ((r"body\s*>\s*\*[^{]*\{[^}]*display:\s*none",
                          "a rule hiding every direct child of body"),
                         (r"(?:^|\})\s*(?:html|body)\s*\{[^}]*display:\s*none",
                          "display:none on html or body")):
            if re.search(pat, screen):
                fails.append(("(renders)", "%s is active outside a media query. The page "
                                           "will be blank" % why))
        n = len(re.findall(r"display:\s*none\s*!important", screen))
        if n:
            warns.append(("(renders)", "%d display:none !important outside any media query. "
                                       "Check none of them are print rules that lost their "
                                       "@media wrapper" % n))

    if not quiet:
        for name, msg in fails:
            print("FAIL  %-20s %s" % (name[:20], msg))
        for name, msg in warns:
            print("WARN  %-20s %s" % (name[:20], msg))
        print("\n%d cards checked, %d fail, %d warn" % (len(seen), len(fails), len(warns)))
    return 1 if fails else 0


CARD_TEMPLATE = """<article class="card{brief} reveal">
  <div class="card-head">
    <div class="ch-top"><h3>COMPANY</h3><span class="outcome">IPO 2020</span><p class="when">2019 &ndash; 2020</p></div>
    <p class="role"><b>OFFICIAL TITLE</b></p>
    <p class="ctx">What the company was, for whom. One line, 20 words max, no adjectives.</p></div>
  <dl class="facts">
    <div><dt>Stage</dt><dd>How big, how funded, when you joined relative to what</dd></div>
    <div><dt>Team</dt><dd>Who else, and what they owned. Attribution lives here</dd></div>
    <div class="wide"><dt>Owned</dt><dd>What you personally did &middot; narrow enough to survive an audit</dd></div>
    <div class="wide"><dt>Stack</dt><dd class="tech">Tools &middot; and &middot; domain</dd></div>
    <div class="wide"><dt>Result</dt><dd><b>THE NUMBER</b> What it measured, and the honest qualifier</dd></div>
  </dl>
  <p>THE DECISION. Four beats, 50 to 70 words, written for a hiring manager:
  the alternative that was live, the evidence it failed, the choice you made,
  and what that choice cost. Do not re-list Owned or Stack here; the scan layer
  above already has them. Test: does this leave the reader with a question, or
  with an answer?</p>
  <img class="shot" loading="lazy" decoding="async" width="1544" height="579"
    src="images/co/FILE.webp" alt="">
  <div class="proof"><span class="lbl">Receipts</span>
    <a href="URL" target="_blank" rel="noopener">Label it with the proof itself, not "link"</a></div>
  <div class="card-cta"><a href="work/SLUG.html" target="_blank" rel="noopener">Read the case study</a></div>
</article>"""


def template(tier):
    body = CARD_TEMPLATE.format(brief="" if tier == "lead" else " card--brief")
    notes = {
        "lead": "current work and the craft receipt. Artifact required. Prose cap 180w.",
        "proof": "a metric and a checkable receipt. Artifact and receipts required. Prose cap 60w.",
        "row": "a role and a capability, nothing more. No metric, no artifact. Prose cap 45w.",
    }[tier]
    if tier == "row":
        body = re.sub(r'    <div class="wide"><dt>Result</dt>.*?\n', "", body)
        body = re.sub(r'  <img class="shot".*?>\n', "", body, flags=re.S)
        body = re.sub(r'  <div class="card-cta">.*?</div>\n', "", body, flags=re.S)
    print("# tier: %s -- %s" % (tier, notes))
    print("# add the company to TIERS in this script, then run it to verify.")
    print(body)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", default="index-v2.html")
    ap.add_argument("--quiet", action="store_true")
    ap.add_argument("--template", choices=("lead", "proof", "row"),
                    help="print a blank card skeleton for a new company")
    a = ap.parse_args()
    if a.template:
        template(a.template)
        sys.exit(0)
    sys.exit(check(HERE / a.file, a.quiet))


if __name__ == "__main__":
    main()
