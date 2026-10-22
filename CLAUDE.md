# Neuro Lab — Project Rules

1. Project: "Neuro Lab", an educational interactive website about neurons, neural networks and real brain connectomes. Built with Vite + TypeScript, deployed to GitHub Pages. The user is a high-school student (Gymnasium, math/science profile) who wants to deeply understand the theory, not just get working code.
2. At the start of every session, read docs/ROADMAP.md. Only work on the step the user names, but design code so it supports later steps.
3. After finishing a step: check its box in ROADMAP.md and add short notes under it on what was built and any decisions later steps need to know.
4. Architecture: all math and simulation code lives in src/models/ and must never access the DOM or browser APIs, so it can run in tests, Web Workers and Node scripts. UI code lives in src/ui/ and src/pages/ and contains no model math.
5. Before implementing any model, explain the equations and every parameter in docs/NOTES.md, written for a high-school student: what it means physically/biologically, where it comes from, and its limitations.
6. Every model gets Vitest tests that compare against a known analytical result, a hand calculation, or a published value.
7. Document units in comments (mV, ms, nA, µS, etc.) and keep them consistent.
8. Heavy simulations and training run in Web Workers so the page never freezes.
9. Never claim a result is biologically accurate without stating its assumptions — both in NOTES.md and on the website itself.
10. If unsure about a scientific fact, parameter value or data source, say so clearly instead of guessing.
11. Explain non-obvious code in comments with clear variable names.
12. Libraries: uPlot (live plots), KaTeX (formulas), d3-force (graphs), Vitest (tests). Ask before adding other dependencies.
