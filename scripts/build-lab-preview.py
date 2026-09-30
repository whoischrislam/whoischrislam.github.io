#!/usr/bin/env python3
"""Copy index.html into an unlisted lab/ preview for remote review (Chris 2026-09-29: no Claude artifacts).

Usage: python3 scripts/build-lab-preview.py lab/<name>-<hex>.html
The copy gets <base href="/"> (assets resolve from the site root), noindex, and no analytics, so a preview never
pollutes PostHog or search. It is a snapshot: rerun after each change. Delete the file when the preview is done.
"""
import sys, re, pathlib
out = pathlib.Path(sys.argv[1])
s = pathlib.Path("index.html").read_text()
s = s.replace('<html lang="en"><head>', '<html lang="en"><head><base href="/">', 1)
s = s.replace('<meta name="robots" content="index, follow">', '<meta name="robots" content="noindex, nofollow">', 1)
s = s.replace('<script type="text/javascript" src="analytics.js" defer></script>', '', 1)
assert '<base href="/">' in s and 'noindex, nofollow' in s and 'analytics.js' not in s.split('</head>')[0]
out.parent.mkdir(exist_ok=True)
out.write_text(s)
print("wrote", out)
