// HTML shared by every page (head tags, header with navigation, footer), as plain strings.
// vite.config.ts inserts these into each page's HTML at build time, so the navigation
// works even without JavaScript. No browser APIs here: this code runs in Node during the build.

import { NAV_PAGES, REPO_URL, SITE_BASE, THEME_STORAGE_KEY } from './site.ts';

/** Makes text safe to put inside HTML (so "<" is shown as "<" instead of starting a tag). */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Replaces every `<!--slot:name-->` in `html` with the output of `slots[name]()`.
 * A slot's function only runs if the slot appears, and its output is inserted literally
 * (with a plain string replacement, "$$" in the theory notes would turn into "$").
 */
export function fillSlots(html: string, slots: Readonly<Record<string, () => string>>): string {
  return html.replace(/<!--slot:([\w-]+)-->/g, (_marker, name: string) => {
    const content = slots[name];
    if (content === undefined) throw new Error(`Unknown slot "<!--slot:${name}-->" in page HTML`);
    return content();
  });
}

/** Extra tags for <head>. Vite turns "/favicon.svg" into "/neuro-lab/favicon.svg" by itself. */
export function headHtml(): string {
  return [
    '<meta name="color-scheme" content="light dark">',
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    // Runs before the page is drawn, so a stored theme choice shows without a flash of the wrong
    // colors. Storage can be blocked (private mode), hence the try/catch.
    `<script>try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}</script>`,
  ].join('\n    ');
}

/** Link to a page of this site; marked with aria-current="page" if it is the page being shown. */
function pageLink(path: string, text: string, currentPath: string, className?: string): string {
  const classAttribute = className === undefined ? '' : ` class="${className}"`;
  const currentAttribute = path === currentPath ? ' aria-current="page"' : '';
  return `<a${classAttribute} href="${SITE_BASE}${path}"${currentAttribute}>${escapeHtml(text)}</a>`;
}

// Icons are drawn with the current text color. aria-hidden: the button's label already says what it does.
const MOON_ICON =
  '<svg class="icon icon-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/></svg>';
const SUN_ICON =
  '<svg class="icon icon-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></svg>';

/** Skip link, site title, main navigation and theme button. `currentPath` is the page being built ("" = home). */
export function headerHtml(currentPath: string): string {
  const navItems = NAV_PAGES.map((page) => `<li>${pageLink(page.path, page.title, currentPath)}</li>`).join('');
  // The theme button starts hidden: it only works with JavaScript, and src/ui/theme.ts shows it.
  return `<a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="site-header__inner">
        ${pageLink('', 'Neuro Lab', currentPath, 'site-title')}
        <nav class="site-nav" aria-label="Main">
          <ul>${navItems}</ul>
        </nav>
        <button type="button" class="theme-toggle" data-theme-toggle aria-pressed="false" aria-label="Dark theme" title="Dark theme" hidden>${MOON_ICON}${SUN_ICON}</button>
      </div>
    </header>`;
}

export function footerHtml(currentPath: string): string {
  return `<footer class="site-footer">
      <div class="site-footer__inner">
        <p>Neuro Lab is a learning project. Its models are simplified, and every lab states its assumptions.</p>
        <p>${pageLink('credits/', 'Credits & licenses', currentPath)} · <a href="${REPO_URL}">Source code on GitHub</a></p>
      </div>
    </footer>`;
}

export interface LibraryInfo {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly url: string;
}

/** Table of the open-source libraries the website ships, for the credits page. */
export function librariesTableHtml(libraries: readonly LibraryInfo[]): string {
  const rows = libraries
    .map(
      (library) =>
        `<tr><td><a href="${escapeHtml(library.url)}">${escapeHtml(library.name)}</a></td>` +
        `<td>${escapeHtml(library.version)}</td><td>${escapeHtml(library.license)}</td></tr>`,
    )
    .join('');
  return `<table>
        <thead><tr><th scope="col">Library</th><th scope="col">Version</th><th scope="col">License</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
}
