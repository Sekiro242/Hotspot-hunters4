# مراجعة QA الوظيفية — الوظائف وتكامل الصفحات

**النطاق:** App/Header/FeatureMenu/useApplicationState، صفحات Explore/Time/Compare/Science، والصفحات الجديدة Analytics/Data Explorer/Research Workspace/Harmonization Lab.

**طريقة المراجعة:** قراءة ثابتة مستقلة للكود وتقارير المراحل و`phases.txt` والعقود والـfixtures. لم أعد تشغيل build أو الاختبارات أو Chrome أو أي خادم، التزامًا بالتعليمات. لا أعدّ قدرات backend المستبعدة (pagination/auth/server research/harmonization algorithms) عيوبًا أمامية.

## العيوب المؤكدة

### 1. العودة إلى Research تعيد استيراد رابط المشاركة وتطغى على المسودة الحالية

- **الخطورة:** متوسطة
- **الملف/السطر:** `Hotspot-hunters/src/features/research/ResearchWorkspace.tsx:65-83`
- **الدليل:** عند كل mount يقرأ المكوّن `window.location.hash`، وإذا بدأ بـ`#research=` ينفذ `setDraft(createDraftFromConfig(imported.value))` و`setEditingId(null)`. الغلاف لا يستهلك الـhash ولا يزيله عند التنقل (`App.tsx:45` لا يغيّر hash). لذلك فتح رابط مشاركة ثم تعديل المسودة أو حفظها، ثم الانتقال إلى Analytics/Data/Explore والعودة إلى Research، يعيد المسودة الأصلية من الرابط ويزيل حالة التحرير الحالية من الواجهة. هذا يخرق سلوك استمرارية التنقل والمسودة/CRUD، حتى إن كان السجل المحفوظ نفسه لا يُحذف من localStorage.
- **الإصلاح المقترح:** اجعل استيراد hash عملية one-shot، مثل إزالة hash بعد نجاح الاستيراد باستخدام `history.replaceState`، أو الاحتفاظ بـref يثبت أن هذا الـhash عولج وعدم إعادة استيراده عند mount اللاحق. لا ينبغي تغيير draft أو `editingId` عند العودة العادية إلى الصفحة.

### 2. رابط CSV العام لا يحترم نطاق التاريخ العالمي المخصص

- **الخطورة:** متوسطة
- **الملف/السطر:** `Hotspot-hunters/src/App.tsx:74-75`
- **الدليل:** الحالة النشطة تُعرّف `activeDates=dateRange??monthRange(year,month)` في السطر 32 وتُمرر إلى الصفحات الجديدة، لكن رابط CSV في السطر 75 يستعمل دائمًا `monthRange(year,month).endDate` ويكوّن بداية الشهر من `year/month`. بعد تطبيق نطاق مخصص من Analytics أو Data Explorer، تظل الواجهة تعرض النطاق المخصص وتطلب البيانات به، بينما زر CSV الموجود في الغلاف يطلب شهر `year/month` فقط. ينتج ذلك تصديرًا مختلفًا عن الفلاتر/التاريخ الظاهرين دون تنبيه؛ وهو خلل تكامل بيانات مؤكد، وليس مجرد غياب endpoint.
- **الإصلاح المقترح:** مرّر `activeDates.startDate` و`activeDates.endDate` إلى `burnCalendarApi.getCsvDownloadUrl`. وإذا كان رابط CSV backend لا يدعم بقية فلاتر Explorer، أبقِ التحذير الحالي واضحًا بأنه لا يحفظ الفلاتر المحلية، لكن لا تغيّر نطاق التاريخ بصمت.

### 3. Analytics يخلط بين إجمالي سنوي صفري وحالة missing/unobserved

