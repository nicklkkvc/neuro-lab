// Neuron Lab page: the leaky integrate-and-fire neuron (Steps 3 and 4).
// All model math lives in src/models (CLAUDE.md rule 4); this file only builds the controls,
// runs the simulations and shows the results.
//
// Everything runs on the main thread, because nothing here is heavy (rule 8): the voltage trace
// is 3000 RK4 steps of one neuron (well under 1 ms), the simulated f-I curve is 41 neurons for
// 1 s (about 10 ms), and the f-I curve is only computed while its tab is shown.

import '../ui/common.ts';
import { compareWithExact, exactFiringRate, simulateFiringRates, type SimulatedRates } from '../models/fi-curve.ts';
import { constantCurrent, stepCurrent } from '../models/inputs.ts';
import {
  DEFAULT_LIF_PARAMETERS,
  rheobase,
  simulateLif,
  steadyStateVoltage,
  type LifParameters,
  type LifTrace,
} from '../models/lif.ts';
import { countSpikes, firingRate } from '../models/spikes.ts';
import { formatPercent, formatQuantity } from '../ui/format.ts';
import { createPlot } from '../ui/plot.ts';
import { createSlider, type Slider, type SliderOptions } from '../ui/slider.ts';
import { initTabs } from '../ui/tabs.ts';

const DURATION = 300; // ms of simulated time in the voltage trace
const DT = 0.1; // ms, time step for all simulations
const STEP_ON = 50; // ms, the step current switches on ...
const STEP_OFF = 150; // ms ... and off again
const FI_DURATION = 1000; // ms simulated per current for the f-I curve
const FI_SIMULATED_POINTS = 41; // simulated neurons (dots)
const FI_FORMULA_POINTS = 401; // points of the exact line; every 10th one is also simulated

type InputMode = 'step' | 'constant';
type SettingKey = keyof LifParameters | 'current';
type Settings = Record<SettingKey, number>;

const DEFAULT_SETTINGS: Settings = { ...DEFAULT_LIF_PARAMETERS, current: 2 }; // current in nA
const DEFAULT_MODE: InputMode = 'step';

interface SliderDefinition extends Omit<SliderOptions, 'id' | 'value'> {
  readonly key: SettingKey;
}

// The ranges keep V_reset (≤ −60 mV) below θ (≥ −58 mV), as the model requires (docs/NOTES.md).
const INPUT_SLIDERS: readonly SliderDefinition[] = [
  { key: 'current', labelHtml: 'Current <i>I</i>', unit: 'nA', min: -2, max: 5, step: 0.05, decimals: 2, hint: 'Strength of the injected current. Negative pulls the voltage down.' },
];

const MEMBRANE_SLIDERS: readonly SliderDefinition[] = [
  { key: 'tau', labelHtml: 'Time constant <i>τ</i>', unit: 'ms', min: 1, max: 50, step: 0.5, decimals: 1, hint: 'How fast the voltage follows the input (τ = R·C).' },
  { key: 'resistance', labelHtml: 'Resistance <i>R</i>', unit: 'MΩ', min: 1, max: 50, step: 0.5, decimals: 1, hint: 'How much a current shifts the voltage (R·I).' },
  { key: 'restPotential', labelHtml: 'Resting potential <i>V</i><sub>rest</sub>', unit: 'mV', min: -80, max: -55, step: 0.5, decimals: 1, hint: 'Where the voltage goes without input.' },
];

const SPIKE_SLIDERS: readonly SliderDefinition[] = [
  { key: 'threshold', labelHtml: 'Threshold <i>θ</i>', unit: 'mV', min: -58, max: -30, step: 0.5, decimals: 1, hint: 'Crossing this voltage fires a spike.' },
  { key: 'resetPotential', labelHtml: 'Reset <i>V</i><sub>reset</sub>', unit: 'mV', min: -90, max: -60, step: 0.5, decimals: 1, hint: 'The voltage right after a spike.' },
  { key: 'refractoryPeriod', labelHtml: 'Refractory period <i>t</i><sub>ref</sub>', unit: 'ms', min: 0, max: 20, step: 0.5, decimals: 1, hint: 'How long the voltage is held at the reset after a spike.' },
];

const settings: Settings = { ...DEFAULT_SETTINGS };
let mode: InputMode = DEFAULT_MODE;
let fiTabShown = false;
const sliders: Slider[] = [];
const sliderKeys: SettingKey[] = [];

