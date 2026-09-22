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

# 3) type / font
for tok in ["--serif", "--sans", "--mono"]:
    if tok not in css:
        errors.append(f"font token {tok} not defined")

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
