# Hotspot Hunters — تقرير خط الأساس (Phase 0)

تاريخ التنفيذ: 13 نوفمبر 2026. المشروع القائم: `D:\Hotspot hunters2`، الفرونت: `Hotspot-hunters`، الباك: `backend`. طريقة العمل: محلي فقط؛ لا رفع كود ولا تعديل باك. هذا التقرير توثيق للحالة قبل الإصلاح، وليس إعلان جاهزية.

## المعمارية والوظائف الموجودة

React 19 وTypeScript strict وVite 7 وMapLibre GL JS وlucide-react. لا توجد مكتبة إدارة حالة أو رسوم بيانية. `App.tsx` يجمع التنقل والحالة المشتركة وتفاصيل الملاحظة وأدوات الخريطة والتايملاين وطلبات الشبكة. `Earth.tsx` يملك خريطتين في المقارنة، مع GeoJSON منفصل للنقاط والتجميع وheatmap. `Calendar.tsx` يكرر جلب التقويم والداتا التجريبية مستقلًا عن App. `Science.tsx` يقدم أربع مراحل وشرحًا للقيود العلمية. `observations.ts` يولد داتا تجريبية حتمية مع confidence خاص بكل مستشعر. `apiClient.ts` يوفر ربطًا قديمًا للباك. CSS واحد مضغوط مع Space Grotesk/DM Sans وألوان amber/cyan وخلفية داكنة؛ الأصول المحلية: countries.geojson وfavicon.svg.

الوظائف: Landing وSkip intro؛ Globe/Mercator؛ اختيار خمس مناطق أو global؛ فلاتر MODIS/VIIRS؛ points/clusters/density؛ zoom/reset north؛ سنة وشهر وscrubber/playback/speed؛ Monthly rhythm/Historical trends/Unusual periods؛ MODIS-only/VIIRS-only/split divider؛ اختيار ملاحظة وتفاصيلها؛ Science stages/notes؛ CSV link؛ دعم CSS للموبايل وتقليل الحركة.

## نتائج الأوامر الفعلية

- Node `v24.21.0`، npm `11.19.0`، Python `3.14.7`، Chrome مثبت.
- `npm run build`: ناجح، Vite build 5.44 ثانية. JS 1,319.57 kB (gzip 373.00 kB)، CSS 96.10 kB (gzip 16.21 kB)، مع تحذير chunk أكبر من 500 kB. هذه أحجام خط الأساس وليست قياس runtime.
- `npm test`: 2 ناجحين / 0 فشل. الاختبارات الحالية تغطي فقط determinism وحدود البيانات وفلاتر الديمو.
- `python -m pytest backend/tests -q`: 37 ناجحًا / 1 فشل / 1 warning. فشل `test_missing_firms_key_raises_auth_error`: البيئة المحلية تحتوي مفتاح FIRMS، والاختبار لم يعزل الإعدادات، فاستعمل المفتاح من البيئة بدل توقع عدم وجوده. لا تم تعديل الباك أو المفتاح. أي سجل تشخيصي يحتوي credential لا يُضمّن في ملفات التسليم.
- الباك الموجود على 8000 يرجع healthy وفيه ملفا Parquet؛ صحة السيرفر لا تثبت مصدر أو اكتمال أي response.
- خادم الفرونت الحالي على 5173: HTTP 200.

## تحقق المتصفح

Chrome headless على نفس الجهاز، desktop 1440×900 وtablet 768×844 وmobile 390×844 وnarrow 320×844.

فحص مستقل ناجح للتنقل إلى Landing وExplore وregion selection وsensor toggle وCalendar/month selection/tabs وplayback وإنشاء خريطة المقارنة وتغيير divider وScience وprojection controls. لم يظهر overflow أفقي للوثيقة في الأحجام المذكورة، لكن ذلك لا يثبت غياب كل تداخل أو تحقق contrast/screen reader.

اختبار المتصفح الأصلي فشل عند `visible VIIRS observation must render`. السجل يؤكد `Worker failed to load. Check that the worker URL is correct.` من MapLibre. ظهور canvas أو basemap لا يعني أن طبقة الملاحظات تعمل. لذلك اختيار الملاحظة وhover/cluster interaction لم يُعتمدا كناجحين. تم تسجيل أخطاء console وطلبات الباك. طلبات مسار الملاحظات والتقويم رجعت 200 لكن بعض المرشحات القديمة لم تراجع بعد ضد عقد الباك.