function parameters(): LifParameters {
  const { current: _current, ...lif } = settings;
  return lif;
}

// ---------- Controls ----------

const form = document.querySelector<HTMLFormElement>('#lif-controls')!;
form.addEventListener('submit', (event) => event.preventDefault());

function addFieldset(legend: string, definitions: readonly SliderDefinition[], extra?: HTMLElement): void {
  const fieldset = document.createElement('fieldset');
  fieldset.innerHTML = `<legend>${legend}</legend>`;
  if (extra) fieldset.append(extra);
  for (const definition of definitions) {
    const slider = createSlider({ ...definition, id: `lif-${definition.key}`, value: settings[definition.key] }, (value) => {
      settings[definition.key] = value;
      scheduleUpdate();
    });
    sliders.push(slider);
    sliderKeys.push(definition.key);
    fieldset.append(slider.element);
  }
  form.append(fieldset);
}

const modeChoice = document.createElement('div');
modeChoice.className = 'radio-group';
modeChoice.innerHTML = `
  <label><input type="radio" name="lif-mode" value="step"> Step: on from ${STEP_ON} to ${STEP_OFF} ms</label>
  <label><input type="radio" name="lif-mode" value="constant"> Constant: on all the time</label>`;
const modeInputs = [...modeChoice.querySelectorAll<HTMLInputElement>('input')];
for (const radio of modeInputs) {
  radio.checked = radio.value === mode;
  radio.addEventListener('change', () => {
    mode = radio.value as InputMode;
    scheduleUpdate();
  });
}

addFieldset('Input current', INPUT_SLIDERS, modeChoice);
addFieldset('Membrane', MEMBRANE_SLIDERS);
addFieldset('Spiking', SPIKE_SLIDERS);

const resetButton = document.createElement('button');
resetButton.type = 'button';
resetButton.className = 'button';
resetButton.textContent = 'Reset to default values';
resetButton.addEventListener('click', () => {
  Object.assign(settings, DEFAULT_SETTINGS);
  mode = DEFAULT_MODE;
  sliders.forEach((slider, index) => slider.setValue(settings[sliderKeys[index]]));
  for (const radio of modeInputs) radio.checked = radio.value === mode;
  scheduleUpdate();
});
form.append(resetButton);

initTabs(document.querySelector<HTMLElement>('#lif [role="tablist"]')!, (panelId) => {
  fiTabShown = panelId === 'lif-panel-fi';
  scheduleUpdate();
});

// ---------- Voltage over time ----------

/** Voltage range (mV) that fits the trace for the current settings, so the plot doesn't jump. */
function voltageRange(): [number, number] {
  const p = parameters();
  const lowest = Math.min(p.resetPotential, p.restPotential, steadyStateVoltage(p, Math.min(settings.current, 0)));
  const highest = Math.max(p.threshold, p.restPotential);
  return [Math.floor(lowest / 5) * 5 - 5, Math.ceil(highest / 5) * 5 + 5];
}

const voltagePlot = createPlot(document.querySelector<HTMLElement>('#lif-voltage-plot')!, {
  xLabel: 'Time (ms)',
  yLabel: 'Voltage (mV)',
  series: [
    { label: 'V (mV)', colorVariable: '--color-plot-voltage', decimals: 2 },
    { label: 'Threshold θ', colorVariable: '--color-plot-threshold', width: 1.5, dash: [6, 4] },
    { label: 'Spike', colorVariable: '--color-plot-spike', pointsOnly: true },
  ],
  xRange: () => [0, DURATION],
  yRange: voltageRange,
  height: (width) => Math.round(Math.min(320, Math.max(220, width * 0.42))),
  syncKey: 'lif',
});

const currentPlot = createPlot(document.querySelector<HTMLElement>('#lif-current-plot')!, {
  xLabel: 'Time (ms)',
  yLabel: 'Current (nA)',
  series: [{ label: 'I (nA)', colorVariable: '--color-plot-input', decimals: 2 }],
  xRange: () => [0, DURATION],
  yRange: () => [Math.min(0, settings.current) - 0.5, Math.max(0, settings.current) + 0.5],
  height: () => 130,
  syncKey: 'lif',
});

const status = document.querySelector<HTMLElement>('#lif-status')!;
const readouts = document.querySelector<HTMLElement>('#lif-readouts')!;

