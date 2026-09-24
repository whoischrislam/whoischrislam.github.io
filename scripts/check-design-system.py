#!/usr/bin/env python3
"""
check-design-system.py — commit-time enforcement for the design system.

The runtime `?ds` catalog reconciles styled-vs-rendered-vs-cataloged live, but a
render can't run in a git hook. This is the static half: it enforces the
invariants that keep the design system coherent so future edits stay easy.

Enforced (FAIL on violation):
  1. Components — every selector the catalog registry (assets/ds/design-system.js)
     points at must actually be defined in index.html's CSS. Catches a renamed or
     deleted live class silently orphaning a catalog entry.
  2. Colors    — every per-company world palette (body[data-world="…"]) must define
     the full token set (bg / ink / ink-soft / line / accent / surface). Catches a
     new world shipped with a missing color, which is exactly the drift that made
     case studies render wrong.
  3. Type      — the font tokens (--serif / --sans / --mono) must be defined.

Warns (does not block): missing core semantic tokens.

The registry in design-system.js is the single source this reads; if that ever
moves to a JSON manifest, point REG_SOURCE at it.
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
index = (ROOT / "index.html").read_text(encoding="utf-8")
REG_SOURCE = ROOT / "assets/ds/design-system.js"
dsjs = REG_SOURCE.read_text(encoding="utf-8")

# --- classes DEFINED in index.html <style> blocks ---
css = "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", index, re.S))
defined = set(re.findall(r"\.([A-Za-z_][\w-]*)", css))

# --- classes CATALOGED by the registry ---
cataloged = set()
for sel in re.findall(r"sel:'([^']+)'", dsjs):
    cataloged.update(re.findall(r"\.([A-Za-z_][\w-]*)", sel))

errors, warns = [], []

# 1) components
missing = sorted(c for c in cataloged if c not in defined)
if missing:
    errors.append("registry selectors not defined in index.html CSS (renamed or deleted): "
                  + ", ".join("." + m for m in missing))

# 2) colors — world palettes
world_blocks = re.findall(r'\[data-world="([a-z0-9]+)"\]\{([^}]*)\}', index)
required = ["--world-bg", "--world-ink", "--world-ink-soft", "--world-line",
           "--world-accent", "--world-surface"]
worlds = []
for name, body in world_blocks:
    worlds.append(name)
    for tok in required:
        if tok not in body:
            errors.append(f'world "{name}" palette is missing {tok}')
if not worlds:
    errors.append('no body[data-world="…"] palettes found (worlds theming missing?)')
if "--world-card-bg" not in css:
    errors.append("default --world-card-bg card token not defined")

# 2b) colors — legible ON the dark card. Part of the color invariant, not a new check: text on a card uses
#     --world-accent-on-card and the --status-* tokens, so each must clear WCAG AA (4.5:1) against the card
#     it sits on. Day palettes only (rules starting `body[data-world="…"]`); night rows are held/unwired.
#     The accent is checked against the WORST surface it lands on: a plain diagram item (card + 7% card ink),
#     which is lighter than the card itself.
class _BadColor(Exception):
    pass
def _hex(h):
    raw = (h or "").strip()
    v = raw.lstrip("#")
    if len(v) == 3: v = "".join(c * 2 for c in v)
    if not raw.startswith("#") or not re.fullmatch(r"[0-9a-fA-F]{6}", v):
        raise _BadColor(raw)  # var(), named colors, 8-digit alpha hex: not statically checkable -> FAIL, not guess
    return [int(v[i:i + 2], 16) for i in (0, 2, 4)]
def _lum(c):
    c = [v / 255 for v in c]
    c = [v / 12.92 if v <= .03928 else ((v + .055) / 1.055) ** 2.4 for v in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]
def _cr(a, b):
    x, y = _lum(a), _lum(b)
    return (max(x, y) + .05) / (min(x, y) + .05)
def _tok(body, name):
    m = re.search(r"(?<![\w-])" + re.escape(name) + r":\s*([^;]+);", body)
    return m.group(1).strip() if m else None
css_nc = re.sub(r"/\*.*?\*/", "", css, flags=re.S)  # comments can mention token names; parse code only
base_m = re.search(r"body\[data-world\]\{(.*?)\}", css_nc, re.S)
base = base_m.group(1) if base_m else ""
# leading whitespace allowed; night rows (`… body.night-worlds[data-world=…]`) never match `^\s*body\[`
day_rows = [("base", base)] + re.findall(r'(?m)^\s*body\[data-world="([a-z0-9]+)"\]\{([^}]*)\}', css_nc)
day_names = {n for n, _ in day_rows}
for name in sorted(set(worlds) - day_names):
    # a palette the loose check found but this parser did not -> would silently skip contrast; refuse
    if not re.search(r'night-worlds\[data-world="' + name + r'"\]', css_nc):
        errors.append(f'world "{name}" palette found but not parsed for contrast (unexpected rule shape)')
def _item(card, ink):  # plain diagram item surface = card mixed 7% toward card ink
    return [round(c + (i - c) * .07) for c, i in zip(card, ink)]
for name, body in day_rows:
    try:
        card_s = _tok(body, "--world-card-bg") or _tok(base, "--world-card-bg")
        ink_s = _tok(body, "--world-card-ink") or _tok(base, "--world-card-ink")
        card, ink = _hex(card_s), _hex(ink_s)
        acc = _tok(body, "--world-accent-on-card")
        if not acc:
            errors.append(f'world "{name}" palette is missing --world-accent-on-card')
            continue
        for surf, rgb in (("card", card), ("diagram item", _item(card, ink))):
            r = _cr(_hex(acc), rgb)
            if r < 4.5:
                errors.append(f'world "{name}" --world-accent-on-card {acc} is {r:.2f}:1 on {surf} (needs 4.5)')
        for st in ("--status-ok", "--status-warn"):
            v = _tok(body, st) or _tok(base, st)  # a world may override; else the base value applies
            if not v:
                errors.append(f"status token {st} not defined"); continue
            rs = _cr(_hex(v), card)
            if rs < 4.5:
                errors.append(f'{st} {v} is {rs:.2f}:1 on world "{name}" card {card_s} (needs 4.5)')
        mix = re.search(r"color-mix\(\s*in\s+srgb\s*,\s*var\(\s*--world-card-ink\s*\)\s*(\d+)%\s*,\s*transparent\s*\)",
                        _tok(body, "--status-int") or _tok(base, "--status-int") or "")
        if not mix:
            errors.append("--status-int must be color-mix(in srgb,var(--world-card-ink) N%,transparent)")
        else:
            a = int(mix.group(1)) / 100
            blend = [round(c + (i - c) * a) for c, i in zip(card, ink)]
            ri = _cr(blend, card)
            if ri < 4.5:
                errors.append(f'--status-int ({mix.group(1)}% ink) is {ri:.2f}:1 on world "{name}" card (needs 4.5)')
    except _BadColor as bad:
        errors.append(f'world "{name}": color value {bad} is not a #rrggbb hex (cannot contrast-check)')

# 3) type / font
for tok in ["--serif", "--sans", "--mono"]:
    if tok not in css:
        errors.append(f"font token {tok} not defined")

# 4) drift ratchet (learnings #53/#54/#58, approved 2026-09-23). Existing debt is the ceiling; anything NEW fails.
#    Lower a baseline when you pay debt down; never raise one without Chris's call.
#    a) text measure caps: a max-width in `ch` caps a line of text. Chris's recurring pet peeve is text capped
#       narrower than the rules/content around it. New caps must be a named token (var(--measure-*)) so the cap is
#       a deliberate choice. Known raw caps are grandfathered by selector for a design review.
#    b) hardcoded colors / durations outside tokens: count-only ratchet, so the visual grammar stays in tokens.
MEASURE_GRANDFATHERED = {
    ".work-panel-context", ".work-panel-summary", ".work-panel.is-story-view .work-panel-summary",
    ".work-project-card p", ".work-quote-text", ".project-chapter-copy", ".visual-placeholder-title",
    ".visual-placeholder-note", ".work-tile>.visual-placeholder .visual-placeholder-title", ".world-hero-lede",
}
HARDCODED_COLOR_BASELINE = 60
HARDCODED_DURATION_BASELINE = 53
_rules = re.findall(r"([^{}]+)\{([^{}]*)\}", css_nc)
for sel, body in _rules:
    for val in re.findall(r"max-width:\s*([^;]+)", body):
        if re.search(r"\d\s*ch\b", val) and "var(" not in val:
            for s in (x.strip() for x in sel.split(",")):
                if s and s not in MEASURE_GRANDFATHERED:
                    errors.append(f"text measure cap {val.strip()} on `{s}` must use a var(--measure-*) token "
                                  "(accidental text caps are a known regression here)")
_decls = re.findall(r"([\w-]+)\s*:\s*([^;{}]+)", css_nc)
n_color = sum(1 for p, v in _decls if not p.startswith("--") and re.search(r"#[0-9a-fA-F]{3,8}\b|rgba?\(", v))
n_dur = sum(1 for p, v in _decls if p in ("transition", "animation", "transition-duration", "animation-duration")
            and re.search(r"\b\d*\.?\d+m?s\b", v))
if n_color > HARDCODED_COLOR_BASELINE:
    errors.append(f"hardcoded colors outside tokens rose to {n_color} (ceiling {HARDCODED_COLOR_BASELINE}): use a token")
if n_dur > HARDCODED_DURATION_BASELINE:
    errors.append(f"hardcoded durations rose to {n_dur} (ceiling {HARDCODED_DURATION_BASELINE}): use a motion token")
if n_color < HARDCODED_COLOR_BASELINE or n_dur < HARDCODED_DURATION_BASELINE:
    warns.append(f"drift debt went DOWN (colors {n_color}/{HARDCODED_COLOR_BASELINE}, durations "
                 f"{n_dur}/{HARDCODED_DURATION_BASELINE}): lower the baselines to lock it in")

# soft: semantic tokens
for tok in ["--bg", "--text", "--accent", "--surface", "--border"]:
    if tok not in css:
        warns.append(f"semantic token {tok} not defined")

for w in warns:
    print("WARN  " + w)
if errors:
    for e in errors:
        print("FAIL  " + e)
    print(f"\ncheck-design-system: {len(errors)} error(s)")
    sys.exit(1)
print(f"PASS  design system coherent ({len(worlds)} world palettes, "
      f"{len(cataloged)} cataloged classes all defined, {len(warns)} warning(s))")
