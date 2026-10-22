# Neuro Lab

An educational, interactive website about neurons, neural networks and real brain connectomes, built step by step with the theory behind every model.

**Live site:** https://nicklkkvc.github.io/neuro-lab/

## Run it locally

Requires Node.js 24 or newer.

```bash
npm install
```

```bash
npm run dev
```

The development server then runs at http://localhost:5173/neuro-lab/ and reloads when files change.

| Command | What it does |
|---|---|
| `npm run dev` | Development server with live reload |
| `npm test` | Runs all tests once (`npm run test:watch` keeps watching) |
| `npm run typecheck` | Type-checks browser code, Node code and model code |
| `npm run build` | Type check, then build the finished site into `dist/` |
| `npm run preview` | Serves the built site from `dist/` |

Every push to `main` is tested, built and published to GitHub Pages by `.github/workflows/deploy.yml`.

## Project structure

| Path | Contents |
|---|---|
| `src/models/` | All math and simulations. No browser or Node APIs, so the same code runs in tests, Web Workers and Node scripts. |
| `src/ui/` | Shared website code: layout, theme, theory rendering, styles. |
| `src/pages/` | One script per page. |
| `index.html`, `<page>/index.html` | One HTML file per page; the folder name is the URL. |
| `public/` | Files served as they are (icon; later data and trained models). |
| `docs/ROADMAP.md` | The plan, step by step, with design decisions. |
| `docs/NOTES.md` | Theory notes; the website's Theory page is generated from them. |

## License

The code is under the MIT license (see `LICENSE`). Libraries and data sources are listed on the site's Credits page.
