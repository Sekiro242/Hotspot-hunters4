# المراجعة المستقلة النهائية — Phase 7

**التاريخ:** 2026-11-14  
**النطاق:** تجميع نتائج QA المستقلة المقدمة فقط، من دون إعادة بحث في الكود أو تشغيل أوامر أو متصفح أو خادم أو اختبارات.  
**الحالة:** لا توجد تعديلات مصدرية أو commits ضمن هذه المراجعة.

## الخلاصة التنفيذية

المراجعة الساكنة المجمعة لم تثبت عيبًا حرجًا، لكنها أثبتت **حاجز إصدار أمنيًا عالي الشدة**: ملف `.env` متعقّب في Git. لم تُقرأ قيم الملف، لذلك لا يمكن الجزم بوجود سر داخله، لكن وجوده في الفهرس كافٍ ليتطلب معالجة قبل اعتبار الإصدار جاهزًا.

كما ثبتت مجموعة عيوب متوسطة تؤثر في صحة البيانات، وسلامة التصدير، وسلوك التنقل، والتجاوب، والإتاحة، وعقد API. أهمها: إعادة استيراد رابط المشاركة فوق مسودة Research عند العودة، تجاهل رابط CSV لنطاق التاريخ المخصص، تحويل الصفر السنوي الصحيح إلى `missing/unobserved`، عرض أعداد المجموعة المحمّلة كأنها إجماليات عند `partial`، وتداخل DATA SOURCE مع أسفل Timeline عند 768×844. توجد كذلك فجوات وصول مهمة في نقل التركيز، مؤشرات التركيز، وربط أخطاء النماذج بالحقول.

**الحكم المبدئي:** التطبيق ليس جاهزًا للإصدار قبل إزالة خطر `.env` ومراجعة تاريخه/تدوير الاعتماديات إن لزم، ثم إصلاح أو قبول موثق للعيوب المتوسطة ذات الأثر على دلالة البيانات والتصدير والتنقل والإتاحة. بعد ذلك يلزم إعادة تشغيل بوابات الاختبار والمتصفح للتحقق؛ لا تمنح هذه المراجعة ضمانًا شاملًا بنسبة 100%.

## 1. حاجز الإصدار المؤكد

### P0 — ملف `.env` متعقّب في المستودع (أمني، عالٍ)

- **الدليل:** `git ls-files -- '.env'` أعاد `.env`، وقاعدة `.gitignore` تمنع الإضافة المستقبلية فقط ولا تزيل الملف من تاريخ Git.
- **المرجع:** `D:/Hotspot hunters2/outputs/phase-reports/qa-security.md`، وموضع الدليل المشار إليه في `.gitignore`.
- **ما هو مثبت:** الملف متعقّب. لم تُقرأ القيم، ولم يثبت وجود سر بعينه.
- **المعالجة المطلوبة قبل الجاهزية:** إزالة `.env` من الفهرس مع إبقائه محليًا عند الحاجة، مراجعة وتنظيف التاريخ وفق سياسة المستودع، وتدوير أي اعتماديات كانت موجودة فيه. يجب تأكيد النتيجة بمراجعة Git/الأسرار المناسبة، لا بمجرد إضافة قاعدة ignore.

## 2. العيوب المتوسطة المؤكدة — مرتبة حسب أثرها

### P1 — صحة البيانات والتصدير والعقود

1. **الصفر السنوي يُحوّل إلى missing/unobserved.**
   - `analyticsService.ts` يضبط `missing` عندما يساوي `annual.total_detections` صفرًا؛ تعرض Analytics الحالة كـ`Unavailable/unobserved` وقد تجعل الملخص `partial`.
   - الصفر قيمة ملخص صالحة، ولا تثبت وحدها غياب التغطية.
   - **الإصلاح:** لا تُشتق missingness من العدد؛ استخدم حالة غياب/جودة صريحة من backend، واعرض الصفر كصفر ناجح.
   - **المراجع:** `qa-functional.md`، `qa-scientific.md`، `qa-api.md`، `qa-security.md` — جميعها تشير إلى `src/features/analytics/analyticsService.ts:161`.

