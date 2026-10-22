# Neuro Lab — Roadmap

When a step is finished, change its `[ ]` to `[x]` and add short notes under it: what was built and any decisions later steps need to know (see rule 3 in CLAUDE.md).

Applies to every step's "Done when": a step with UI is only done when it also works on a phone and passes a basic accessibility check (usable with the keyboard, labelled controls, readable contrast in both themes).

# DESIGN DECISIONS

Agreed in the roadmap review on 2026-10-22. Every session follows them; the step in brackets is where each one first matters. Change a decision only for a good reason, and note the change and the reason under the step where it happened.

- **A1. Routing and base path [Step 1]:** the repo is called `neuro-lab`, so GitHub Pages serves the site at `https://nicklkkvc.github.io/neuro-lab/`. Use Vite's multi-page mode (one HTML file per lab), so reloading any page works; a single-page-app route like `/neuron-lab` would give a 404 on reload. Set Vite's `base` to `/neuro-lab/`, and prefix every fetch of a file in `public/` (MNIST weights, celegans.json) with `import.meta.env.BASE_URL`.
- **A2. Number precision [Steps 2, 8, 10]:** all model math uses `Float64Array`. `Float32Array` is only for storing or exporting data, such as the trained weights in Step 11. Reason: Float32's rounding error (~1e-7) is about as large as RK4's error at typical step sizes, so it would spoil the Step 2 convergence test and break the Step 10 gradient check.
- **A3. Solver vs. events [Steps 2–7, 17]:** the solvers integrate only the smooth part of the equations. Everything discontinuous (threshold and reset, refractory period, spike delivery with delays) lives in a separate event layer around the solver, reused by LIF, Izhikevich, synapses and the worm. Solvers don't allocate memory while running: the derivative function has the form `f(t, y, dydt)` and writes into a pre-made buffer, and RK4's k1–k4 buffers are created once.
- **A4. Many neurons at once [Step 3 onward]:** models store the state of N neurons in arrays (one `Float64Array` per variable); a single-neuron page is N = 1. Synaptic connections between simulated neurons are stored as sparse lists, not dense matrices (the layer weights of the Part 3 networks stay dense matrices). This way Step 17 reuses the code from Steps 3 and 7 instead of rewriting it.
- **A5. Synapse generality [Step 7]:** the synapse model works with any neuron model and has spike-triggered and graded release (graded is needed because the main worm model in Step 17 is non-spiking). Already written into Steps 7 and 17.
- **A6. Units [Step 2 onward]:** the standard set is mV, ms, nA, MΩ, µS, nF. They fit together: mV/nA = MΩ, nA/mV = µS, MΩ·nF = ms. Exceptions, stated on their pages: Hodgkin-Huxley uses per-area units (µA/cm², mS/cm², µF/cm²), and Izhikevich's input I has no physical unit. Every page states the unit of its input.
- **A7. Seeded random numbers [first needed in Step 9]:** all randomness (datasets, weight initialization, noise) comes from a seeded generator in `src/models/random.ts`, never `Math.random`, so tests and demos are repeatable.
- **A8. Enforcing rule 4, and workers [Steps 1, 10]:** `src/models/` gets its own tsconfig without the DOM library, so the compiler rejects browser APIs there. Worker entry files live in `src/workers/` as thin wrappers around `src/models/`. All workers share one message protocol (start, stop, set parameters, progress/result), built in Step 10 and reused in Steps 11 and 17.
- **A9. TypeScript scripts in Node [Step 1; used in Steps 11, 14]:** `scripts/*.ts` run with Node's built-in TypeScript support (Node 24), without extra tools. This only works with TypeScript that Node can strip: no `enum`, no `namespace`, no constructor parameter properties, `import type` for types, and relative imports ending in `.ts`. Turn on `erasableSyntaxOnly`, `verbatimModuleSyntax` and `allowImportingTsExtensions` in tsconfig in Step 1 (check the exact settings against the Node docs then). The alternative, `tsx`, would be a new dependency (rule 12).
- **A10. NOTES.md format [Step 2 onward]:** Markdown with LaTeX formulas, `$…$` inline and `$$…$$` on their own line. GitHub displays them, and the Theory page renders them with KaTeX. One `##` heading per topic with a stable name, so labs can link to it.
- **A11. Connectome format [Step 14]:** one generic JSON schema for the worm (Steps 14–19) and the fly (Step 20): a list of neurons (name, type, neurotransmitter, …) and a list of connections that point to neurons by index, each with a type (chemical or electrical), a direction and a weight (synapse count). The exact fields are decided in Step 14 and noted under it.
- **A12. Language [Step 1]:** the site, docs/NOTES.md and code comments are in English, like the roadmap. Translating every text later would be a lot of work, so there is no German version unless that decision changes early.

