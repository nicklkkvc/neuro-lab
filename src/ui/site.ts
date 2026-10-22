// Site-wide settings, shared by the build (vite.config.ts) and the browser code.
// This file must stay free of browser and Node APIs because both sides import it.

/** URL path of the site on GitHub Pages: https://nicklkkvc.github.io/neuro-lab/ (design decision A1). */
export const SITE_BASE = '/neuro-lab/';

/** Public repository with the source code. */
export const REPO_URL = 'https://github.com/nicklkkvc/neuro-lab';

/** localStorage key for the theme the user picked with the theme button ("light" or "dark"). */
export const THEME_STORAGE_KEY = 'neuro-lab-theme';

export interface SitePage {
  /** Folder of the page's index.html relative to the project root; also its URL path ("" = home page). */
  readonly path: string;
  /** Name shown in the navigation. */
  readonly title: string;
}

/** Pages in the main navigation, in menu order. */
export const NAV_PAGES: readonly SitePage[] = [
  { path: 'neuron-lab/', title: 'Neuron Lab' },
  { path: 'network-lab/', title: 'Network Lab' },
  { path: 'brain-lab/', title: 'Brain Lab' },
  { path: 'theory/', title: 'Theory' },
];

/**
 * Every page of the site; vite.config.ts builds exactly these.
 * To add a page: add it here (and to NAV_PAGES if it belongs in the menu),
 * then create <path>/index.html with the same slots as the other pages.
 */
export const ALL_PAGES: readonly SitePage[] = [
  { path: '', title: 'Home' },
  ...NAV_PAGES,
  { path: 'credits/', title: 'Credits & licenses' },
];