2. **رابط CSV العام يتجاهل نطاق التاريخ المخصص.**
   - `App.tsx` يبني البداية والنهاية من `year/month` و`monthRange` حتى عندما تكون `activeDates` نطاقًا مخصصًا مستخدمًا في Analytics أو Data Explorer.
   - **الإصلاح المفضل:** تمرير `activeDates.startDate` و`activeDates.endDate` إلى `getCsvDownloadUrl`، مع إبقاء واضح أن الفلاتر المحلية الأخرى لا يحفظها رابط backend. البديل هو تسمية الرابط صراحة بأنه تصدير الشهر التقويمي.
   - **المراجع:** `qa-functional.md`، `qa-scientific.md`، `qa-api.md`، `qa-security.md` — `src/App.tsx:75`.

3. **العدادات لا تميّز دائمًا المجموعة المحدودة عند `partial`.**
   - تذييل الواجهة يعرض أعداد MODIS/VIIRS من البيانات المحمّلة دون وسم صريح بأنها `LOADED SUBSET` أو `bounded` عند بلوغ حد الخريطة.
   - **الإصلاح:** وسم الأعداد كمجموعة محمّلة محدودة، وعدم تقديمها كإجمالي إلا إذا كان الإجمالي موثقًا من الخادم.
   - **المرجع:** `qa-security.md`، `src/App.tsx:75`.

4. **الملخص الإقليمي غير المتاح يظهر بصريًا كصفر.**
   - عند فشل الاستعلام تنشئ الخدمة `available:false` مع `total:0`، ثم تمرر الواجهة الصفر إلى الرسم؛ النص قد يقول Unavailable بينما الرسم يوضح صفرًا.
   - **الإصلاح:** استخدام `null`/حالة Unavailable عندما `available=false`، وعدم استعمال الصفر كبديل للفشل.
   - **المرجع:** `qa-security.md`، `src/features/analytics/Analytics.tsx:46` و`analyticsService.ts:128`.

5. **مدخلات API غير الصالحة قد تعود 500، وقد تُعاد تفاصيل الاستثناء الخام.**
   - مسارات `summary`, `quality`, `calendar`, و`map` تستخدم catch عامًا أو `HTTPException(detail=str(exc))`؛ قيم sensor/date غير الصالحة قد لا تُحوّل إلى 422، وقد يتسرب نص الاستثناء في 500.
   - **الإصلاح:** validators صريحة تعيد 422 للمدخلات، envelope ثابت لأخطاء المجال، وتسجيل داخلي بمعرف تتبع مع رسالة عامة للمستهلك.
   - **المرجع:** `qa-api.md`، خصوصًا `backend/app/api/v1/summary.py:29-40` و`map.py:92`.

### P1 — سلوك الواجهة والتجاوب

6. **إعادة استيراد share hash تطغى على مسودة Research عند العودة.**
   - كل mount يقرأ `window.location.hash`، وعند `#research=` يعيد `setDraft` ويمسح `editingId`؛ التنقل لا يستهلك hash one-shot.
   - **الإصلاح:** استهلاك hash مرة واحدة بعد النجاح عبر `history.replaceState` أو ref، وعدم إعادة ضبط المسودة عند العودة العادية.
   - **المرجع:** `qa-functional.md`، `src/features/research/ResearchWorkspace.tsx:65`.

7. **تداخل DATA SOURCE مع تذييل Timeline عند 768×844.**
   - اختلاف `bottom` و`z-index` بين Timeline و`source-controls` مدعوم بالصور المحفوظة، مع عدم إثبات نفس التداخل في 320/390 ضمن الأدلة.
   - **الإصلاح:** فصل موضعي العنصرين مع هامش كافٍ، ثم assertion لعدم تقاطع bounding boxes في 768×844 وdesktop.
   - **المرجع:** `qa-responsive.md`، `src/styles/timeline.css:1` و`src/styles/data-source.css:1,5`.

### P1 — الإتاحة

