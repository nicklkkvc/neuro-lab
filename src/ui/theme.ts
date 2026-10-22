// Light/dark theme. The small inline script from layout.ts has already applied a stored
// choice before the page was drawn; this file makes the theme button work.
// Without a stored choice, the system setting (prefers-color-scheme) decides, purely in CSS.

import { THEME_STORAGE_KEY } from './site.ts';

export type Theme = 'light' | 'dark';

const THEME_CHANGE_EVENT = 'neuro-lab:themechange';
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');

/** The theme currently shown: the user's choice if they made one, otherwise the system setting. */
export function currentTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === 'light' || chosen === 'dark') return chosen;
  return systemPrefersDark.matches ? 'dark' : 'light';
}

/**
 * Calls `callback` whenever the shown theme changes (button or system setting).
 * Plots and canvases use this (from Step 3 on) to redraw with the new colors.
 */
export function onThemeChange(callback: (theme: Theme) => void): void {
  window.addEventListener(THEME_CHANGE_EVENT, () => callback(currentTheme()));
}

function themeButtons(): NodeListOf<HTMLButtonElement> {
  return document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]');
}

/** aria-pressed="true" tells screen readers (and the CSS icon switch) that the dark theme is on. */
function updateButtons(): void {
  const isDark = currentTheme() === 'dark';
  for (const button of themeButtons()) button.setAttribute('aria-pressed', String(isDark));
}

function themeChanged(): void {
  updateButtons();
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked (e.g. private browsing): the theme still changes, it just isn't remembered.
  }
  themeChanged();
}

/** Shows the theme button(s) and makes them work. Called once per page by common.ts. */
export function initThemeToggle(): void {
  for (const button of themeButtons()) {
    button.hidden = false;
    button.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
  }
  // While the user hasn't picked a theme, follow changes of the system setting.
  systemPrefersDark.addEventListener('change', () => {
    if (document.documentElement.dataset.theme === undefined) themeChanged();
  });
  updateButtons();
}
