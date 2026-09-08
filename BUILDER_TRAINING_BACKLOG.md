# Builder Training — Rep Backlog

Pre-loaded material for the daily verification rep defined in `BUILDER_TRAINING.md`.
Compiled 2026-08-24 from a four-agent sweep of 43 pre-AI-wave repositories
(2020-08 → 2024-11; 372 commits total; **0 test files of any kind**).

## Why this file exists

The daily rep has one failure mode: spending the 25 minutes deciding what to
practice. This file removes that decision. Take the top unstruck line, do the rep,
strike it, stop.

## How one rep works (25 minutes, AI as reference only — never as author)

1. **Reproduce (0:00–0:08).** The defect below is *reported*, not proven. Clone the
   repo, run it, and make the failure happen. If it does not reproduce, strike the
   line as `NOT-REAL` and move to the next one. This step is the rep — every finding
   here came from an agent, and agents are wrong often enough that checking is the skill.
2. **Write the failing case by hand (0:08–0:18).** A test if the repo can host one,
   otherwise a script or a documented manual repro that fails before and passes after.
   Type it. No completion, no generation.
3. **Fix by hand (0:18–0:23).**
4. **Log (0:23–0:25).** One line in `BUILDER_TRAINING_LOG.md`. If a term stalled you,
   add one card to `ai-mastery-syllabus/srs/active.md` (max five total).

Stop at 25 minutes even if unfinished. An unfinished rep still logs.

## Repo locations

Cloned to a scratch dir during the 2026-08-24 sweep; re-clone with
`gh repo clone whoischrislam/<name>`. Visibility noted where it matters.

---

## Tier 1 — Unobserved-condition defects (the core gap)

Each of these shipped because it was verified once, on one machine, on the happy path.

- [ ] **`shotclock/src/components/Clock.jsx:31-46`** — `useEffect` with no dependency
      array and no cleanup return; `resetTimer` re-fires it and silently restarts a
      paused clock. `counter = useRef()` is assigned and never read.
      *(VERIFIED directly, 2026-08-24 — the effect genuinely has neither.)*
- [ ] **`playsesh.io/app.js:21`** — `let playSeshInfo = {}` at module scope, mutated by
      every write route. Two concurrent creates interleave and one user's session is
      written with another's data. *(VERIFIED directly, 2026-08-24.)*
      Rep: two simultaneous POSTs, assert both rows are correct.
- [ ] **`playsesh.io/app.js:176,209`** — `validationResult(req.body)` where the API takes
      `req`. An empty POST body returns 200. The 422 branch has never executed.
      Rep: POST `{}` and assert 422.
- [ ] **`playsesh.io/app.js:274-301`** — `GET /generate-ics?id=<unknown>` dereferences
      `undefined` with no try/catch; Express 4 does not catch async rejections, so the
      process exits. Ids are `Math.random()*1000000` — guessable.
- [ ] **`playsesh.io/public/js/index.js:42`** — `Math.abs(timezoneOffset / 60)` discards
      the sign. Correct in Honolulu and New York, silently wrong by 2× the offset east
      of UTC, and a hard 500 in half-hour zones (Kolkata, Adelaide).
      Rep: table-driven test across six zones.
- [ ] **`playsesh.io/views/index.ejs:15`** — `pattern="[a-zA-Z0-9]+"` on the Game field.
      HTML `pattern` is anchored, so no spaces: every multi-word game title is rejected,
      including the ones in the placeholder three lines below.
- [ ] **`playsesh.io-chrome-extension/scripts.js:85`** — `gameLinks.indexOf(linktoRemove)`
      compares a DOM element against an array of URL strings, always returns `-1`, and
      `splice(-1,1)` deletes the **last** item regardless of which was clicked.
- [ ] **`progress-pal/src/goal.jsx:20-24`** — `saveEdit` flips `editMode` and logs; it
      never calls back to the parent. Every edit is silently discarded on next render.
      `App.jsx:23` is an empty stub comment where the handler should be.
- [ ] **`progress-pal/src/App.jsx:43-45`** — goals are bare strings, so removal by filter
      deletes **every** duplicate. Also `key={index}` on a mutable list (`App.jsx:66`).