# PART 1 — FOUNDATION

## [x] Step 1: Site skeleton
- Prerequisites: GitHub account (✓ nicklkkvc). Repo name: `neuro-lab`, so the site URL is `https://nicklkkvc.github.io/neuro-lab/` (see A1). The repo must be public (GitHub Pages on a free account needs that). In the repo's Settings → Pages, set Source to "GitHub Actions".
- Set up Vite + TypeScript project.
- Add .gitattributes so text files always use LF line endings (Windows uses CRLF, the GitHub Actions runner is Linux).
- Home page + navigation: Neuron Lab, Network Lab, Brain Lab, Theory.
- Minimal Theory page: renders the sections of docs/NOTES.md (Markdown with `$…$` LaTeX formulas, one heading per topic) with KaTeX, so every lab goes live with its theory from the start. Uses markdown-it as the Markdown parser (CLAUDE.md rule 12).
- Credits & licenses page: license of the code, plus every data source with its license (filled in as data is added: MNIST in Step 11, connectome in Step 14, FlyWire in Step 20).
- Dark/light theme, responsive layout that works on phones.
- GitHub Actions workflow deploying to GitHub Pages. Add Vitest.
- Done when: npm run dev works, navigation works on desktop and phone, the Theory page renders a test formula, site is live after pushing.

**Notes (2026-10-22):**
- Pages: one `index.html` per page (home, `neuron-lab/`, `network-lab/`, `brain-lab/`, `theory/`, `credits/`), listed in `src/ui/site.ts`. A new page needs an entry there, `<path>/index.html` and `src/pages/<name>.ts`.
- Shared parts come from `<!--slot:…-->` placeholders that a small plugin in `vite.config.ts` fills at build time (head tags, header, footer, theory, library table). Pages work without JavaScript.
- Theory: `docs/NOTES.md` is rendered at build time by `src/ui/theory-render.ts` (markdown-it + own `$…$`/`$$…$$` rules + KaTeX), so the browser loads KaTeX's CSS but no KaTeX JavaScript. `##`/`###` headings get stable ids: labs link to `theory/#<id>`. A test fails if any formula in NOTES.md is broken. In dev, editing NOTES.md reloads the page.
- Not used: `@vscode/markdown-it-katex`, because it pins KaTeX 0.16 while we use 0.19 (two KaTeX versions, CSS not matching the renderer).
- Dependencies: katex, markdown-it; dev: vite 8, vitest 5, typescript 7, @types/node (types for `vite.config.ts` and later `scripts/`). markdown-it and KaTeX bring their own types.
- `npm run typecheck` runs three checks: browser code + tests, Node code, and `src/models/` without browser or Node types (so no `console` there either). `src/models/_rule4-guard.ts` makes that check fail if such types ever leak in; this was tested.
- A9 checked: Node 24 runs `.ts` files directly, including `import type` and `.ts` imports. All relative imports end in `.ts`.
- For Step 3: colors are CSS variables (`--color-*` in `src/ui/styles.css`); `onThemeChange()` in `src/ui/theme.ts` tells plots to redraw. Measured contrast ≥ 5:1 in both themes.
- For Step 10: worker files need the "WebWorker" type library, which clashes with "DOM" in one check, so `src/workers/` will need its own tsconfig.
- Credits page: the library table is generated from `package.json`; data sources are added by hand.
- Checked: 23 tests, build, all 6 pages at 375 px without sideways scrolling, keyboard order with skip link, all production paths and fonts under `/neuro-lab/`.
- Live at https://nicklkkvc.github.io/neuro-lab/ (Pages source: GitHub Actions). Each push to `main` runs test → build → deploy in about 1 minute; a failing test stops the deploy. GitHub's auto-created README commit was merged in, not overwritten.

