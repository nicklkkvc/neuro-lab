// Time-series plots built on uPlot, reused by every lab.
// - Colors come from the CSS design tokens, and the plot is rebuilt when the theme changes.
// - The width follows the container (phones included); the height can depend on the width.
// - Fixed axis ranges keep the plot from jumping around while a slider moves.

import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { formatNumber } from './format.ts';
import { onThemeChange } from './theme.ts';

export interface PlotSeries {
  /** Legend text, e.g. "V (mV)". */
  readonly label: string;
  /** CSS variable holding the color, e.g. "--color-plot-voltage". */
  readonly colorVariable: string;
  readonly width?: number;
  /** Dash pattern in px, e.g. [6, 4]. */
  readonly dash?: number[];
  /** Draw only dots at non-empty values (for spike markers), no line. */
  readonly pointsOnly?: boolean;
  /** Decimals for the value shown in the legend. */
  readonly decimals?: number;
}

export interface TimePlotOptions {
  readonly xLabel: string;
  readonly yLabel: string;
  readonly series: readonly PlotSeries[];
  readonly xRange: () => [number, number];
  readonly yRange: () => [number, number];
  /** Plot height (px) for a given width, so phones get a lower plot. */
  readonly height: (width: number) => number;
  /** Plots with the same key share the cursor position. */
  readonly syncKey?: string;
}

export interface TimePlot {
  /** Replaces the data: x values and one array per series (null = no value at that x). */
  setData(x: ArrayLike<number>, ys: ReadonlyArray<ArrayLike<number | null>>): void;
}

function cssVariable(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function buildOptions(options: TimePlotOptions, width: number): uPlot.Options {
  const font = `12px ${getComputedStyle(document.body).fontFamily}`;
  const gridColor = cssVariable('--color-plot-grid');
  const axis = (label: string): uPlot.Axis => ({
    label,
    stroke: cssVariable('--color-muted'),
    font,
    labelFont: font,
    grid: { stroke: gridColor, width: 1 },
    ticks: { stroke: gridColor, width: 1 },
  });

  const series: uPlot.Series[] = options.series.map((line) => {
    const color = cssVariable(line.colorVariable);
    const value = (_plot: uPlot, raw: number | null) => formatNumber(raw, line.decimals ?? 1);
    if (line.pointsOnly) {
      return { label: line.label, stroke: color, paths: () => null, points: { show: true, space: 0, size: 7, fill: color, stroke: color }, value };
    }
    return { label: line.label, stroke: color, width: line.width ?? 2, dash: line.dash, points: { show: false }, value };
  });

  return {
    width,
    height: options.height(width),
    scales: {
      x: { time: false, range: () => options.xRange() },
      y: { range: () => options.yRange() },
    },
    axes: [axis(options.xLabel), { ...axis(options.yLabel), size: 56 }],
    series: [{ label: options.xLabel, value: (_plot, raw) => formatNumber(raw, 1) }, ...series],
    // Dragging would zoom in; with sliders next to the plot that is more confusing than useful.
    cursor: { sync: options.syncKey === undefined ? undefined : { key: options.syncKey }, drag: { x: false, y: false, setScale: false } },
    legend: { live: true },
  };
}

export function createTimePlot(container: HTMLElement, options: TimePlotOptions): TimePlot {
  let data: uPlot.AlignedData = [[], ...options.series.map(() => [])];
  const width = () => Math.max(240, container.clientWidth);
  let plot = new uPlot(buildOptions(options, width()), data, container);

  // Follow the container's width (window resized, phone rotated).
  let lastWidth = width();
  new ResizeObserver(() => {
    const newWidth = width();
    if (newWidth === lastWidth) return;
    lastWidth = newWidth;
    plot.setSize({ width: newWidth, height: options.height(newWidth) });
  }).observe(container);

  // uPlot draws on a canvas with fixed colors, so a theme change needs a fresh plot.
  onThemeChange(() => {
    plot.destroy();
    plot = new uPlot(buildOptions(options, width()), data, container);
  });

  return {
    setData(x, ys) {
      data = [x, ...ys] as uPlot.AlignedData;
      plot.setData(data);
    },
  };
}
