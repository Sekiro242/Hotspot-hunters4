# Phase 6 Part A - Research Workspace

## Scope

Implemented Research Workspace only. Parent `App`/global wiring, backend code, package configuration, Git state, and the existing plain-local/no-upload paths were left untouched. The component is ready for parent-owned navigation and selection wiring through its typed callbacks.

## Files added

- `Hotspot-hunters/src/features/research/model.ts`
- `Hotspot-hunters/src/features/research/ResearchWorkspace.tsx`
- `Hotspot-hunters/src/styles/research.css`
- `Hotspot-hunters/tests/research.test.ts`

## Functionality delivered

- Strict `ResearchSelection` and `ResearchConfig` types with `version: 1`.
- Runtime validation for schema/version, bounded strings, canonical ISO dates/timestamps, date ordering, supported regions, one-or-two unique sensors, source mode, native explorer filter values and numeric ranges, comparison mode, split bounds, globe setting, and map layer.
- Local browser persistence under the fixed namespaced key `hotspot-hunters.research-configs.v1`.
- Injectable storage adapter with guarded blocked-storage, malformed-payload, invalid-entry, and quota/full-storage errors. Corrupt existing payloads are not overwritten by save/delete operations.
- Local create, reopen, edit, duplicate, and delete workflows. Duplicate studies receive a new ID and fresh timestamps while preserving selection, native filters, comparison settings, description, and notes.
- Parent snapshot/apply workflow. Applying is explicit; reopening or importing never overwrites the parent automatically.
- Methodology-note prefill/appending without replacing notes in a currently edited saved study.
- Portable share URL helpers: `createShareUrl`, `parseSharedConfig`, and `parseSharedConfigDetailed`. Snapshots include the validated config rather than an ID-only lookup, encode Unicode safely, enforce HTTP(S) base URLs, reject `javascript:` URLs, enforce payload limits, and report validation/length errors.
- Shared URL snapshots load as unsaved imported drafts. The UI warns that notes are present in the public link; there is no automatic network post, send, auth, or sharing service.
- Accessible labeled form controls, field/error states, status messages, native MODIS/VIIRS confidence distinction, local-storage disclosure, connected Analytics/Data Explorer/Lab callbacks, and responsive cards/list styling.
- No research result, certification, calibrated index, or harmonized observation claim. Native confidence and provenance remain separate.

## Verification

- `npm test`: **52 passed, 0 failed**.
- `npm run build`: **passed** (`tsc -b` and Vite production build).
- Research tests cover Unicode round-trip, invalid dates and cross-field ranges, invalid region/layer/split/source/filter values, full local CRUD, edit timestamps, duplicate IDs/timestamps/detail preservation, malformed/corrupt storage preservation, blocked/quota storage, share round-trip, malformed share payloads, URL security, methodology-note behavior, and native filter/source preservation.
- Static scope check found no `innerHTML`, `dangerouslySetInnerHTML`, `fetch`, or viewport `top`/`bottom`/`left`/`right`/`position` rules in the new research component/style files. The root `.workspace-page.research-page` therefore inherits the existing workspace viewport offsets and does not cover the header, toolbar, or timeline.

## Actual versus conceptual

**Implemented:** local research recipe management, validated snapshot/share encoding, explicit parent apply/snapshot actions, and local browser persistence.

**Conceptual/not implemented:** server persistence, accounts, cross-user sharing, automatic link posting, harmonization algorithms, calibrated indexes, scientific certification, or research-result computation. A config records selections and methodology notes only.

## Integration limitation

Per the requested ownership boundary, the parent has not yet wired `ResearchWorkspace` into `App`/scene navigation or imported the new stylesheet globally. Parent wiring should pass the current parent `ResearchSelection`, map/apply it back to existing global state, and connect `onLab`, `onAnalytics`, and `onData` to existing scenes. No browser/server run was performed because the request explicitly prohibited those operations.

## Parent integration and end-to-end gate

App يمرر ResearchSelection عالميًا؛ Apply يعيد region/dates/year/month/sensors/source/ExplorerFilters/comparison mode/split/globe/layer ويعرض Data Explorer للمعاينة. share URL يفتح Research draft مباشرة إذا hash يبدأ #research=، ولا يطبق selection أو يحفظها تلقائيًا. notes القادمة من Lab تُرفق بالdraft الجديد ولا تغير saved studies. Styles scoped ضمن workspace viewport.

`research-lab-browser.mjs` Chrome: 17/17 ناجحة بصفر page errors. Unicode Arabic title/notes محفوظة، source/native filters/comparison recipes، React escaping، create/duplicate/edit/reopen/delete selected entry only، share warning/link loaded في browser context مستقل كunsaved draft لا overwrite، explicit Apply يعيد global source/FRP/region/UTC، Lab actual GET metadata/handoff، و4 مقاسات لكل صفحة. production unified build ناجح6.07s والـunit suite52/52. الصور والأدلة `.work/phases/phase6`. كل persistence محلي فقط، وليس حسابات أو server research API.
