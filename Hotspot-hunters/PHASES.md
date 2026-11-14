# خطة تحديث Hotspot Hunters

المرجع: phases.txt المقدم من صاحب المشروع. Phase 5 مكررة حرفيًا وتُنفذ مرة واحدة. التنفيذ على نفس الفرونت دون إعادة بناء أو تغيير stack أو visual identity؛ backend للقراءة فقط؛ العمل محلي ولا رفع أو نشر.

## الترتيب المعتمد

0. توثيق خط الأساس وحماية الملفات: التقرير في `../outputs/phase-reports/phase-0-baseline.md`.
1. فصل application state/navigation، feature components، map، observation repository/shared types، CSS tokens/global/features/responsive/reduced-motion. الديمو يظل موجودًا خلف adapter. البناء واختبارات الداتا بعد كل تقسيم منطقي؛ لا صفحات جديدة قبل اعتماد هذا التقسيم.
2. إصلاح worker/lifecycle/source readiness/compare targeting/camera/projection/hover/cluster/loading/errors/keyboard. اختبارات Chrome فعلية للطبقات والتفاعل والمقارنة والأحجام والتكرار؛ قياس قبل أي ادعاء أداء.
3A. قراءة routes/models/docs في الباك والـOpenAPI المحلي؛ توثيق العقود المطبقة والناقصة دون اختراع endpoints أو fields. لا integration code قبل انتهاء التقرير.
3B. config/HTTP/runtime validation/normalization/repository، demo/real واضحان، cancellation/loading/empty/retry/partial/provenance. لا fallback صامت ولا private keys. fixtures مستمدة من العقد الفعلي مع نجاح/فشل/empty/filter/pagination tests.
4. Analytics متزامن مع filters ومصادر البيانات؛ server aggregates إن وجدت؛ raw counts لا تعني fires ولا harmonized. native confidence وFRP MW وقيود التغطية واضحة. reusable accessible charts وخدمات typed.
5. Data Explorer ببحث وفلاتر sensor/date/region/FRP/daynight/native-confidence، sort/paging/details/map focus/chips/reset/export CSV+GeoJSON، دون تحميل الكل أو truncation صامت. أي حدود باك غير موجودة تظهر بوضوح.
6. Research configs حفظ/فتح/تعديل/نسخ/حذف/مشاركة إذا أمكن، persistence محلي مُعلن إن لم توجد API. Lab تعليمي بسبع مراحل، يفرق implemented/conceptual/planned ولا يخترع algorithm/calibration/index.
7. تدقيق مستقل: وظائف/API/science/a11y/performance/responsive/security، إصلاح المؤكد وإعادة الفحص المتأثر، تقرير Ready/Conditionally Ready/Not Ready بالقيود والأدلة.

## قواعد التحقق

لا انتقال قبل بناء واختبارات النطاق المتغير وتوثيق نتيجة البوابة. تُفصل العيوب القديمة عن regressions. الفحص غير المتاح أو قدرة الباك الناقصة تُسجل كقيد بدل ادعاء 100%. لا تعديل باك لإخفاء فشل. جميع ميزات Explore/Time/Compare/Science/globe محفوظة. source identity والوقت الأصلي والمنطقة الزمنية والـmissing values لا تُختلق.

## المعمارية المستهدفة

`app/`: shell/state/navigation؛ `features/`: explore,timeline,comparison,science,analytics,data-explorer,research,lab؛ `map/`: MapLibre فقط؛ `data/`: config/client/contracts/repositories/normalization/services؛ `shared/`: types/UI/date/export utilities؛ `styles/`: tokens/global/shared/map/features/responsive/motion. الاختبارات في `tests`؛ أدلة QA في `../.work/phases` والتقارير في `../outputs/phase-reports`.

## الهوية

الهوية الموجودة هي المرجع: واجهة فضائية علمية داكنة، Space Grotesk/DM Sans، amber MODIS وcyan VIIRS، borders خفيفة وmotion مقيد. الصفحات الجديدة امتداد وليس redesign. لا أصول زخرفية جديدة أو libraries بدون حاجة.

## البوابات

- [x] Phase 0 — خط أساس موثق، وليس إعلان صحة runtime.
- [x] Phase 1 — معمارية + build/test/regression evidence.
- [x] Phase 2 — خريطة + تفاعل Chrome.
- [x] Phase 3A — عقد API الفعلي موثق.
- [x] Phase 3B — داتا حقيقية بلا fallback غير معلن + tests.
- [x] Phase 4 — Analytics + calculations/rendering/tests.
- [x] Phase 5 — Explorer + paging/export/details/tests.
- [x] Phase 6 — Research/Lab + persistence/methodology/tests.
- [x] Phase 7 — independent QA + release recommendation.

## نتيجة الإغلاق
Phase 7 تدقيق مكتمل، والتوصية Conditionally Ready للعرض المحلي؛ لا شهادة100% ولا نشر. تقرير الإغلاق النهائي: `../outputs/phase-reports/release-readiness.md`؛ التشغيل: `../outputs/local-run-guide.md`. لا backend edits أو commits أو push.
