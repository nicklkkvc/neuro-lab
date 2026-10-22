// An accessible slider with label, current value and a short hint, reused by every lab.
// Screen readers announce the value with its unit (aria-valuetext), e.g. "10.0 ms".

import { formatQuantity } from './format.ts';

export interface SliderOptions {
  /** Unique id; also used for the label and hint. */
  readonly id: string;
  /** Label as HTML (our own constant text, may contain <sub>/<i>), e.g. "Threshold <i>θ</i>". */
  readonly labelHtml: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  /** Decimals shown for the value. */
  readonly decimals: number;
  /** One short sentence explaining what the parameter does. */
  readonly hint: string;
}

export interface Slider {
  readonly element: HTMLElement;
  /** Current value as a number. */
  readonly value: number;
  /** Sets the value without triggering the change callback. */
  setValue(value: number): void;
}

export function createSlider(options: SliderOptions, onInput: (value: number) => void): Slider {
  const { id, labelHtml, unit, min, max, step, value, decimals, hint } = options;

  const element = document.createElement('div');
  element.className = 'slider';
  element.innerHTML = `
    <div class="slider__top">
      <label for="${id}">${labelHtml}</label>
      <output id="${id}-value" for="${id}"></output>
    </div>
    <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" aria-describedby="${id}-hint">
    <p class="slider__hint" id="${id}-hint"></p>`;

  const input = element.querySelector<HTMLInputElement>('input')!;
  const output = element.querySelector<HTMLOutputElement>('output')!;
  element.querySelector('.slider__hint')!.textContent = hint;

  function show(current: number): void {
    const text = formatQuantity(current, decimals, unit);
    output.textContent = text;
    input.setAttribute('aria-valuetext', text);
  }

  input.value = String(value);
  show(value);
  input.addEventListener('input', () => {
    const current = input.valueAsNumber;
    show(current);
    onInput(current);
  });

  return {
    element,
    get value() {
      return input.valueAsNumber;
    },
    setValue(newValue: number) {
      input.value = String(newValue);
      show(input.valueAsNumber);
    },
  };
}