- [ ] **`js-concept-practice/index.js:9`** — `const totalPrice = 0`, never recomputed,
      rendered once at `:32`. The order total is permanently $0.
- [ ] **`404humanmissing/src/components/ChatBot.jsx:153-178`** — network call fired inside
      a `setState` updater. Impure; double-fires every message under React 18 StrictMode.
      `:171` clobbers state instead of using a functional update.
- [ ] **`expressjs-web-app-blog/app.js:14`** — `await supabase...select()` runs once at
      module load; `:45` serves that frozen snapshot forever. New posts never appear.
- [ ] **`expressjs-web-app-blog/app.js:72-74, 88-90`** — reference `posts`, deleted in the
      Supabase migration. Every delete and edit throws `ReferenceError`, uncaught.
- [ ] **`ejs-practice/views/index.ejs:39-73`** — `removeChild` detaches the node, then the
      code keeps styling the detached node; the next odd tick throws `NotFoundError`.

## Tier 2 — Correctness and security habits

- [ ] **`password-generator/index.js:50`** — `Math.random()` generating passwords.
      Should be `crypto.getRandomValues`. Rep: fix it, then write the test that would
      have caught it (assert the source, not the output).
- [ ] **`password-generator/index.js:37-39`** — destructively filters a shared
      module-level array, then "restores" it by re-pasting a 94-element literal,
      guarded by the magic number `characters.length < 55`.
- [ ] **`api-dashboard/index.js:60-71`** — `getWeather` mixes `await` with `.then` and has
      no catch. Denying location permission produces a silent unhandled rejection.
- [ ] **`meme-generator/src/MemeForms.jsx:26-27`** — `handleClick` throws on `undefined.url`
      if clicked before the fetch resolves. No loading state anywhere.
- [ ] **`my-food-picks/index.js:70-72`** — `clearList()` calls `.remove()` on a possibly-null
      element; throws when the DB is empty on first load. Empty-state `<p>` duplicates
      on every empty snapshot.
- [ ] **`gratitude-pwa/scripts.js:48`** — `event.preventDefault()` inside an arrow function
      that declares no `event` parameter; relies on the deprecated `window.event` global.
- [ ] **`first-chrome-extension/index.js:15`** — calls `clearBTN.remove()` where only
      `existBTN` is in scope. ReferenceError if that branch is hit. Also requests
      `http://*/*` + `https://*/*` for an extension that only touches `localStorage`.
- [ ] **`boozephreaks/src/components/layout.js:24-32`** — `useStaticQuery` sits after an
      unconditional `return` at `:17`. Dead code; `data` never used.
- [ ] **`boozephreaks/src/components/header.js:6-27`** — scroll listener added in
      `componentDidMount`, never removed. No `componentWillUnmount`.
- [ ] **`api-color-schemer/index.js:13-25` vs `39-51`** — the same twelve lines, copy-pasted,
      one day *after* doing exactly that refactor in `api-blog-test`.
- [ ] **`travel-data-react/src/App.jsx:9-13`** — `props.id` doubles as an array index;
      breaks on any reorder or filter. Also `target="_blank"` with no `rel="noopener"`.

## Hygiene — do once, not as reps

- [ ] **ROTATE: `ai-polyglot` (PUBLIC)** — OpenAI key hardcoded at `index.js` in commit
      `cf35cbc`, also baked into the committed `dist/` bundle. The "Fixed private API key"
      commit moved it to `VITE_API_KEY`, which Vite inlines into the client bundle anyway.
- [ ] **ROTATE: `404humanmissing` (private)** — `.env` committed at `6b5226c`.
- [ ] **ROTATE: `playsesh.io` (private)** — `.env` at `7eff7e4` holds `SUPABASE_SERVICE_KEY`
      (bypasses RLS). File deleted the same day; history never rewritten.
- [ ] **ROTATE: `test-discord-app` (private)** — `.env` git-tracked, `.gitignore` empty.

## When this list runs out

Roughly five weeks of weekdays. Then the material moves to live code: take the last
thing an agent wrote for y30, the portfolio, or voice-noir, and find the unobserved
condition in it. Same 25 minutes, same three steps. That is the transition from
practising the muscle to using it.