## [ ] Step 2: Numerical engine (ODE solvers)
- src/models/solvers.ts: Euler and RK4 integrators for systems of ODEs (state as an array).
- Must be efficient for large state arrays (later used for 300+ neurons at once).
- NOTES.md: explain both methods and why RK4 is more accurate (local/global error order).
- Tests on exponential decay dV/dt = −V/τ vs exact V₀·e^(−t/τ): halving dt halves Euler's error and reduces RK4's error by ~16×.
- Done when: tests pass.

# PART 2 — NEURON LAB

## [ ] Step 3: Leaky integrate-and-fire (LIF) page
- src/models/lif.ts using the solvers. Parameters: τ, R, V_rest, threshold, reset, refractory period.
- During the refractory period V is held at the reset value, and spike times are interpolated between time steps. Both are needed for the exact comparison with theory in Step 4.
- Neuron Lab page: sliders for all parameters and input current, live voltage plot updating while sliding, spike count and firing rate.
- Input options: constant current and step current (on from t=50 to t=150 ms).
- Reusable parts for every lab page: an "Assumptions & limits" box and a "How does this work?" link to the matching Theory section (CLAUDE.md rule 9).
- Done when: voltage rises, spikes and resets; below a certain current it never fires.

## [ ] Step 4: f-I curve + analytical validation
- f-I curve tab (firing rate vs input current).
- NOTES.md: derive the exact LIF interspike interval for a general reset value, T = t_ref + τ·ln((R·I − (V_reset − V_rest)) / (R·I − (θ − V_rest))). With reset to V_rest this becomes T = t_ref + τ·ln(R·I / (R·I − (θ − V_rest))). Also derive the rheobase I = (θ − V_rest)/R. The derivation assumes V is held at V_reset during t_ref (as built in Step 3).
- Plot simulated and analytical curves together; test they match within tolerance. Simulated spike times are interpolated (Step 3); without that, each interval would come out up to one dt too long. Choose the tolerance with dt in mind.
- Done when: both curves overlap.

## [ ] Step 5: Izhikevich model
- v' = 0.04v² + 5v + 140 − u + I, u' = a(bv − u); when v ≥ 30 mV: v ← c, u ← u + d.
- Presets (Izhikevich 2003): Regular Spiking (0.02, 0.2, −65, 8), Intrinsically Bursting (0.02, 0.2, −55, 4), Chattering (0.02, 0.2, −50, 2), Fast Spiking (0.1, 0.2, −65, 2).
- Plot v and u. NOTES.md: what u represents and why 4 parameters create such different behaviors.
- Done when: each preset visibly matches its name.

## [ ] Step 6: Hodgkin-Huxley
- Classic HH model (squid axon parameters, resting ≈ −65 mV convention), gates m, h, n with α/β rate functions, RK4 with small dt (~0.01 ms).
- Three stacked plots: voltage; gates m, h, n; Na⁺ and K⁺ currents.
- Checkboxes: "Block Na⁺ (TTX)", "Block K⁺ (TEA)" with explanations.
- Refractory experiment: two current pulses with adjustable gap and adjustable strength of the second pulse. Shows the absolute refractory period (no pulse can trigger a spike) vs the relative one (only a stronger pulse can).
- Solver switch: Euler/RK4 dropdown and dt slider, to watch Euler become inaccurate and break down at a smaller dt than RK4 (connects to Step 2). Extra, not part of "Done when".
- NOTES.md: Nernst equation, origin of E_Na and E_K, how gate timing creates the action potential.
- Vitest tests for the "Done when" criteria below (peak, rest, TTX, refractory behavior).
- Done when: spike peaks around +40 mV, rests around −65 mV, TTX abolishes spikes, a too-early second pulse fails while a stronger one fires in the relative refractory period; all checked by tests.

