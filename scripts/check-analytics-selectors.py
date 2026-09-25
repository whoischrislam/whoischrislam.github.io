#!/usr/bin/env python3
"""
check-analytics-selectors.py — STAGED DRAFT, not wired into verify.sh.

Source: .claude/rules/duplicated-surfaces-drift-without-automated-parity.md,
promoted from raw pattern pattern-2026-09-24-duplicated-surfaces-drift-without-
automated-parity.yaml (incident: violation-2026-08-19-analytics-selectors-
stale-across-rewrites — four analytics.js selectors went dead across two HTML
rewrites with zero enforcement, the same shape as the facts.js drift that
test-facts.mjs now catches, but with no equivalent gate ever built for
analytics).

What this checks (existence / selector-reachability only, per the validator's
scoping caveat — NOT string-equality, NOT "did the copy change"):
  - every literal selector analytics.js queries (querySelector /
    querySelectorAll argument) that targets a CSS class, id, or attribute
    match is checked for at least one match against the live index.html DOM
    using a real HTML parser (not regex-on-tags), so a selector that no
    longer matches anything in the current markup fails loudly instead of
    shipping dark.

Deliberately NOT checked here: whether the analytics EVENT NAMES or copy are
still accurate, whether the elements are visually correct, or any other
judgment call. This is existence/reachability only.

Known blind spot, confirmed on first run against this repo's real index.html
(2026-09-24): this parser reads static markup only. Selectors that only exist
after page JS runs (this site renders some links from data arrays, e.g. the
`actions: [["https://y30.ai", ...]]` card-action data that gets turned into a
real `<a>` at runtime) will falsely report "no match" here even though the
element is real once rendered. Per this repo's own verify-by-rendering
convention, treat any FAIL from this script as "confirm in a headless render
before treating as broken," not as an automatic true positive - except for
selectors with zero occurrence anywhere in the raw file text (class names,
static hrefs), which cannot be JS-injected under a different name and are
unambiguous. On the first run here, `.arc-more`, `.video-facade`,
`a[href*="cal.com/"]`, and `[onclick*="mailto:"]` are all zero-occurrence
(the same four the original incident already named as dead); `a[href*="y30.ai"]`
and `iframe[src*="loom.com"]` are very likely JS-render false positives and need
a headless check, not a code fix, before anyone touches analytics.js.

STAGED — this is a draft for Chris to review before it is added to
scripts/verify.sh's `checks` list. Running it standalone is safe; it does not
mutate anything. Known false-positive risk: selectors inside
`[onclick*="..."]` or attribute-substring matches (e.g. `a[href*="cal.com/"]`)
are structurally valid CSS attribute selectors and will report a real
"no match" if the referenced href/onclick text changes shape even slightly
(e.g. mailto: obfuscation, a link wrapper element) — that is a true positive
for parity but worth a human glance before this blocks a commit.

    python3 scripts/check-analytics-selectors.py
"""

from __future__ import annotations

import html.parser
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ANALYTICS = ROOT / "analytics.js"
INDEX = ROOT / "index.html"

SELECTOR_CALL = re.compile(
    r"""querySelector(?:All)?\(\s*(['"])(.*?)\1\s*\)""", re.S
)


class Collector(html.parser.HTMLParser):
    """Collects tag names, id/class attribute values, and full attribute
    key/value pairs so we can approximate CSS selector matching without a
    real browser (this repo has no headless-DOM dependency to lean on)."""

    def __init__(self) -> None:
        super().__init__()
        self.tags: list[tuple[str, dict[str, str]]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.tags.append((tag, {k: (v or "") for k, v in attrs}))

    handle_startendtag = handle_starttag


def matches(selector: str, tags: list[tuple[str, dict[str, str]]]) -> bool:
    """Very small selector matcher covering the shapes analytics.js actually
    uses: tag, .class, [attr], [attr^=], [attr$=], [attr*=], and comma-joined
    groups. Not a general CSS engine on purpose — this only needs to catch
    'selector matches nothing anymore', not implement the full spec."""
    for part in selector.split(","):
        part = part.strip()
        if _matches_single(part, tags):
            return True
    return False


ATTR_RE = re.compile(r"\[([\w-]+)(?:([~^$*]?=)\"([^\"]*)\")?\]")


def _matches_single(sel: str, tags: list[tuple[str, dict[str, str]]]) -> bool:
    # split leading tag/class from bracket predicates, e.g. a[href^="mailto:"]
    m = re.match(r"^([\w-]*)((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$", sel)
    if not m:
        return True  # unparseable shape: don't false-positive, let a human look
    tag, classes, attrs = m.groups()
    class_list = [c[1:] for c in re.findall(r"\.[\w-]+", classes)]
    attr_preds = ATTR_RE.findall(attrs)

    for tname, tattrs in tags:
        if tag and tag != tname:
            continue
        if class_list:
            have = set(tattrs.get("class", "").split())
            if not all(c in have for c in class_list):
                continue
        ok = True
        for attr_name, op, val in attr_preds:
            actual = tattrs.get(attr_name)
            if actual is None:
                ok = False
                break
            if op == "=" and actual != val:
                ok = False
                break
            if op == "^=" and not actual.startswith(val):
                ok = False
                break
            if op == "$=" and not actual.endswith(val):
                ok = False
                break
            if op == "*=" and val not in actual:
                ok = False
                break
        if ok:
            return True
    return False


def main() -> int:
    if not ANALYTICS.is_file() or not INDEX.is_file():
        print("FAIL  analytics.js or index.html not found at repo root")
        return 1

    js = ANALYTICS.read_text(encoding="utf-8")
    parser = Collector()
    parser.feed(INDEX.read_text(encoding="utf-8"))

    selectors = sorted(set(m.group(2) for m in SELECTOR_CALL.finditer(js)))
    failures = []
    for sel in selectors:
        if not matches(sel, parser.tags):
            failures.append(sel)

    if failures:
        print("FAIL  analytics.js selectors with no match in current index.html:")
        for sel in failures:
            print(f"  - {sel}")
        print(f"\nFAIL  {len(failures)} of {len(selectors)} analytics selector(s) went dark.")
        return 1

    print(f"PASS  all {len(selectors)} analytics.js selector(s) match index.html.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
