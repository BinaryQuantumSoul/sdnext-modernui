# ModernUI TypeScript Migration

## Summary

The `extensions-builtin/sdnext-modernui` JavaScript codebase has been fully migrated to TypeScript.
All original JavaScript source files under `javascript/` are preserved; the new TypeScript sources live in `src/` and compile to a single ESM bundle at `javascript/modernui.mjs`.

### Source modules

| File | Migrated from | Exports |
|------|--------------|---------|
| `src/globals.d.ts` | — (new) | global type declarations for SD.Next runtime |
| `src/state.ts` | — (new) | shared mutable state object |
| `src/utils.ts` | — (new) | `setStored`, `getStored` localStorage helpers |
| `src/color-hue.ts` | `javascript/color-hue.js` | `setUserColors` |
| `src/components.ts` | `javascript/components.js` + parts of `javascript/sdnext-modernui.js` | `initSplitComponents`, `restoreAccordionState`, `initAccordionComponents`, `initTabComponents`, `initButtonComponents`, `setupToolButtons`, `setupDropdowns`, `createButtonsForExtensions` |
| `src/templates.ts` | `javascript/sdnext-modernui.js` | `loadAllTemplates` |
| `src/portals.ts` | `javascript/sdnext-modernui.js` | `loadAllPortals` |
| `src/layout.ts` | `javascript/sdnext-modernui.js` | `setupAnimationEventListeners`, `trackAsideFocus`, `switchMobile`, `applyDefaultLayout`, `applyAutoHide`, `extraTweaks` |
| `src/styles.ts` | `javascript/sdnext-modernui.js` | `removeStyleAssets` |
| `src/options.ts` | `javascript/sdnext-modernui.js` | `uiuxOptionSettings` |
| `src/logger.ts` | `javascript/sdnext-modernui.js` | `setupLogger`, `largeErrorOverlay` |
| `src/contributors.ts` | `javascript/contributors.js` | `showContributors` |
| `src/observers.ts` | `javascript/observers.js` | `setupGenerateObservers`, `setupControlDynamicObservers` |
| `src/server-info.ts` | `javascript/server-info.js` | `initServerInfo` |
| `src/sdnext-modernui.ts` | `javascript/sdnext-modernui.js` | (entry — `onUiReady(mainUiUx)`) |

---

## Build Commands

| Command | Description |
|---------|-------------|
| `pnpm prod` | Production build: compile + lint. Outputs `javascript/modernui.mjs` + `.mjs.map`. |
| `pnpm dev` | Development mode: serve + watch + compile + lint. |
| `pnpm lint` | Run ESLint over `src/**/*.ts` only. |
| `pnpm ts` | Run `tsc --noEmit` typecheck (no output emitted). |

All commands must be run from `extensions-builtin/sdnext-modernui/`.

---

## Bundle Output

| File | Format | Description |
|------|--------|-------------|
| `javascript/modernui.mjs` | ESM | Compiled bundle (~70 KB) |
| `javascript/modernui.mjs.map` | Source map | Full source map for debugging |

Entry: `src/sdnext-modernui.ts`  
Build tool: `@vladmandic/build ^0.10.3` (wraps esbuild)

---

## Vendor: split.js Integration

- **Vendor file**: `src/vendor/split.js` — Split.js v1.6.5, untouched.
- **Type declarations**: `src/vendor/split.d.ts` — hand-authored type declarations for `Split`, `SplitOptions`, `SplitInstance`.
- **CJS compatibility**: `javascript/package.json` with `{"type": "commonjs"}` scopes the `javascript/` folder as CommonJS so that esbuild correctly handles the UMD/CJS module format of `split.js` when the root package has `"type": "module"`.
- **Import in TS**: `import Split from './vendor/split.js'` — bundled inline into `modernui.mjs`.

---

## Window Compatibility Hooks

The following `window.*` assignments are part of the allowed public API surface and must not be removed:

