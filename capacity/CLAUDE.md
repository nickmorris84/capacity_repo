# Working agreement
1. Read SPEC.md and PROGRESS.md and run `npm test` at the start of every session.
2. Never write code past a red test; fix or flag.
3. Stay inside the current phase's scope — do not build ahead, do not "improve" other phases.
4. Engine code is pure JS: no DOM, no React imports.
5. Libraries: react, react-dom, recharts, xlsx (SheetJS), esbuild, jsdom only.
6. End every session: update PROGRESS.md with what passed, commit `P<n>: <summary>`.
7. Ask at most 3 clarifying questions, only if the answer changes architecture.
