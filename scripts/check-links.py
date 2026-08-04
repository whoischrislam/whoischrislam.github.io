#!/usr/bin/env python3
"""Check every external link on a page still resolves.

A "Verify" link that 404s is worse than no link: it invites a click and then
proves the opposite of the point. Run before publishing, and after any edit
that touches proof rows.

    python3 scripts/check-links.py [file ...]
"""
import concurrent.futures as cf, pathlib, re, subprocess, sys

FILES = sys.argv[1:] or ["index-v2.html", "index.html", "candidate.html"]
SKIP = ("fonts.googleapis.com", "fonts.gstatic.com")  # preconnect hints, not links

def check(u):
    r = subprocess.run(
        ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-L",
         "-A", "Mozilla/5.0", "--max-time", "25", u],
        capture_output=True, text=True)
    return u, r.stdout.strip()

def main():
    urls = {}
    for f in FILES:
        path = pathlib.Path(f)
        if not path.exists():
            print(f"skip  {f} (missing)"); continue
        for u in re.findall(r'href="(https?://[^"]+)"', path.read_text()):
            if not u.startswith(SKIP) and not any(s in u for s in SKIP):
                urls.setdefault(u, set()).add(f)
    print(f"checking {len(urls)} external links across {len(FILES)} file(s)\n")

    bad = []
    with cf.ThreadPoolExecutor(8) as ex:
        for u, code in ex.map(check, urls):
            # 403 and 999 are bot-blocks, not dead links. LinkedIn serves 999
            # intermittently to the same URL that returns 200 on the next run,
            # so treating it as dead produces false alarms, which is how a
            # checker stops being trusted.
            ok = code in ("200", "301", "302", "403", "999")
            print(f"  {'ok  ' if ok else 'DEAD'} {code:>4}  {u[:96]}")
            if not ok:
                bad.append((code, u, sorted(urls[u])))

    print()
    if bad:
        print(f"FAIL  {len(bad)} dead link(s). Do not publish.")
        for code, u, files in bad:
            print(f"      [{code}] {u}\n            in {', '.join(files)}")
        return 1
    print("PASS  every external link resolves.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
