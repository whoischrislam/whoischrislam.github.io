#!/usr/bin/env python3
"""Block large copy-pasted blocks in hand-written source (textual DRY gate).

Flags any run of >= WINDOW consecutive non-blank, normalized lines that appears
in 2+ places. A big exact-duplicate block is almost always accidental copy-paste,
not intentional templating (which uses short repeated units or data). This does
NOT catch conceptual duplication (rebuilding a system that already exists) — that
stays a human judgment (AGENTS.md "How we build" rule 1).
"""
import subprocess, sys, collections, pathlib

WINDOW = 40  # min duplicated block size, in non-blank lines

def tracked_sources():
    out = subprocess.run(["git", "ls-files", "*.html", "*.js"],
                         capture_output=True, text=True).stdout.split()
    return [f for f in out if ".min." not in f and "node_modules/" not in f]

def norm_lines(path):
    lines = pathlib.Path(path).read_text(errors="replace").splitlines()
    # (original 1-based line number, normalized content) for non-blank lines
    return [(i + 1, ln.strip()) for i, ln in enumerate(lines) if ln.strip()]

def main():
    seen = collections.defaultdict(list)  # window-hash -> [(file, start_line)]
    for f in tracked_sources():
        nl = norm_lines(f)
        for i in range(len(nl) - WINDOW + 1):
            block = tuple(c for _, c in nl[i:i + WINDOW])
            seen[hash(block)].append((f, nl[i][0]))

    dupes = {h: locs for h, locs in seen.items() if len({l for l in locs}) > 1}
    # collapse overlapping windows so one pasted block reports once
    reported, groups = set(), []
    for locs in dupes.values():
        key = frozenset(locs)
        if key in reported:
            continue
        reported.add(key)
        groups.append(locs)

    if not groups:
        print(f"PASS  no duplicated blocks >= {WINDOW} lines")
        return 0

    print(f"FAIL  {len(groups)} duplicated block(s) >= {WINDOW} lines "
          f"(extend the original, don't paste):")
    for locs in groups[:20]:
        where = ", ".join(f"{f}:{ln}" for f, ln in sorted(set(locs)))
        print(f"   {where}")
    return 1

if __name__ == "__main__":
    sys.exit(main())