8. **تغيّر المشهد لا ينقل التركيز إلى الصفحة الجديدة.** إضافة مدير تركيز يركز عنوان/landmark المشهد بعد تغيير `scene` مع `tabIndex=-1`.
9. **Escape في بحث المناطق لا يعيد التركيز إلى زر فتح البحث.** إضافة ref وإغلاق موحد يعيد التركيز بعد Escape وبعد اختيار المنطقة.
10. **مؤشر التركيز مخفي لحقل بحث المناطق وللوحة الخريطة.** إزالة `outline:none` أو إضافة `:focus-visible` واضح بتباين كافٍ.
11. **أخطاء Research غير مرتبطة بالحقول.** إضافة IDs للرسائل، `aria-describedby` و`aria-invalid` لحقول Region/Start/End/Sensors.
12. **خطأ نطاق Analytics غير مرتبط بمدخلاته.** ربط رسالة الخطأ بمدخلي start/end وإضافة `aria-invalid`، مع تركيز أول حقل غير صالح عند الحاجة.
13. **خطأ نطاق Data Explorer غير مرتبط بمدخليه.** إضافة IDs و`aria-describedby` و`aria-invalid` لحقلي Start/End UTC.

- **المرجع الموحد:** `qa-accessibility.md` (7 عيوب متوسطة من أصل 9)، مع المواضع المشار إليها في `App.tsx`, `explore.css`, `shell.css`, `ResearchWorkspace.tsx`, `Analytics.tsx`, و`DataExplorer.tsx`.

### P2 — أداء وتحسينات كفاءة مؤكدة ساكنًا

14. **طلب تقويم مكرر محتمل/مؤكد على مستوى call-graph عند Analytics.** `useObservationData` يعمل عالميًا بالتوازي مع طلب Analytics الخاص.
   - **الإصلاح:** مصدر تقويم مشترك أو in-flight/cache dedupe بمفتاح canonical، مع سياسة إلغاء واضحة وترتيب sensors موحّد.
15. **البحث المؤجل لا يؤجل كامل كلفة البحث.** تغيّر `props.filters` يعيد بناء `effectiveFilters` مع كل ضغطة، و`JSON.stringify(originalProperties)` داخل المقارنة يسبب allocations وكلفة `O(N*metadata)`.
   - **الإصلاح:** فصل dependencies غير البحثية، وفهرس بحث memoized عند تغير records/metadata.
16. **حمولة GeoJSON للخريطة تحتوي metadata الخام كاملة.** تُكرر `originalProperties` في features وتُمرر إلى مصدري observations وclusters.
   - **الإصلاح:** إسقاط map-specific يحوي geometry/id/sensor/الحقول اللازمة للرسم، وإبقاء metadata في record index/React وتحديد cluster properties صراحة.
17. **ذروة ذاكرة مؤقتة غير مثلى أثناء التصدير.** بناء CSV/JSON كامل ثم Blob قد يبقي البنية والنص وBlob معًا لفترة قصيرة، مع بقاء حد 10MB فعالًا.
   - **الإصلاح:** serialization على دفعات أو Blob chunks مع عد bytes، أو تقليل النسخ/pretty-print عند الحاجة، مع استمرار revoke للـobject URL.

- **المرجع:** `qa-performance.md`. هذه inefficiencies ليست تسرب ذاكرة دائمًا مثبتًا ولا قياسات runtime؛ لم تُرفع إلى Critical/High.

## 3. تحسينات منخفضة الأولوية وفجوات دفاعية

- `SortButton` يضع `aria-sort` على button إضافة إلى `th`; يبقى `aria-sort` على رأس العمود فقط واستخدم اسم/حالة زر مناسبة. (`qa-accessibility.md`)
- لوحة Research المنسدلة تحمل `aria-label` على generic div بلا landmark دلالي مضمون؛ استخدام `nav` أو نمط menu متسق مع السلوك. (`qa-accessibility.md`)
- حارس MODIS confidence يتحقق من النوع والمدى ولا يفرض integer، و`confidenceLevel` ليس enum مقيدًا. (`qa-api.md`)
- فرع `response.text()` عند غياب `response.body` لا يفرض حد bytes بعد القراءة. (`qa-api.md`, `qa-security.md`)؛ الخطر دفاعي مشروط ولم يظهر في Chrome المتحقق.
- تحقق `calendar/analyze` من الاستجابات سطحي مقارنة بالعقد؛ إضافة schema parser كامل للحقول والتواريخ والخلايا. (`qa-api.md`)

