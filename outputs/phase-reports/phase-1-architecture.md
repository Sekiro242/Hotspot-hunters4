# Phase 1 — تنظيم المعمارية

تم تقسيم المشروع القائم دون تغيير framework أو إضافة مكتبة state أو تغيير visual identity. JSX الحالي نُقل إلى Header/Timeline/Comparison/ExploreHeading/ObservationCard؛ Earth/Calendar/Science نُقلت إلى map/features مع إبقاء entry-point compatibility في components. types وgeography منفصلان. الحالة المشتركة في useApplicationState، والداتا القديمة معزولة في useObservationData إلى حين عقد الباك. UI لا تستورد demo generator مباشرة؛ demo repository هو الحد الفاصل، وAPI placeholder يرفض التشغيل قبل توثيق العقد بدل اختراع endpoint.

## تحقق التغييرات

`npm run build` ناجح (6.76 ثانية، JS 1,321.73 kB، CSS 96.10 kB). `npm test`: 5/5، منها 3 اختبارات repository جديدة. فحص imports النسبية: لا cycles. CSS قُسم بحسب ترتيب cascade الأصلي إلى tokens/global/shell/explore/map-controls/timeline/shared/calendar/science/comparison/observation/map-feedback/animations/responsive/reduced-motion؛ حجم CSS النهائي نفس خط الأساس تقريبًا. Chrome smoke بعد التقسيم: 11/11 فحص تنقل/region/sensors/calendar/playback/compare/science/responsive/projection ناجح؛ نفس خطأ worker السابق موجود ولم ينشأ من التقسيم. لا يُعلن نجاح اختيار نقطة قبل إصلاح worker.

## ملف بملف

- `src/App.tsx`: استهلاك الوحدات والحالة الجديدة بدل JSX/طلبات متداخلة.
- `src/app/types.ts`, `useApplicationState.ts`, `Header.tsx`: shell state/navigation/types.
- `src/shared/types/observation.ts`, `shared/geography.ts`: types وبيانات المناطق/الشهور، وre-exports للحفاظ على imports الاختبارات القديمة.
- `src/data/repositories/types.ts`, `demo.ts`, `api.ts`: repository contract، demo adapter، placeholder صريح لا يتصل بendpoint مجهول.
- `src/features/observations/useObservationData.ts`, `ObservationCard.tsx`: عزل data path القديم وتفاصيل الملاحظة.
- `src/features/explore/ExploreHeading.tsx`, `features/comparison/Comparison.tsx`, `features/timeline/{Timeline,Calendar}.tsx`, `features/science/Science.tsx`, `map/Earth.tsx`: features الحالية دون حذف وظيفة.
- `src/components/{Earth,Calendar,Science}.tsx`: compatibility exports.
- `src/styles/*.css`: تنظيم الأنماط مع الحفاظ على declarations/cascade.
- `tests/repository.test.ts`: determinism/empty/sensor availability/رفض contract مختلق.

## حدود هذه البوابة

المشاكل القديمة في data fallback وAPI contract وselected reconciliation وCSV والـMapLibre worker موثقة ولم تُخفَ في refactoring. إغلاق هذه الفيس يخص سلامة التقسيم وبناء واختبارات وعدم regression في النطاق الممكن فحصه، وليس إعلان خلو التطبيق من عيوب خط الأساس. لا Analytics ولا Explorer أُضيفا هنا. الفرع المحلي `frontend/competition-phases-2026-11-13`؛ لا commit أو push أو تعديل backend.