- **الخطورة:** متوسطة
- **الملف/السطر:** `Hotspot-hunters/src/features/analytics/analyticsService.ts:160-163`
- **الدليل:** أثناء بناء السلسلة السنوية، إذا نجح `getSummary` لكن كان `annual.total_detections===0`، يضيف الكود النقطة مع `missing:true` ويجعل dashboard يعلنها غير متاحة/غير مرصودة ويحوّل النتيجة إلى `partial`. وفي `Analytics.tsx:26` تُعرض كل نقطة `missing` كـ`Unavailable / unobserved`، لا كصفر. عقد `AnalysisSummary` يعرّف `total_detections` كرقم صالح، ولا يعرّف أن الصفر يعني فشلًا أو فقدانًا؛ كما أن عقد التقويم يميز حالات مثل `data_status: zero_or_unobserved`، وهي ليست دليلًا على أن كل صفر من summary مفقود. بالتالي يمكن عرض summary صفري صحيح كأنه unavailable، وهو تضليل للعدد/التغطية.
- **الإصلاح المقترح:** لا تجعل الصفر `missing` تلقائيًا. اعرض `0` عندما ينجح الملخص، واجعل `missing` true فقط لفشل الطلب أو لحالة غياب صريحة من العقد. إذا كان backend يرسل حالة `zero_or_unobserved`، احتفظ بحقل حالة مستقل يعرض عدم اليقين بدل تحويل القيمة الرقمية إلى unavailable.

## ما تم اجتيازه أو تأييده من القراءة

- تعريف المشاهد مركزي في `app/types.ts`، والتنقل القديم والجديد موصول في `App.tsx` و`Header.tsx` و`FeatureMenu.tsx`، مع `aria-current` للصفحة الحالية وقائمة Research المميزة عند مشاهد Analytics/Data/Research/Lab.
- الحالة العامة تحمل source/date range/region/sensors/explorer filters/focus/selection/comparison settings، و`applyResearch` يعيد هذه القيم صراحة، وعمليات تغيير query تمسح selection/focus القديمين.
- Data Explorer يطبق الفلاتر المحلية على subset المعلن، يحافظ على القيم الأصلية والوحدات، ويدعم pagination محلية، تفاصيل، focus للخريطة، selected highlight، CSV/GeoJSON لكل السجلات المفلترة المحملة لا الصفحة المرئية فقط.
- Research CRUD المحلي (حفظ/إعادة فتح/تعديل/نسخ/حذف) والتحقق من schema والتواريخ والمستشعرات، مع عدم تطبيق snapshot على parent إلا عبر Apply الصريح، متسق في القراءة مع النموذج والتقارير.
- share URL في النموذج يحمّل snapshot كـunsaved draft ولا يحفظه أو يطبقه تلقائيًا، ويحافظ على Unicode ويفرض HTTP(S) والتحقق؛ العيب المذكور أعلاه هو تكرار الاستيراد عند إعادة mount، لا فساد encoding.
- Harmonization Lab يعرض المراحل كـImplemented/Conceptual/Planned، ويمنع طلب harmonized analysis أو إنشاء مؤشر/معايرة وهمية، ويربط handoff بالملاحظات والـsnapshot عبر App.
- تقارير المراحل تفيد بنجاح build strict و`npm test` 52/52، وChrome Analytics 11/11 وExplorer 16/16 وResearch/Lab 17/17 بصفر page errors؛ لم أكرر هذه الأوامر وفق قيد المراجعة.

## القيود والاحتمالات غير المثبتة

- هذه مراجعة static scope؛ لم أعد تشغيل Chrome أو backend أو build/test، لذلك لا أؤكد أداء runtime أو سلوك أجهزة/متصفحات غير الوارد في التقارير.
- لم أحتسب نقص pagination/auth/server-side search أو خوارزمية harmonization عيوبًا؛ التقارير والعقد يعلنانها خارج النطاق أو غير متاحة.
- لم أجد من القراءة عيبًا مؤكدًا في استعادة source/region/sensors/comparison عند Apply بخلاف أثر share-hash المكرر، ولا في selected map focus بعد مسار Data Explorer الذي تغطيه الأدلة المذكورة.
- لا تعني النتيجة أن التطبيق خالٍ من كل العيوب أو جاهز بنسبة 100%؛ تعني فقط أن العيوب أعلاه هي العيوب الوظيفية المؤكدة التي أمكن إثباتها ضمن هذا النطاق والقيود.