function updateTrace(p: LifParameters): void {
  const current = mode === 'step' ? stepCurrent(settings.current, STEP_ON, STEP_OFF) : constantCurrent(settings.current);
  const trace: LifTrace = simulateLif(p, current, { duration: DURATION, dt: DT });

  // Spike markers: a dot at θ for the first of the two extra samples the trace adds at each spike.
  const spikeMarkers = trace.time.map((t, k) =>
    k + 1 < trace.time.length && trace.time[k + 1] === t && trace.voltage[k] === p.threshold ? p.threshold : null,
  );
  voltagePlot.setData(trace.time, [trace.voltage, trace.time.map(() => p.threshold), spikeMarkers]);
  currentPlot.setData(trace.time, [trace.current]);

  const [onFrom, onTo] = mode === 'step' ? [STEP_ON, STEP_OFF] : [0, DURATION];
  const spikesWhileOn = countSpikes(trace.spikeTimes, onFrom, onTo);
  const rate = firingRate(trace.spikeTimes, onFrom, onTo);
  const iRheo = rheobase(p);
  const vInfinity = steadyStateVoltage(p, settings.current);

  readouts.innerHTML = `
    <div><dt>Spikes in ${DURATION} ms</dt><dd>${trace.spikeTimes.length}</dd></div>
    <div><dt>Firing rate while the input is on</dt><dd>${formatQuantity(rate, 1, 'Hz')}</dd></div>
    <div><dt>Rheobase <i>I</i><sub>rheo</sub> = (θ − <i>V</i><sub>rest</sub>)/<i>R</i></dt><dd>${formatQuantity(iRheo, 2, 'nA')}</dd></div>
    <div><dt>Target voltage <i>V</i><sub>∞</sub> = <i>V</i><sub>rest</sub> + <i>R·I</i></dt><dd>${formatQuantity(vInfinity, 1, 'mV')}</dd></div>`;

  const iText = formatQuantity(settings.current, 2, 'nA');
  const rheoText = formatQuantity(iRheo, 2, 'nA');
  if (settings.current <= iRheo) {
    status.textContent = `${iText} is not above the rheobase (${rheoText}): the voltage can only approach ${formatQuantity(vInfinity, 1, 'mV')}, which is not above the threshold (${formatQuantity(p.threshold, 1, 'mV')}), so the neuron never fires.`;
  } else if (spikesWhileOn === 0) {
    status.textContent = `${iText} is above the rheobase (${rheoText}), but the input is switched off before the voltage reaches the threshold.`;
  } else {
    status.textContent = `${iText} is above the rheobase (${rheoText}): the voltage heads for ${formatQuantity(vInfinity, 1, 'mV')}, above the threshold, so the neuron fires.`;
  }
}

// ---------- f-I curve ----------

/**
 * Current range (nA) of the f-I plot: from 0 (or a bit below the rheobase, if that is negative)
 * to 4 "rheobase units" above it, so the curve's start and its flattening are both visible.
 */
function fiCurrentRange(p: LifParameters): [number, number] {
  const iRheo = rheobase(p);
  const scale = Math.max(Math.abs(iRheo), 1); // nA
  return [Math.min(0, iRheo - 0.5 * scale), iRheo + 4 * scale];
}

// The simulated dots only depend on the model parameters, not on the current slider, so they are
// kept until a parameter changes.
let fiSimulation: { key: string; grid: number[]; simulated: SimulatedRates } | undefined;
let fiRateMax = 100; // Hz, top of the y axis

const fiPlot = createPlot(document.querySelector<HTMLElement>('#lif-fi-plot')!, {
  xLabel: 'Current (nA)',
  xDecimals: 2,
  yLabel: 'Firing rate (Hz)',
  series: [
    { label: 'Formula (Hz)', colorVariable: '--color-plot-voltage', decimals: 2 },
    { label: 'Simulated (Hz)', colorVariable: '--color-plot-input', pointsOnly: true, decimals: 2 },
    { label: 'Your current', colorVariable: '--color-plot-spike', pointsOnly: true, pointSize: 12, decimals: 2 },
  ],
  xRange: () => fiCurrentRange(parameters()),
  yRange: () => [0, fiRateMax],
  height: (width) => Math.round(Math.min(380, Math.max(240, width * 0.5))),
});

const fiStatus = document.querySelector<HTMLElement>('#lif-fi-status')!;
const fiReadouts = document.querySelector<HTMLElement>('#lif-fi-readouts')!;

