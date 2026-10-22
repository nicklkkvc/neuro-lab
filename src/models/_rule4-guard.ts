// Guard for CLAUDE.md rule 4 (no browser or Node APIs in model code).
// Only `tsc -p src/models/tsconfig.json` (part of `npm run typecheck`) reads this file; nothing imports it.
// Each marked line MUST be a type error. If browser or Node types ever leaked into the models
// check, the line would compile, its @ts-expect-error would be unused, and the type check fails.

// @ts-expect-error `document` belongs to the browser and must not exist in model code.
document;

// @ts-expect-error `process` belongs to Node.js and must not exist in model code.
process;

export {};