## العيوب المؤكدة قبل التعديل

| الأولوية | العيب | المصدر / الدليل |
|---|---|---|
| حرجة | صحة الباك ترفع LIVE label حتى عند fallback إلى synthetic؛ الفشل والنتيجة الفارغة قد يعرضان ديمو بدل بيانات حقيقية | App 23–64 و95–96؛ مراجعة مستقلة |
| كبرى | MapLibre worker لا يحمل؛ فشل ظهور VIIRS point | سجل baseline/result.json واختبار المتصفح |
| كبرى | البيانات والتقويم القديمان لا يُمسحان عند تغيير بعض الفلاتر أو فشل الطلب، فيختلط الاختيار الحالي بنتيجة قديمة | App 27–63 وCalendar 10–23 |
| كبرى | cast لخصائص GeoJSON إلى Observation دون normalization أو تحقق | App 42 |
| كبرى | CSV ينتهي دائمًا يوم 28، وليس آخر يوم فعلي في الشهر | App 96 |
| كبرى | الخريطة اليمنى لا تستقبل أحداثًا مباشرة؛ branch الخاص بcluster يعمل على الخريطة الرئيسية، hover قد يظل في الجانب الآخر | Earth 26–28 و42؛ مؤكد بالكود، runtime interaction لم يكتمل بسبب worker |
| متوسطة | health probes مكررة وغير ملغاة؛ تقويم يجلب مستقلاً وبfallback مختلف عن App | App/Calendar |
| متوسطة | Science تقول إن كل الداتا synthetic رغم live labels في باقي الواجهة | Science 4 وApp |
| متوسطة | أزرار timeline تفاعلية لكنها aria-hidden وtabIndex=-1؛ disclosure/tabs/card focus ناقص | App 85–96 وScience/Calendar |
| متوسطة | selected record لا يراجع عندما تتبدل liveData أو compareMode | App 67 |

## مخاطر لم تتحقق بعد

خروج ودخول المقارنة مرات كثيرة؛ style reload/source readiness وlisteners؛ WebGL loss؛ network timeout/partial failure؛ timestamp/confidence/metadata من الباك؛ limits/pagination/region contract؛ contrast وسلوك screen reader؛ قياس heap/initial load/chart/table للميزات غير الموجودة. لم يُجر audit dependencies بعد.

## الصور والأدلة

الصور الموجودة في `.work/phases/baseline`: entry.png، explore.png، calendar.png، compare.png، science.png، mobile-768.png، mobile-390.png، mobile-320.png، failure.png. الأدلة الآلية: result.json وsmoke.json وbuild-sizes.json. سيتم تضمين صور خط الأساس ضمن مجلد التقرير بعد التحقق النهائي؛ لا حاجة لنقل ملفات المصدر.

## حماية المشروع والرجوع

Git بدأ نظيفًا على `main`، HEAD `5aa6db8`. حفظت نسخة `frontend-backup.zip` تشمل src/tests/manifests/configs، مع HEAD/status. الفرع المقترح: `frontend/competition-phases-2026-11-13`، من HEAD الحالي دون تغيير history أو remote. لا commits أو push بدون حاجة. الرجوع يكون بانتقاء الملفات المتغيرة مقارنة بالنسخة أو HEAD، وليس `reset --hard` أو حذف شغل المستخدم. يجب حفظ أي تعديل جديد من المستخدم قبل rollback. الباك خارج نطاق التعديل.

## الملفات الدقيقة المقترحة للفيس التالية

تغيير تدريجي: `src/App.tsx`، `src/data/observations.ts`، `src/components/Earth.tsx` (النقل فقط في فيس المعمارية)، `src/components/Calendar.tsx`، `src/components/Science.tsx`، `src/styles/main.css`، `src/main.tsx`. إنشاء وحدات `src/app/types.ts`، `src/app/useApplicationState.ts`، `src/shared/types/observation.ts`، `src/data/repositories/{types,demo,api}.ts`، `src/features/observations/useObservationData.ts`، feature folders للـExplore/Timeline/Comparison/Science و`src/map`، وملفات styles متخصصة. لا Analytics أو Data Explorer في Phase 1، ولا تغيير شكل الواجهة.

حالة بوابة Phase 0: التقرير وinventory والأوامر وbrowser evidence وعيوب البداية واستراتيجية rollback موثقة. نجاح التقرير لا يعني أن العيوب المذكورة محلولة؛ إصلاحها يُثبت في فيسها.
