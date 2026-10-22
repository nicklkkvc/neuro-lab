import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePath, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { fillSlots, footerHtml, headerHtml, headHtml, librariesTableHtml, type LibraryInfo } from './src/ui/layout.ts';
import { ALL_PAGES, SITE_BASE } from './src/ui/site.ts';
import { renderTheory, theoryTocHtml, type RenderedTheory } from './src/ui/theory-render.ts';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const notesFile = resolve(projectRoot, 'docs/NOTES.md');

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Name, version and license of every runtime library in package.json, read from node_modules. */
function readLibraries(): LibraryInfo[] {
  const projectPackage = readJson(resolve(projectRoot, 'package.json')) as { dependencies?: Record<string, string> };
  return Object.keys(projectPackage.dependencies ?? {})
    .sort()
    .map((name) => {
      const library = readJson(resolve(projectRoot, 'node_modules', name, 'package.json')) as {
        version: string;
        license?: string;
        homepage?: string;
      };
      return {
        name,
        version: library.version,
        license: library.license ?? 'see package',
        url: library.homepage ?? `https://www.npmjs.com/package/${name}`,
      };
    });
}

/**
 * Fills the <!--slot:name--> placeholders in every page's HTML: shared head tags, header with
 * navigation, footer, the rendered theory notes and the library table on the credits page.
 * This happens at build time (and on every page load in `npm run dev`), so pages work without
 * JavaScript and the Theory page needs no KaTeX code in the browser.
 */
function siteLayoutPlugin(): Plugin {
  return {
    name: 'neuro-lab-layout',
    transformIndexHtml: {
      // 'pre' = before Vite processes the HTML, so Vite still rewrites links we insert (e.g. the favicon).
      order: 'pre',
      handler(html, context) {
        // Folder of the page relative to the project root, e.g. "theory/" ("" for the home page).
        const pagePath = normalizePath(relative(projectRoot, context.filename)).replace(/index\.html$/, '');
        let theory: RenderedTheory | undefined;
        const getTheory = (): RenderedTheory => (theory ??= renderTheory(readFileSync(notesFile, 'utf8')));
        return fillSlots(html, {
          head: headHtml,
          header: () => headerHtml(pagePath),
          footer: () => footerHtml(pagePath),
          'theory-toc': () => theoryTocHtml(getTheory().sections),
          'theory-content': () => getTheory().html,
          libraries: () => librariesTableHtml(readLibraries()),
        });
      },
    },
    configureServer(server) {
      // NOTES.md isn't imported by any script, so tell the dev server to reload the page when it changes.
      server.watcher.add(notesFile);
      server.watcher.on('change', (file) => {
        if (normalizePath(file) === normalizePath(notesFile)) server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

export default defineConfig({
  // Design decision A1: the site lives at https://nicklkkvc.github.io/neuro-lab/
  base: SITE_BASE,
  plugins: [siteLayoutPlugin()],
  build: {
    rolldownOptions: {
      // Multi-page site: one HTML entry per page, e.g. { "theory": ".../theory/index.html" }.
      input: Object.fromEntries(
        ALL_PAGES.map((page) => [page.path === '' ? 'home' : page.path.slice(0, -1), resolve(projectRoot, page.path, 'index.html')]),
      ),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
