# Verification

- Production TypeScript/Vite build: passed.
- Deterministic data and consistency tests: passed (including pre-2000 MODIS and pre-2012 VIIRS availability).
- Chrome desktop 1440 x 900 and mobile 390 x 844: passed.
- Actual WebGL map initialization, imagery loading and projection switching: passed.
- Region preset search and camera flight: passed.
- Sensor visibility and layer switching: passed.
- Map observation selection and contextual metadata card: passed.
- Month/year changes, playback, seasonal calendar, historical view and unusual-period view: passed.
- Two-map comparison, divider changes and navigation: passed.
- Science stages and expanded methodology: passed.
- Mobile control disclosure and horizontal overflow check: passed.
- Main browser flow JavaScript/console errors: none.
- Simulated imagery network failure: local interactive geographic fallback verified.
- Dependency audit: zero reported vulnerabilities.
- Screenshots manually reviewed; headline clipping, calendar/playback overlap and mobile map-control overlap corrected.

Known constraints: synthetic data only; no validated harmonization; map requires WebGL; imagery and web fonts require external network access. The map engine makes the production JavaScript bundle approximately 372 kB gzipped and triggers Vite's advisory chunk-size warning. Performance was functionally checked but not benchmarked at a guaranteed frame rate. Browser automation uses desktop Chrome with mobile viewport emulation, not physical mobile hardware.
