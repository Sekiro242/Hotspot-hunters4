# Phase 5 — Advanced Data Explorer

## Implementation scope

Implemented the Data Explorer under the requested owned paths:

- `src/features/data-explorer/model.ts` — typed `ExplorerFilters`, `defaultExplorerFilters`, native-scale filtering, stable missing-last sorting, and bounded client pagination.
- `src/features/data-explorer/export.ts` — client CSV and GeoJSON builders/download helpers with null preservation, spreadsheet formula-like text neutralization, byte-limit checks, safe fixed filenames, and object-URL cleanup.
- `src/features/data-explorer/DataExplorer.tsx` — controlled React 19 feature component exposing the requested props, loading/error/empty/partial states, shared parent callbacks, filters, table, details, focus-map actions, active chips, and exports.
- `src/styles/data-explorer.css` — feature-scoped responsive styling. It does not override `.workspace-page` positioning, `inset`, or global toolbar/header/timeline/source-control offsets.
- `tests/explorer.test.ts` — focused unit coverage for native confidence behavior, nulls, FRP/day-night/processing/search filtering, sorting, pagination edges, CSV escaping/formula neutralization, GeoJSON geometry/provenance, and all-filtered-record export scope.

The component is intentionally not wired into `App.tsx`, `Header.tsx`, or `useApplicationState.ts`; the parent owns navigation, loaded records, and persisted filters as requested.

## Data integrity and API boundary

The verified backend supports region/date/sensor/limit filtering but has no pagination, server sorting, search, FRP/native-confidence/day-night/processing filtering, or suitable source-product-preserving export. The explorer therefore labels the response as a loaded bounded subset and clearly labels search, local scientific filters, sorting, pagination, and exports as client-side operations over that subset. It never claims a full-dataset total or invents server pages. Export buttons include every currently filtered loaded record, not only the visible page, and include explicit source, selection, filter, partial, bounded-cap, and client `exportedAt` metadata in GeoJSON.

MODIS numeric confidence and VIIRS categorical confidence remain separate. MODIS thresholds affect only MODIS rows and VIIRS categories affect only VIIRS rows; records from the opposite sensor are not excluded by an inapplicable native filter. Missing scalar values render as `Unavailable`; exports retain nulls as `null` and do not fabricate zero values. Details preserve original metadata as escaped React text and include the no-confirmed-fire scientific warning.

CSV cells escape commas, quotes, and newlines. String values beginning with `=`, `+`, `-`, or `@` receive a documented apostrophe escape for spreadsheet safety; numeric negative scientific values are not rewritten. Download filenames are fixed safe constants, and object URLs are revoked after download.

## Verification

Focused tests passed: `npx tsx --test tests/explorer.test.ts` — 6/6 tests passed.

Production build passed: `npm run build` — strict `tsc -b` and Vite production output completed successfully. Vite emitted only the existing large-chunk advisory for the main application bundle; the explorer was emitted as its own CSS/JS chunk.

Browser/server/Git operations were intentionally not run for this delegated implementation, per the task restriction.

## Parent integration and gate evidence

App أصبح يمرر loaded records/status/source/range/global sensor-region selection؛ ExplorerFilters محفوظة في useApplicationState أثناء التنقل. focus callback يحافظ على فلاتر الجدول وينقل الخريطة للإحداثيات ويفتح original details ويضبط selected highlight layer على نفس ID، دون تغيير query filters. اختيار source/region/date يمسح selection القديم. Feature menu stacking فوق toolbar أُصلح بعد فشل browser حقيقي؛ لا force-click.

تصحيحات integrity بعد مراجعة implementation: confidenceLevel لم يعد بديلًا عن native VIIRS confidence المفقود؛ sorting للثقة يُجمع حسب المستشعر ولا يرتب scales غير متجانسة؛ invalid FRP وMODIS ranges تعرض error ولا تُتجاهل. CSV يحيّد formula strings حتى مع leading whitespace/control characters، الأرقام السالبة تبقى أصلية؛ GeoJSON boundedCap من config وليس record count. exports تُعطل أثناء deferred search أو export جارٍ، مع paint progress قبل serialization، وبحد 10MB صريح دون truncation. object URL يُزال بعد مرور وقت يسمح للـbrowser ببدء التنزيل. التفاصيل تُظهر metadata كنص escaped وتدعم focus/scroll/Escape/restore-focus. skeleton حقيقي أثناء loading، native time يُحفظ ويُنسق machine datetime فقط لـHHMM عند الحاجة.

`explorer-browser.mjs` على Chrome: **16/16 ناجحة، صفر page errors**. contract-derived 60 records؛ client pages 25 مع Next؛ semantic sorted header؛ FRP وnative filters؛ CSV downloaded يحتوي 60 وليس 25 مع null/unit/source؛ GeoJSON downloaded يحفظ lon/lat والmetadata والسياق؛ search/details/keyboard؛ map focus+selected layer ID؛ فلاتر محفوظة بعد العودة؛ 768×844 و390×844 و320×568 و844×390 بلا overflow أفقي للـdocument؛ empty real؛ HTTP503 safe retry بلا fallback أو leak. الأدلة في `.work/phases/phase5`. اختبارات integrity إضافية تحت tests/explorer-integrity.test.ts. تطبيق Phase5 المناظر مكرر في phases.txt لكنه نفس المطلب، ونُفذ مرة واحدة.

### إغلاق البوابة بعد المراجعة البصرية

مراجعة screenshot 320 كشفت أن responsive.css القديم يطبق height:41px على أي semantic header، فتداخل header الجدول مع caveat رغم عدم overflow أفقي. أُصلح selector ليخص `.app>header` فقط، ثم أُضيف bounding-box assertion بأن caveat يبدأ بعد feature-header. إعادة 16 فحص Chrome ناجحة بصفر errors؛ آخر production build 6.51s والـunit suite 43/43. بوابة Phase5 مجتازة بعد إصلاح هذا العيب، وليس قبل فحص الصورة. ملفات الباك لا تغيير فيها.