| Hook | Set in | Purpose |
|------|--------|---------|
| `window.waitForUiReady` | `src/sdnext-modernui.ts` | Async polling helper for external callers awaiting UI init |
| `window.getUICurrentTabContent` | `src/sdnext-modernui.ts` | Returns current active tab split element |
| `window.getSettingsTabs` | `src/sdnext-modernui.ts` | Returns all settings tab elements |
| `window.logger` | `src/sdnext-modernui.ts` (via `setupLogger`) | JS console log element reference |
| `window.toggleHide` | `src/server-info.ts` | Toggling hidden server-info sections from inline onclick handlers |

---

## TypeScript Configuration Authority

Two separate config files govern TypeScript in this package:

| Config | Used by | Authority |
|--------|---------|-----------|
| `tsconfig.json` | `tsc --noEmit` (`pnpm ts`) | Type-checking only; no emit |
| `.build.json` `typescript` section | `@vladmandic/build` (`pnpm prod` / `pnpm dev`) | Compile settings for esbuild bundling |

Settings in `tsconfig.json`:
- `moduleResolution: "bundler"`, `module: "es2022"`, `target: "es2022"`
- `lib: ["dom", "dom.iterable", "es2022"]`
- `allowJs: true`, `skipLibCheck: true`
- `noImplicitAny: false`, `noUnusedParameters: true`, `strictNullChecks: true`
- `noUnusedLocals: false`

---

## tsconfig.json and .build.json Delta List (vs. Kanvas reference)

### Adaptations (ModernUI-specific changes from Kanvas)

| Item | Kanvas value | ModernUI value |
|------|-------------|----------------|
| Build output file | `dist/kanvas.esm.js` | `javascript/modernui.mjs` |
| Serve: SSL keys | present | removed (HTTP-only) |
| Serve: `defaultFile` | present | removed |
| Build banner | Kanvas-specific text | `/*\n  SD.Next ModernUI — generated by @vladmandic/build\n*/\n` |
| `changelog` section | present | removed |
| `konva` dependency | present | removed |
| `tsconfig.json paths` | includes `konva` path alias | removed |
| `tsconfig.json lib` | `["dom", "es2022"]` | `["dom", "dom.iterable", "es2022"]` |
| `tsconfig.json ignoreDeprecations` | `"6.0"` | `"5.0"` (valid for TS 5.x) |

### Confirmed Non-Deltas (identical to Kanvas)

- `build.targets[0].platform: "node"`
- `external` module list
- All TypeScript strictness settings (`noImplicitAny`, `noUnusedParameters`, `strictNullChecks`, etc.)
- `watch.locations: ["src"]`
- `lint.locations: ["src/*.ts"]`
- `profiles.production: ["compile", "lint"]`
- `profiles.development: ["serve", "watch", "compile", "lint"]`

---

## Global Symbol Diff (before → after)

### Globals removed (previously leaked from unscoped JS)

All functions previously declared as `function foo()` at top level in `javascript/sdnext-modernui.js` (making them implicit globals) are now module-private in `src/sdnext-modernui.ts`.

### Globals intentionally retained (window assignments)

See the Window Compatibility Hooks table above.

---

## Dependency Drift Guard

All devDependencies are pinned to the same versions as `extensions-builtin/sdnext-kanvas/package.json` to prevent toolchain drift. When updating any devDependency in kanvas, apply the same update here.

Key pinned versions:
- `@vladmandic/build ^0.10.3`
- `typescript ^5.9.3`
- `esbuild ^0.27.4`
- `@types/node ^25.5.0`

`pnpm-lock.yaml` is committed and must be kept in sync. Run `pnpm install` after any `package.json` change.

---

## Deterministic Build Notes

- The build runner (`@vladmandic/build`) wraps esbuild with a fixed config from `.build.json`. Output is deterministic for a given source and dependency tree.
- Source map (`modernui.mjs.map`) is always generated in both production and development modes.
- The `javascript/` folder contains both compiled output (`modernui.mjs`, `modernui.mjs.map`) and the vendor `split.js`. Only the vendor file is hand-authored; the `*.mjs` files are generated and should not be manually edited.
