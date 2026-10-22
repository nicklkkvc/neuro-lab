# Neuro Lab — Roadmap

When a step is finished, change its `[ ]` to `[x]` and add short notes under it: what was built and any decisions later steps need to know (see rule 3 in CLAUDE.md).

# PART 1 — FOUNDATION

## [ ] Step 1: Site skeleton
- Set up Vite + TypeScript project.
- Home page + navigation: Neuron Lab, Network Lab, Brain Lab, Theory.
- Dark/light theme, responsive layout that works on phones.
- GitHub Actions workflow deploying to GitHub Pages. Add Vitest.
- Done when: npm run dev works, navigation works on desktop and phone, site is live after pushing.

## [ ] Step 2: Numerical engine (ODE solvers)
- src/models/solvers.ts: Euler and RK4 integrators for systems of ODEs (state as an array).
- Must be efficient for large state arrays (later used for 300+ neurons at once).
- NOTES.md: explain both methods and why RK4 is more accurate (local/global error order).
- Tests on exponential decay dV/dt = −V/τ vs exact V₀·e^(−t/τ): halving dt halves Euler's error and reduces RK4's error by ~16×.
- Done when: tests pass.

# PART 2 — NEURON LAB

## [ ] Step 3: Leaky integrate-and-fire (LIF) page
- src/models/lif.ts using the solvers. Parameters: τ, R, V_rest, threshold, reset, refractory period.
- Neuron Lab page: sliders for all parameters and input current, live voltage plot updating while sliding, spike count and firing rate.
- Input options: constant current and step current (on from t=50 to t=150 ms).
- Done when: voltage rises, spikes and resets; below a certain current it never fires.

## [ ] Step 4: f-I curve + analytical validation
- f-I curve tab (firing rate vs input current).
- NOTES.md: derive the exact LIF interspike interval T = t_ref + τ·ln(R·I / (R·I − (θ − V_rest))) (reset to V_rest) and rheobase I = (θ − V_rest)/R.
- Plot simulated and analytical curves together; test they match within tolerance.
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
- Refractory experiment: two current pulses with adjustable gap.
- NOTES.md: Nernst equation, origin of E_Na and E_K, how gate timing creates the action potential.
- Done when: spike peaks around +40 mV, rests around −65 mV, TTX abolishes spikes, a too-early second pulse fails.

## [ ] Step 7: Synapses & two neurons
- src/models/synapse.ts: conductance-based, exponentially decaying synapse with reversal potential (0 mV excitatory, −80 mV inhibitory) and delay. Must be general (reused for the worm connectome in step 17).
- "Two Neurons" mode: A (driven by input) → B. Toggle excitatory/inhibitory, sliders for strength and delay.
- Half-center oscillator: two mutually inhibiting neurons that alternate firing. NOTES.md: central pattern generators.
- Done when: excitatory synapse makes B fire after A; the oscillator alternates.

# PART 3 — NETWORK LAB

## [ ] Step 8: Matrix library
- src/models/linalg.ts: Matrix class on Float32Array — multiply, transpose, add, elementwise ops.
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
- Gradient-check test: backprop vs numerical gradient (f(w+h) − f(w−h)) / 2h.
- Playground: choose layers/neurons, live loss curve, boundary heatmap updating during training (Web Worker).
- Done when: gradient check passes (relative error < ~1e-5), XOR and spirals get solved.

## [ ] Step 11: MNIST training
- scripts/train-mnist.ts (Node) reusing src/models/mlp.ts. Network ~784 → 128 → 10. If you cannot download MNIST, tell me exactly which files to put in data/.
- Report test accuracy; export trained weights compactly to public/models/.
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
- Print summary stats and compare with numbers reported in the paper.
- Done when: counts match the published ones.

## [ ] Step 15: Connectome explorer
- Interactive force-directed graph (d3-force, canvas rendering). Color by neuron type, edge style by synapse type.
- Click a neuron → name, type, known function, inputs and outputs. Search, zoom, filters.
- Done when: clicking e.g. AVA shows its connections.

## [ ] Step 16: Network analysis
- src/models/graph.ts: in/out degree, top hubs, Dijkstra shortest path (highlighted on graph), clustering coefficient, sensory → motor path finder.
- Test algorithms on small hand-made graphs first. NOTES.md: explain each metric.
- Done when: path from touch neurons to motor neurons lights up.

## [ ] Step 17: Whole-worm spiking simulation
- Web Worker: one LIF neuron per node; gap junctions I = g·(V_j − V_i); chemical synapses via the step 7 synapse model, sign from neurotransmitter (GABA → inhibitory, others excitatory by default), weight ∝ synapse count.
- Document every assumption in NOTES.md AND on the page.
- Animation: neurons glow when spiking, plus a raster plot (neurons × time).
- Done when: runs smoothly; data vs assumptions clearly separated.

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
- Turn docs/NOTES.md into Theory pages with KaTeX formulas and diagrams, link each lab to its theory ("How does this work?"), add a glossary.

## [ ] Step 22: "Brains vs Networks" comparison page
- Compare worm simulation and MNIST network: neuron model, learning (evolution vs gradient descent), coding (spikes vs rates), size, energy. Use live examples from the labs.

## [ ] Step 23: Polish & release
- Performance profiling, phone layout, accessibility, consistent design, error handling when data fails to load, README with screenshots, run all tests, deploy.