function updateFiCurve(p: LifParameters): void {
  const key = JSON.stringify(p);
  if (fiSimulation?.key !== key) {
    const [low, high] = fiCurrentRange(p);
    const grid = Array.from({ length: FI_FORMULA_POINTS }, (_, i) => low + ((high - low) * i) / (FI_FORMULA_POINTS - 1));
    const step = (FI_FORMULA_POINTS - 1) / (FI_SIMULATED_POINTS - 1); // every 10th grid point is simulated
    const simulatedCurrents = Array.from({ length: FI_SIMULATED_POINTS }, (_, i) => grid[i * step]);
    fiSimulation = { key, grid, simulated: simulateFiringRates(p, simulatedCurrents, { duration: FI_DURATION, dt: DT }) };
  }
  const { grid, simulated } = fiSimulation;
  const step = (FI_FORMULA_POINTS - 1) / (FI_SIMULATED_POINTS - 1);

  // Columns for the plot: the exact line everywhere, simulated dots on every 10th point, and one
  // extra x value for the current set with the slider (the large dot).
  const x: number[] = [];
  const formula: number[] = [];
  const dots: (number | null)[] = [];
  const marker: (number | null)[] = [];
  const yourCurrent = settings.current;
  let markerAdded = yourCurrent < grid[0] || yourCurrent > grid[grid.length - 1];
  grid.forEach((current, i) => {
    if (!markerAdded && yourCurrent <= current) {
      x.push(yourCurrent);
      formula.push(exactFiringRate(p, yourCurrent));
      dots.push(null);
      marker.push(exactFiringRate(p, yourCurrent));
      markerAdded = true;
    }
    x.push(current);
    formula.push(exactFiringRate(p, current));
    dots.push(i % step === 0 ? simulated.rates[i / step] : null);
    marker.push(null);
  });
  fiRateMax = Math.max(10, Math.ceil((Math.max(...formula) * 1.1) / 10) * 10);
  fiPlot.setData(x, [formula, dots, marker]);

  const comparison = compareWithExact(p, grid.filter((_, i) => i % step === 0), simulated);
  const iRheo = rheobase(p);
  const maxRate = p.refractoryPeriod > 0 ? formatQuantity(1000 / p.refractoryPeriod, 0, 'Hz') : 'no limit';
  fiReadouts.innerHTML = `
    <div><dt>Rheobase <i>I</i><sub>rheo</sub>: the curve starts here</dt><dd>${formatQuantity(iRheo, 2, 'nA')}</dd></div>
    <div><dt>Rate at <i>I</i> = ${formatQuantity(yourCurrent, 2, 'nA')} (formula)</dt><dd>${formatQuantity(exactFiringRate(p, yourCurrent), 1, 'Hz')}</dd></div>
    <div><dt>Upper limit 1/<i>t</i><sub>ref</sub> for huge currents</dt><dd>${maxRate}</dd></div>
    <div><dt>Largest difference simulation ↔ formula</dt><dd>${formatPercent(comparison.largestRelativeDifference)}</dd></div>`;

  if (!Number.isFinite(comparison.largestRelativeDifference)) {
    fiStatus.textContent = 'Simulation and formula disagree: a neuron fired although the formula says it never does.';
    return;
  }
  const tooSlow =
    comparison.tooSlowPoints > 0
      ? ` ${comparison.tooSlowPoints} ${comparison.tooSlowPoints === 1 ? 'current' : 'currents'} just above the rheobase fire too slowly to measure within ${FI_DURATION / 1000} s.`
      : '';
  fiStatus.textContent = `Simulation (dots) and formula (line) agree: over ${comparison.measuredPoints} measured currents, the largest difference is ${formatPercent(comparison.largestRelativeDifference)}.${tooSlow}`;
}

// ---------- Updating ----------

function update(): void {
  const p = parameters();
  try {
    updateTrace(p);
    if (fiTabShown) updateFiCurve(p);
  } catch (error) {
    for (const element of [status, fiStatus]) {
      element.textContent = `These settings can't be simulated: ${(error as Error).message}`;
      element.classList.add('lab__status--error');
    }
    return;
  }
  for (const element of [status, fiStatus]) element.classList.remove('lab__status--error');
}

// A dragged slider sends many events; all events that arrive before the next turn of the event
// loop share one simulation. (setTimeout rather than requestAnimationFrame: the latter pauses
// whenever the page isn't being drawn, which would leave the results out of date.)
let updateScheduled = false;
function scheduleUpdate(): void {
  if (updateScheduled) return;
  updateScheduled = true;
  setTimeout(() => {
    updateScheduled = false;
    update();
  }, 0);
}

update();
