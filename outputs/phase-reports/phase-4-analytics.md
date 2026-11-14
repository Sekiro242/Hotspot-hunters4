# Phase 4 — Scientific Analytics Dashboard

**Status:** Implemented in the isolated Phase 4 scope. Parent wiring is intentionally not included.

## Files delivered

- `Hotspot-hunters/src/features/analytics/Analytics.tsx`
- `Hotspot-hunters/src/features/analytics/analyticsService.ts`
- `Hotspot-hunters/src/styles/analytics.css`
- `Hotspot-hunters/tests/analytics.test.ts`

No `App.tsx`, `Header.tsx`, `useApplicationState`, existing API/http/data modules, backend files, or `main.css` were modified by this phase. The component imports its feature stylesheet locally so parent wiring only needs to render the default component.

## Component contract and wiring surface

The default `Analytics` component accepts:

```ts
{
  year: number;
  month: number;
  region: string;
  sensors: Sensor[];
  dataMode: DataMode;
  startDate: string;
  endDate: string;
  onRange: (range: { startDate: string; endDate: string }) => void;
}
```

Its root element is `section.workspace-page.analytics-page`. It is ready for the parent to render under the existing navigation and global state. Date controls validate ISO dates and call `onRange` only for a valid inclusive range.

## Implementation

The typed service in `analyticsService.ts` has separate real and demo paths:

- **Real mode:** uses the existing typed `getSummary`, `getQuality`, `getCalendar`, and bounded `analyze` clients. It never downloads the raw/map observation collection to calculate analytics and never sends harmonized mode. The raw analysis request is used only for top grid summaries and only for ranges of 366 days or fewer; longer ranges explicitly skip spatial analysis rather than starting an untested async job.
- **Demo mode:** uses the existing `demoRecords` and `demoCalendar` adapter. All demo output is labelled synthetic/illustrative and includes a no-scientific-finding warning.
- **Region comparison:** queries the five existing region presets (`amazon`, `africa`, `asia`, `australia`, `med`) independently with a bounded worker fan-out. The UI deliberately does not calculate percentages or imply that overlapping regional queries partition a global total.
- **Stale request safety:** the component keys requests from all filters, aborts the previous request on filter changes/unmount, and ignores stale completions.
- **Runtime validation:** summary, calendar, quality, and raw analysis spatial fields consumed by the dashboard are checked before presentation. Missing metric fields remain unavailable rather than being converted to zero.

The dashboard includes:

1. Overview KPIs for raw observation total, separate MODIS/VIIRS counts, selected date range, region, source, client-fetched time, processing tier, and harmonization status.
2. Monthly trend, historical selected-month/year trend, derived seasonal distribution, and current versus previous-equivalent range comparison.
3. Five-region independent summary comparison and bounded top-grid summaries.
4. FRP in original MW units, combined total, and separate per-sensor mean/max/sum fields where the contract supports them. Real per-sensor sums remain `Unavailable` because the verified quality response does not provide them.
5. Native confidence distributions rendered separately for MODIS and VIIRS with no common score or cross-sensor ranking.
6. Coverage, missing/unobserved days, processing metadata, known limitations, and explicit day/night unavailability.
7. Accessible SVG/CSS charts with axis labels, units, legends, chart titles/descriptions, SVG titles/tooltips, responsive layouts, and accessible data tables for tabular FRP summaries.
8. Loading, empty, partial, error/retry, and invalid date-range states.

## Scientific integrity safeguards

The page consistently calls totals **raw observation records** or **detections**, not confirmed fires. MODIS and VIIRS remain separate. Native confidence representations are not harmonized. Missing/unobserved dates are not treated as confirmed zero activity. Day/night is explicitly shown as unavailable because aggregate endpoints do not support it.

Real mode prominently communicates that backend aggregate work may internally be capped at 50,000 records. The caveat is shown even below the boundary; the UI does not claim a below-cap response is a complete census. The page also states that source update time is unavailable and that its fetched time is client-side request timing.

## Verification

Commands run from `D:\Hotspot hunters2\Hotspot-hunters`:

```text
npm run build
```

Result: **passed**. Vite production build completed successfully. Vite emitted the existing large-chunk advisory (>500 kB); this is a warning only and no dependency was added.

```text
npm run test -- tests/analytics.test.ts
```

Result: **29 passed, 0 failed**. The command executes the repository’s existing test glob plus the focused analytics file. The new Phase 4 tests cover:

- deterministic seasonal grouping and sum preservation;
- real-mode aggregate-only behavior and no raw-record fetch path;
- previous-range plus five-region summary fan-out;
- bounded regional concurrency;
- independent region rows without a global share field;
- real native FRP/confidence handling and unavailable per-sensor sums;
- explicit synthetic demo labeling and demo-only FRP derivation.

No browser/server was started, per the task restriction. Parent wiring and end-to-end navigation remain the parent agent’s responsibility.

## Known limitations carried from the verified API contract

- The backend has no response-level upstream retrieval/update timestamp, so the dashboard cannot truthfully show source freshness.
- Aggregate queries have an internal 50,000-row cap and no pagination/cursor contract.
- The verified quality route cannot fully distinguish a known ingested zero day from a missing/unobserved day.
- The calendar historical values describe the selected month across years, not full annual totals.
- The backend’s seasonality endpoint is not consumed because its schema is untyped and its baseline semantics are not a validated multi-year climatology; the dashboard derives a descriptive four-season grouping from the typed twelve-month calendar response.
- Per-sensor FRP sum is not exposed by the verified aggregate response; it is intentionally shown as unavailable in real mode.
- Day/night distribution is not available in the aggregate API.
- Top-grid summaries are unavailable for date ranges longer than 366 days to avoid untested async-job behavior.
- The verified API reports raw/uncalibrated status; no harmonized values are used or presented.

## بوابة الدمج النهائية — Parent verification

صفحة Analytics موصولة الآن بقائمة RESEARCH داخل App وبـglobal filters/date range. أُضيف yearly full-year totals من server summaries بصورة منفصلة عن historical selected-month. seasonality تبقى annual descriptive context، لا calibrated anomaly. تم تصحيح empty-sensors fallback بحيث لا يعاد تشغيل مستشعرين ضمنيًا. أُصلح demo regional scope وstale keyed rendering وUTF-8. تم تصدير ChartFrame/LineChart/HorizontalBars وإضافة exact values tables؛ المسار ينقطع عبر missing/unknown periods. native metrics المفقودة تظهر Unavailable لا صفر. quality meter «Dates with records» لا satellite coverage. annual unknown periods تُعلن partial.

إصلاح تداخل فعلي اكتشفه browser: inset:0 للصفحة غطّى Header وsensor toolbar. أُزيل لصالح workspace layout محصور لا force-click. date range يضبط global year/month؛ اختيار region يحافظ على المشهد الحالي. الصور النهائية desktop و320 مقروءة؛ قص viewport القصير قابل للوصول بالـdocument vertical scroll.

`analytics-browser.mjs` Chrome: 11 فحص ناجح، صفر page errors؛ demo/ranges/native toggles/no sensors/actual summary-quality-calendar-analyze/cap caveat/exact chart tables/768×844 و390×844 و320×568 و844×390/HTTP503 safe retry دون fallback. `.work/phases/phase4` يحتوي الأدلة. آخر build 5.69s ناجح؛ إجمالي الاختبارات 32/32 بعد إضافة integrity tests. بوابة Phase4 مجتازة في نطاق هذه الأدلة، لا ادعاء باك capabilities غير موجودة.