## [ ] Step 7: Synapses & two neurons
- src/models/synapse.ts: conductance-based, exponentially decaying synapse with reversal potential (0 mV excitatory, −80 mV inhibitory) and delay. Must be general (reused for the worm connectome in step 17). It works with any neuron model and has two release modes: spike-triggered (for spiking neurons) and graded (release depends smoothly on the presynaptic voltage, for the non-spiking worm model in Step 17).
- "Two Neurons" mode: A (driven by input) → B. Toggle excitatory/inhibitory, sliders for strength and delay.
- Half-center oscillator: two mutually inhibiting neurons that alternate firing. Plain LIF neurons usually don't alternate (one wins and fires forever), so use neurons with adaptation: an adaptive LIF (one extra variable that grows with each spike and slowly decays) or Izhikevich neurons (u acts as adaptation). NOTES.md: central pattern generators, and why alternation needs adaptation, synaptic fatigue or post-inhibitory rebound (Wang & Rinzel 1992).
- Done when: excitatory synapse makes B fire after A; the oscillator alternates.

# PART 3 — NETWORK LAB

## [ ] Step 8: Matrix library
- src/models/linalg.ts: Matrix class on Float64Array — multiply, transpose, add, elementwise ops. Float64 because Float32's rounding error (~1e-7) would make the gradient check in Step 10 fail; Float32 is only used to store exported weights (Step 11).
- Tests against hand-computed examples. NOTES.md: matrix multiplication as "each output neuron takes a weighted sum of all inputs".
- Done when: tests pass.

## [ ] Step 9: Perceptron + 2D playground
- Datasets: AND, OR, XOR, circles, spirals.
- Perceptron with "Train" and "Step" buttons, decision-boundary heatmap.
- Show the perceptron failing on XOR; NOTES.md: linear separability.
- Done when: the XOR failure is clearly visible and explained.

## [ ] Step 10: Multi-layer network + backpropagation
- src/models/mlp.ts: configurable layers, activations (sigmoid, tanh, ReLU), softmax + cross-entropy, mini-batch gradient descent.
- NOTES.md: derive backpropagation with the chain rule step by step.
- Gradient-check test (in Float64, see Step 8): backprop vs numerical gradient (f(w+h) − f(w−h)) / 2h.
- Playground: choose layers/neurons, live loss curve, boundary heatmap updating during training (Web Worker).
- Done when: gradient check passes (relative error < ~1e-5), XOR and spirals get solved.

## [ ] Step 11: MNIST training
- scripts/train-mnist.ts (Node) reusing src/models/mlp.ts. Network ~784 → 128 → 10. If you cannot download MNIST, tell me exactly which files to put in data/.
- Report test accuracy; export trained weights compactly (as Float32) to public/models/.
- In-browser "train it yourself" demo on a small subset (~2,000 images) in a Web Worker with live accuracy.
- Done when: ~97% test accuracy, weights load in the browser.

## [ ] Step 12: Drawing canvas
- User draws a digit. Preprocess like MNIST: crop to bounding box, scale to fit 20×20 keeping aspect ratio, center by center of mass in 28×28, normalize.
- Show processed 28×28 image, prediction, probability bars 0–9.
- Done when: the user's handwriting is recognized most of the time.

## [ ] Step 13: Inside the network
- First-layer weights as 28×28 images (red positive, blue negative), hidden activations for the current drawing, misclassified-examples gallery.
- Section comparing rate-based artificial neurons with spiking neurons from Neuron Lab; NOTES.md: rate coding vs spike coding.
- Done when: it's clear what hidden neurons "look for".

# PART 4 — BRAIN LAB (C. elegans)

