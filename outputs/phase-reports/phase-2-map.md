# Phase 2 — هندسة الخريطة والتفاعل

تم الحفاظ على MapLibre وsatellite style وGlobe/Mercator والألوان والطبقات الموجودة. إصلاح worker هو استخدام ملف `maplibre-gl-worker.mjs` الموجود فعلًا في الحزمة عبر Vite `?url` و`setWorkerUrl`؛ ملف worker يظهر أيضًا في dist، وليس اعتمادًا على sibling مفقود من optimized deps.

## الإصلاحات المؤكدة

إدارة listeners وResizeObserver وcleanup أصبحت صريحة، مع active guards وnull map reference بعد removal. source/layers تُضاف مرة واحدة مع style readiness. تحديث GeoJSON يشترك في FeatureCollection واحدة ويحدث فقط عند تغير records، وليس عند تبديل layer/projection. record lookup عبر index بدل scan لكل mouse click. primary canvas يملك gestures، لكن اختيار الملاحظة والـhover والـcluster query يتم على الخريطة الظاهرة بحسب divider، ثم camera leader يزامن الجانبين. hover القديم يُمسح من الخريطتين. cluster expansion يأخذ expansion zoom من source الصحيح. projection يضبط بعد تحميل الخريطة الثانية أيضًا. مقارنة MODIS/VIIRS تدعم طبقات points/clusters/density دون حذف single-sensor modes. selected highlight وmap focus مُجهزان لاستخدام Data Explorer لاحقًا.

أُضيفت حالات منفصلة للـWebGL/initialization/imagery/local geography/observation rendering، وempty state. observation network loading/error تخص repository وتُعالج في Phase 3B، ولا تُخفى وراء imagery notice. أزيل zoom listener الذي كان App يضيفه عبر onReady. map accessible region/canvas label، timeline buttons لها labels/pressed states، disclosures expanded state، divider لديه value text وفوكس ظاهر.

## الاختبارات المنفذة

Chrome headless، actual local MapLibre، reduced-motion في اختبارات التفاعل، backend outage controlled لاختبار demo map فقط (ليس ادعاء نجاح API). `map-browser.mjs`: 14 فحصًا ناجحًا: worker/globe؛ region + VIIRS point selection؛ density/clusters/points؛ zoom/reset north؛ source sensor identity؛ MODIS وVIIRS selection وhover على الجانبين؛ divider 20/50/80؛ camera/projection sync؛ MODIS-only/VIIRS-only؛ 6 دورات Science↔Compare مع canvas count صحيح؛ resize 768×844 و390×844 و320×568 و844×390؛ صفر map console/page errors.

`map-edge-browser.mjs`: 4 فحوص ناجحة. instrumentation أثبت صفر setData لsource الملاحظات عند تبديل layer فقط. cluster حقيقي على الجانب الأيمن وسّع zoom باستخدام source اليمين مع تساوي camera zoom. فشل imagery مُحاكى أبقى local geography ورسالة محددة. WebGL getContext failure مُحاكى عرض رسالة محددة. لا يُدعى اختبار كل GPU أو جهاز فعلي.

`npm run build`: ناجح، 5.79 ثانية. `npm test`: 5/5. JS 1,325.10 kB (gzip 374.85)، worker 520.11 kB منفصل، CSS 96.41 kB (gzip 16.28). التحذير الخاص بالـchunk الكبير ما زال موجودًا ولا يُخفى.

## القياسات وحدودها

style-ready initialization callback في Chrome dev، cache warm/local assets: 55.8 ms. هذا ليس زمن اكتمال تحميل imagery ولا نتيجة benchmark لجميع الأجهزة. JS heap snapshot بعد اختبارات التكرار: 58,009,061 bytes؛ snapshot واحد لا يثبت عدم وجود memory leak ولا يُستخدم لادعاء تحسن نسبة أداء. قياس source updates الفعلي صفر في layer-only updates هو قياس محدد، وليس ادعاء أن كل rendering أصبح أسرع.

الأدلة والصور في `../.work/phases/phase2`: result.json وedge-result.json وentry/compare/responsive/imagery-failure/webgl-failure screenshots. لا تغييرات باك. بوابة فيس 2 ناجحة في الاختبارات المحددة؛ limitations المستمرة تتعلق بعقد API/dataset scale/general device coverage وتُراجع لاحقًا.

## مراجعة الصور

مراجعة screenshots أكدت الحفاظ على الواجهة وظهور النقاط بألوان المستشعرين. الشاشات القصيرة تستعمل min-height أكبر من viewport؛ اختبار resize/overflow الأفقي لا يثبت ظهور كل controls دون scroll. تم رصد ضيق header عند 320 px وإضافة قاعدة responsive لتقليل ازدحامه، مع نقل labels المقارنة خارج العنوان في mobile القصير. حدث تشويه ترميز محدود في App أثناء سكربت تنظيف imports، وصُحح فورًا باستخدام UTF-8 وأعيد typecheck؛ لا علاقة له بالداتا أو الباك. تُحمل هذه النقاط للتدقيق النهائي بدل إخفائها.
