# Phase 6 Part B — Harmonization Lab

## Scope

Implemented the Harmonization Lab only. The parent application shell, routing, header, global state, API client, shared types, data adapters, package files, backend, and Git history were not modified. Parent wiring remains intentionally out of scope.

The lab is a seven-stage educational and methodological workflow:

1. Source data ingestion
2. Spatial alignment
3. Temporal alignment
4. Sensor metadata preservation
5. Calibration
6. Uncertainty assessment
7. Independent validation

Every stage exposes its input, processing concept, expected output, assumptions, limitations, evidence/source distinction, and an explicit status label: Implemented, Conceptual, or Planned.

## Scientific boundaries applied

- Real mode makes only read-only `getMetadata('/api/v1/methodology')` and `getMetadata('/api/v1/sensors')` calls.
- Demo mode makes no backend request and is labeled as explanatory content; it does not present backend request results or actual ingestion.
- The UI surfaces backend methodology `version` and `harmonization_status`; it does not synthesize or infer those values.
- The supplied inputs report `uncalibrated_raw`. The lab does not use the backend harmonizer fallback numbers, `is_validated` metadata, or any arbitrary normalization.
- No `POST /api/v1/analyze`, `mode=harmonized`, calibrated estimate, harmonized index, uncertainty interval, validation score, or simulated pipeline output is produced.
- MODIS native numeric confidence and VIIRS categorical confidence remain separate.
- MODIS nominal ~1 km and VIIRS nominal ~375 m resolution differences are stated without conversion.
- Spatial and temporal alignment are explicitly described as unable to remove sensor bias.
- Missing/unobserved is not shown as zero; hotspots are described as satellite thermal anomaly records, not confirmed fires; NRT limitations remain visible.

## UI behavior

The new component provides:

- Native-button keyboard-accessible stage selector with selected-stage state.
- Source metadata table and methodology panel with accessible headings, labels, captions, and unavailable-value handling.
- Prominent scientific disclaimer and status distinction on every stage.
- Assumption checklist covering native confidence semantics, resolution, missingness, NRT, hotspot interpretation, and sensor bias.
- Responsive scoped styling using the existing dark scientific visual language, amber/cyan accents, Space Grotesk headings, and DM Sans body text.
- Real-mode loading, cancellation, stale-response protection, error, and retry behavior.
- Research handoff form with methodology selection, current stage name, and user note passed to `onResearch(notes)`. The parent may append the global source/filter snapshot.
- No viewport reset or header coverage; the root remains `workspace-page lab-page` and inherits the existing workspace offsets.

## Verification

### Passed

- Focused command: `npm test -- --test-name-pattern=Harmonization`
- Result: **48 passed, 0 failed** (the command includes the existing test files plus the five focused Harmonization assertions because of the project glob).
- Isolated strict type-check for the new component/model with `src/vite-env.d.ts`: **passed**.
- UTF-8 scan of all new source, style, and test files: no replacement characters found.

### Full build limitation

`npm run build` was attempted. It remains blocked by a pre-existing TypeScript error outside the authorized write scope:

- `src/features/research/model.ts:116:33`
- `src/features/research/model.ts:117:33`
- `unknown` values are passed where `string` is required.

The Harmonization Lab files were not changed to work around this unrelated error. The focused strict check for the new files passes.

No browser or server was started, per the implementation constraints.

## Authorized files written

- `Hotspot-hunters/src/features/harmonization/HarmonizationLab.tsx`
- `Hotspot-hunters/src/features/harmonization/model.ts`
- `Hotspot-hunters/src/styles/harmonization.css`
- `Hotspot-hunters/tests/harmonization.test.ts`
- `outputs/phase-reports/phase-6-lab.md`

## Remaining limitation

The component is intentionally not wired into `App.tsx` or navigation. The parent agent must provide the route/view wiring and pass `dataMode` and `onResearch`, while preserving the existing global source/filter snapshot behavior.

## Parent unified integration verification

Part A/B كلاهما موصول الآن بـApp وFeatureMenu وglobal dataMode؛ onResearch ينقل selected-stage notes ومعها snapshot المصدر والفلاتر إلى Research. خطأ research/model.ts المذكور أعلاه كان أثناء كتابة الجزء الآخر بالتوازي، وليس خطأ قائمًا في النسخة النهائية؛ بُنيت النسخة الموحدة بنجاح بـ`tsc -b && vite build` في 6.07s. إجمالي الاختبارات الحالي 52 ناجحة. `research-lab-browser.mjs` Chrome: 17/17 فحصًا ناجحًا بصفر page errors؛ منها المختبر 7 مراحل، demo لا يطلب metadata، actual methodology/sensors يقدمان raw status/table بمستشعرين عبر GET فقط، calibration Planned، handoff Arabic note/source إلى Research، وأحجام 768/390/320 و844×390 scrollable ومحصورة أفقيًا. الأدلة `.work/phases/phase6`. لا harmonized analysis request أو fake fitted output.