## [ ] Step 14: Connectome data
- scripts/build-connectome.ts: convert the C. elegans connectome (Varshney et al. 2011 dataset; if you can't download it, tell me exactly which file to get and from where) into public/data/celegans.json.
- Neurons: name, type (sensory/inter/motor), neurotransmitter if known. Chemical synapses (directed, synapse count). Gap junctions (undirected).
- Neurotransmitter identity is not part of the Varshney dataset: use a second published source (e.g. a recent C. elegans neurotransmitter atlas; check which is best), and cite it in NOTES.md and on the Credits page.
- Before counting, write the counting rules into NOTES.md. The WormAtlas file probably lists each chemical synapse from both sides (sender and receiver) and each gap junction twice, so naive counting doubles (verify when inspecting the file). Also, "connections" (neuron pairs) and "synapses" (synapse count per pair) are different numbers.
- Print summary stats and compare with numbers reported in the paper.
- Done when: counts match the published ones.

## [ ] Step 15: Connectome explorer
- Interactive force-directed graph (d3-force, canvas rendering). Color by neuron type, edge style by synapse type.
- Second layout option: layered "signal flow" view (sensory neurons at the top, interneurons in the middle, motor neurons at the bottom), similar in spirit to the figures in Varshney et al. 2011 (check how they computed it). A force layout of ~280 neurons and ~2,700 connections on its own is hard to read.
- Click a neuron → name, type, known function, inputs and outputs. Search, zoom, filters.
- Done when: clicking e.g. AVA shows its connections.

## [ ] Step 16: Network analysis
- src/models/graph.ts: in/out degree, top hubs, Dijkstra shortest path (highlighted on graph), clustering coefficient, sensory → motor path finder.
- Test algorithms on small hand-made graphs first. NOTES.md: explain each metric.
- Done when: path from touch neurons to motor neurons lights up.

## [ ] Step 17: Whole-worm simulation
- Main model: one graded (non-spiking) neuron per node. Most C. elegans neurons don't fire classical action potentials: they lack voltage-gated Na⁺ channels and use graded potentials (a few exceptions exist, e.g. AWA). Base it on published non-spiking worm models (e.g. Wicks et al. 1996, Kunert et al. 2014; check the details before implementing).
- Comparison mode "What if it spiked?": the same network with one LIF neuron per node.
- Gap junctions I = g·(V_j − V_i); chemical synapses via the step 7 synapse model (graded release in the main model, spike-triggered in LIF mode), sign from neurotransmitter (GABA → inhibitory, others excitatory by default), weight ∝ synapse count. The sign rule is crude: in C. elegans, glutamate and acetylcholine can also be inhibitory (via chloride channels), because the sign depends on the receptor.
- Runs in a Web Worker. Document every assumption in NOTES.md AND on the page.
- Display: neurons glow with their activity level (like calcium imaging), plus an activity heatmap (neurons × time); in LIF mode a raster plot (neurons × time).
- Done when: runs smoothly in both modes; data vs assumptions clearly separated.

## [ ] Step 18: Touch experiments
- Buttons "Touch head" (stimulate ALM, AVM) and "Touch tail" (stimulate PLML, PLMR).
- Show activity of AVA, AVD (backward) vs AVB, PVC (forward) and readout "predicted direction: forward/backward".
- Parameter panel (global synaptic scale, gap-junction scale) to explore which settings reproduce known biology. State on the page how sensitive results are to parameters.
- Done when: ideally head touch → backward, tail touch → forward; if not, document why.

## [ ] Step 19: Ablation lab
- Click neurons to remove them, rerun touch experiments, compare side by side with intact network.
- Preset ablations matching classic laser-ablation experiments where the literature is clear, with sources.
- Done when: ablation effects can be predicted and tested.

# PART 5 — EXTENSIONS & FINISHING

## [ ] Step 20: Fly brain sub-circuit (optional)
- Research how to legally access FlyWire connectome data (account, license). If feasible, extract one small, well-documented sub-circuit and add explorer + simulation with the same engine.

## [ ] Step 21: Theory pages
- The Theory pages exist since Step 1 (built from docs/NOTES.md with KaTeX) and grow with every step. Now polish them: add diagrams, check that every lab links to its theory ("How does this work?"), add a glossary.

## [ ] Step 22: "Brains vs Networks" comparison page
- Compare worm simulation and MNIST network: neuron model, learning (evolution vs gradient descent), coding (graded potentials or spikes in the worm vs rates in the MNIST network), size, energy. Use live examples from the labs.

## [ ] Step 23: Polish & release
- Performance profiling, phone layout, accessibility, consistent design, error handling when data fails to load, README with screenshots, run all tests, deploy.