## 4. الأدلة المتحققة مقابل حدود المراجعة

### أدلة تنفيذ سابقة مقدمة ولم تُعد هنا

التقارير السابقة تفيد بنجاح build، و`52/52` unit tests، وChrome Analytics `11/11`، وData Explorer `16/16`، وResearch/Lab `17/17`، مع صفر page errors في تلك الجولات. كما تفيد تقارير Phase 2 و4 و5 و6 بدورة حياة Earth الأساسية، التنظيف، التصدير المحدود، حدود real/demo، وتحميل chunks منفصلة.

هذه نتائج موثقة سابقًا وليست إعادة تحقق في Phase 7. لا يمكن استخدامها لإغلاق العيوب الساكنة أعلاه دون إصلاح ثم إعادة تشغيل الاختبارات المناسبة.

### ما تثبته المراجعة الحالية

النتائج الحالية مبنية على قراءة ساكنة مستقلة، call-graph، CSS والصور المحفوظة، والعقود والـfixtures المشار إليها في تقارير QA. لم تُقَس request rate أو heap أو frame rate أو أزمنة التصدير، ولم يُشغّل متصفح أو قارئ شاشة أو backend أو build/tests هنا. بعض فجوات API وfallback وconfidence مصنفة دفاعية/محتملة أو منخفضة حيث لم تثبت استجابة malformed runtime.

## 5. قيود معروفة وخارج النطاق

- لم تُفحص أو تُقاس pagination/auth/server-side search/sort أو خوارزميات harmonization إلا بقدر أثرها على الواجهة؛ غيابها لا يُعد عيب frontend في هذه المراجعة.
- لم تُتحقق صحة backend الخام، أو FIRMS/MODIS/VIIRS، أو تعريفات coverage والمعايرة والتحقق المستقل.
- لم يُتحقق من CSP/TLS/رؤوس HTTP أو سلوك proxy الفعلي، ولم تُقرأ قيم `.env`.
- لم تُجرَ اختبارات لوحة مفاتيح فعلية أو قارئ شاشة أو contrast rendered، لذلك تبقى نتائج الإتاحة static حتى التحقق التشغيلي.
- لا تشمل النتيجة ضمانًا لخلو التطبيق من كل العيوب أو جاهزيته بنسبة 100%.

## 6. قائمة إصلاح مختصرة للوكيل الرئيسي

1. أوقف الجاهزية مؤقتًا: أزل `.env` من الفهرس، راجع التاريخ، ودوّر الاعتماديات عند اللزوم.
2. أصلح دلالة البيانات أولًا: افصل zero عن missing، وافصل unavailable عن total=0، ووسم partial/loaded subset.
3. أصلح رابط CSV ليحترم `activeDates` أو سمّه بوضوح كتصدير شهر تقويمي مستقل.
4. أصلح استهلاك Research share hash one-shot.
5. أصلح تداخل Timeline/Data Source عند 768×844 وأضف assertion بصريًا/DOMيًا.
6. نفّذ إصلاحات التركيز ومؤشرات focus وربط أخطاء الحقول دلاليًا.
7. أضف validators و422 ورسائل backend عامة، مع schema validation أعمق للردود.
8. عالج dedupe للـcalendar وفهرسة البحث وإسقاط GeoJSON وتقليل نسخ التصدير حسب أولوية الأداء.
9. بعد الإصلاحات، أعد build/unit/browser/API/security/accessibility checks وسجّل النتائج الجديدة؛ لا تعتبر التقارير السابقة إغلاقًا تلقائيًا.

## المراجع الفردية

- `D:/Hotspot hunters2/outputs/phase-reports/qa-functional.md`
- `D:/Hotspot hunters2/outputs/phase-reports/qa-performance.md`
- `D:/Hotspot hunters2/outputs/phase-reports/qa-scientific.md`
- `D:/Hotspot hunters2/outputs/phase-reports/qa-responsive.md`
- `D:/Hotspot hunters2/outputs/phase-reports/qa-accessibility.md`
- `D:/Hotspot hunters2/outputs/phase-reports/qa-api.md`
- `D:/Hotspot hunters2/outputs/phase-reports/qa-security.md`
