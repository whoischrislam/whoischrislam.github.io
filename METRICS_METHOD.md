# How the engineering numbers on this site are counted

Every commit and test figure published on this site has one canonical counting
rule. The rules are here so the numbers can be re-derived months later and get
the same answer, and so a reader who wants to check one can run the command
themselves.

Last reconciled: **2026-08-04**. Ground truth beat the published figures in
three of twelve claims, which is why this file exists.

---

## y30 (private repo)

**Commits — 1,400.** Branch `dev`, merge commits included.

```
git rev-list --count dev
```

`origin/main` is a stale release branch (last commit 2026-05-28, 1,285) and
must not be used. Without merges the figure is 1,320.

**Test files — 122.** Count test *modules*, not every file that happens to sit
in a test directory.

```
git ls-tree -r --name-only dev \
  | grep -cE '(^|/)test_[^/]*\.py$|\.(test|spec)\.[jt]sx?$'
```

The site previously said 127, which was every `.py` file under `agent/tests/`
including 16 harnesses and fixtures (`conftest.py`, runners, scenario loaders).
Those are infrastructure, not tests. If a larger honest number is ever wanted,
`2,824 test functions` is defensible and countable.

---

## PlaySesh (private repo `playsesh-web`)

**Commits — 1,147 of 1,793.** Branch `origin/main`, merges included, author
matched by **email** so both name spellings are captured.

```
git rev-list --count origin/main
git rev-list --count --author='whoischrislam@gmail.com' origin/main
```

The local default branch is `dev`; do not count against it. Excluding merges
gives 967 of 1,502, which is equally true and a weaker way to say it.

**Tests — 291.** Use the runner's own output, not a grep. The `Nightly Verify`
workflow on `main` prints `Tests 291 passed (291)` and `Test Files 22 passed
(22)`. A static count of `it(`/`test(` agrees exactly, because the suite has no
parameterised or generated cases.

Adoption figures for PlaySesh are governed separately by `PLAYSESH_METRICS.md`.

---

## Evolve, Die, Repeat (private repo `edr`)

**Tests — 1,568.** The runner's printed total. The suite uses a from-scratch
runner (`tests/test_runner.lua`) driven by `tests/run_headless.lua`, which stubs
the Love2D globals so plain `lua` can execute it.

```
lua tests/run_headless.lua | tail -3
```

Do not count `TestRunner:register` calls statically — that gives 1,528, because
some tests register inside data-driven loops.

**Test files — 69.**

```
find tests -name 'test_*.lua' ! -name 'test_runner.lua' | wc -l
```

The site previously said 72. That was never true; the highest this repo has ever
reached is 69.

---

## HogWare (this repo)

**Keyframes — 33.**

```
grep -c '@keyframes' hogware.html
```

**Checks — 32.** Counted statically from `tests/smoke-hogware.js`: 23 fixed
`log()` call sites plus a 4-iteration and a 5-iteration loop. Preferred method
is to run the suite and quote its own `ALL N CHECKS PASSED` line, since static
counting around loops is easy to get wrong.

---

## Numbers deliberately not published

Two figures in `work/design-systems-for-agents.html` have no recoverable
counting method and no scope that reproduces them: "171 hardcoded colors" and
"935 token references against 923 raw hex". Re-measuring the same scope today
gives materially different values. That page is unlinked; the figures should be
recomputed with a pinned command or softened to the claim they were making,
which does survive: roughly one hardcoded colour for every token reference.

---

## The rule

A number goes on this site only if a command in this file produces it. If a
claim cannot be re-derived, it gets recomputed or removed, not repeated.
