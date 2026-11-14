# مراجعة QA مستقلة — عقد API وحالات الفشل (Phase 3A)

**المشروع:** Hotspot Hunters  
**النطاق:** `config/http/contracts/normalize/repositories/useObservationData/Analytics/metadata Lab`، fixtures/tests، ومسارات backend للقراءة فقط.  
**طريقة المراجعة:** قراءة ساكنة للمصدر والعقود والـ fixtures والاختبارات وتقارير Phase 3A/3B الموجودة. لم أشغّل build أو tests أو browser، ولم أتصل بأي endpoint حي، ولم أعدّل الشيفرة أو backend.

## الخلاصة

التكامل يطبق فصلًا صريحًا بين `demo` و`real`، ولا يستبدل فشل API ببيانات تجريبية، ويحافظ في المسار الطبيعي على المصدر ووقت UTC ووحدة FRP والثقة الأصلية لكل حساس، ويعرض حدود الاستجابة (`limit`) بدل اختراع pagination. كما أن حالات timeout/network/schema/response-size لها رسائل آمنة للمستخدم. توجد العيوب المؤكدة التالية:

1. التحليل السنوي يحوّل إجماليًا حقيقيًا يساوي صفرًا إلى `missing/unobserved`، فيعرض صفر النشاط كأنه عدم توفر بيانات.
2. رابط CSV في التطبيق يتجاهل نطاق التاريخ المخصص النشط ويستخدم شهر `year/month` بدل `activeDates`.
3. عدة مسارات backend تحوّل مدخلات غير صالحة إلى HTTP 500، وتعيد أحيانًا تفاصيل الاستثناء الداخلية؛ هذا يخالف عقد أخطاء اختيار/تصفية نظيفًا، حتى لو أخفى عميل الواجهة التفاصيل للمستخدم.
4. حارس الثقة في التطبيع لا يفرض أن ثقة MODIS عدد صحيح، ولا يتحقق من قيم `confidenceLevel` المقيدة بالعقد.

وتوجد نقطتان دفاعيتان محتملتان لم تظهرهما الأدلة المتحققة: فرع HTTP ذي `response.body === null` لا يطبق حد الحجم أثناء القراءة، وحارس `getCalendar/analyze` لا يتحقق بالكامل من جميع حقول الاستجابة. لا أعدّهما حادثتين runtime مثبتتين في هذه المراجعة.

## النتائج المؤكدة

### MEDIUM — الصفر السنوي يُعرض كـ missing/unobserved

- **الملف/السطر:** `Hotspot-hunters/src/features/analytics/analyticsService.ts:161`
- **المشكلة:** بعد طلب ملخص السنة، يضيف الكود `{value: annual.total_detections, missing: annual.total_detections === 0}`. الصفر في عقد summary هو قيمة عددية صالحة، وقد يعني عدم وجود detections في فترة ذات تغطية؛ لا يساوي تلقائيًا `missing_or_unobserved`.
- **الأثر:** `Analytics.tsx:26` يعرض النقطة كـ `Unavailable / unobserved` ويقطع الخط، كما يطلق السطر 163 تحذيرًا عن غياب التغطية. بذلك يتغير معنى backend إلى معنى علمي مختلف، وتصبح مقارنة السنوات مضللة خصوصًا للفترات الخالية فعليًا من records.
- **الإصلاح المقترح:** لا تعيّن `missing` من قيمة `total_detections`. استخدم حالة جودة/تغطية صريحة مرتبطة بنفس الفترة، أو اترك النقطة `0` مع وسم `reported zero` منفصل. لا تستنتج missingness من العد وحده.

### MEDIUM — تصدير CSV لا يحترم نطاق التاريخ النشط

- **الملف/السطر:** `Hotspot-hunters/src/App.tsx:75`
- **المشكلة:** رابط `getCsvDownloadUrl` يُبنى من بداية شهر `year/month` ونهاية `monthRange(year,month).endDate`، بينما البيانات النشطة في نفس المكوّن تستخدم `activeDates` التي قد تكون نطاقًا مخصصًا من Analytics/Data Explorer.
- **الأثر:** بعد تطبيق نطاق مثل `2026-11-06..2026-11-13`، زر CSV يرسل الشهر الكامل. هذا لا يطابق اختيار المستخدم، وقد يحمّل records خارج النطاق المعروض. وجود نص تحذير عن حد 50,000 لا يعالج اختلاف التصفية. العيب مؤكد من مسار بناء URL؛ لم أجرِ تنزيلًا حيًا.
- **الإصلاح المقترح:** مرّر `activeDates.startDate` و`activeDates.endDate` إلى URL. إن كان الرابط backend لا يدعم كل مرشحات Explorer المحلية، يجب إخفاؤه أو تسميته بوضوح كـ export للنطاق backend فقط، مع إبقاء export المحلي الحالي هو الخيار المطابق للمرشحات.

### MEDIUM — المدخلات غير الصالحة تتحول إلى 500 بدل خطأ عقدي نظيف

- **الملفات/الأسطر:** `backend/app/api/v1/summary.py:29-40`، `backend/app/api/v1/quality.py:34-45`، `backend/app/api/v1/calendar.py:34-45,100-103`، `backend/app/api/v1/map.py:56-67,89-92`
- **المشكلة:** المسارات تبني `AnalysisRequest` أو تنفّذ الاستعلام داخل `try` واسع ثم تمسك كل `Exception` وتعيد 500. قيم sensor غير صالحة أو تواريخ malformed، وهي أخطاء input متوقعة، يمكن أن تصل إلى هذا الفرع بدل 422 موحّد. تقرير Phase 3A الموجود يوثق نفس السلوك (`LANDSAT` و`not-a-date`).
- **الأثر:** المستهلك المباشر لا يستطيع التمييز بين invalid selection وserver failure، وقد تتعرض retries غير اللازمة. عميل الواجهة يعطي رسالة عامة آمنة لـ 500، لكنه لا يصلح عقد backend غير الصحيح.
- **الإصلاح المقترح:** استخدم نماذج/validators صريحة للتاريخ والحساس والمنطقة قبل الاستدعاء، اترك أخطاء validation كـ 422، وحوّل أخطاء المجال المعروفة إلى envelope ثابت. لا تلتقط `ValidationError` أو أخطاء المجال في catch عام يعيد 500.

### MEDIUM — تسريب تفاصيل الاستثناء من مسارات 500

- **الملفات/الأسطر:** `backend/app/api/v1/map.py:91-92`، `backend/app/api/v1/summary.py:39-40`، `backend/app/api/v1/quality.py:44-45`، `backend/app/api/v1/calendar.py:102-103`
- **المشكلة:** بعض المسارات تعيد `str(exc)` مباشرة في `HTTPException.detail` أو الرسالة. قد يحتوي ذلك على تفاصيل داخلية لمسار DuckDB/Parquet أو validation implementation.
- **الأثر:** عميل الواجهة الحالي يخفي body ويعرض رسالة عامة من `src/data/http.ts:11`، لذلك لا أعدّ هذا تسريبًا ظاهرًا في UI الحالي. لكنه عيب مؤكد في عقد HTTP العام وأي مستهلك آخر للbackend، ويزيد صعوبة ضمان رسائل آمنة.
- **الإصلاح المقترح:** سجّل التفاصيل داخليًا بمعرّف correlation، وأعد رسالة عامة ثابتة للمستهلك. خصّص رسائل domain/validation المعروفة دون تمرير exception text الخام.

### LOW — حارس الثقة لا يطابق كامل العقد الأصلي

- **الملف/الأسطر:** `Hotspot-hunters/src/data/normalize.ts:10,16-17`
- **المشكلة:** حارس MODIS يتحقق من كون `confidence` رقمًا ضمن 0..100، لكنه لا يفرض `Number.isInteger`. كما أن `confidenceLevel` يمر عبر `optional()` كسلسلة نصية عامة دون تقييدها إلى `low|nominal|high`، مع أن العقد والـ backend يقدمان قيمًا مقيدة.
- **الأثر:** استجابة malformed مثل MODIS `confidence: 77.5` أو `confidenceLevel: "made-up"` يمكن أن تدخل الجدول/التصدير كأنها قيمة أصلية موثوقة. لم تظهر هذه القيم في fixture المتحقق؛ هذه فجوة حارس ثابتة وليست حالة runtime مثبتة.
- **الإصلاح المقترح:** ارفض MODIS confidence غير الصحيح integer، وطبّق enum للحقل عند وجوده؛ اترك الحقل null فقط إن كان غائبًا/فارغًا وفق العقد.

## مخاطر محتملة غير مثبتة عبر التنفيذ المتحقق

### LOW — مسار HTTP ذي body غير قابل للقراءة يتجاوز حد الحجم

`src/data/http.ts:12-14` يفحص `content-length` ويفرض حد bytes أثناء streaming عندما يعيد `response.body.getReader()`. أما فرع `else` فيستخدم `response.text()` كاملًا دون عدّ bytes. في Fetch browser المعتاد تكون الاستجابة قابلة للقراءة، لذلك لم أجد دليلًا على وقوع ذلك في Chrome المتحقق؛ لكنه مسار دفاعي ناقص في client/fixtures.

### LOW — حراسة بعض استجابات التحليل والتقويم سطحية

`src/data/apiClient.ts:15-18,22` و`src/features/analytics/analyticsService.ts:66-83` تتحقق من طول arrays وبعض الأرقام، لكنها لا تتحقق مثلًا من `selected_month/year/region/sensors` أو كامل حقول `AnalysisResponse`. قد تسمح استجابة structurally ناقصة بتسميات `undefined` أو metadata غير متسقة. لم تُثبت الأدلة المتاحة استجابة malformed بهذه الصورة، لذا أتعامل معها كتحسين guard لا كحادث مؤكد.

## ما تم اجتيازه في القراءة الساكنة

- إعداد API لا يضع credential في الواجهة، والافتراضي `/backend-api` متوافق مع Vite proxy في `vite.config.ts:3`.
- `createHttpClient` يميز HTTP/422، network، timeout، schema وsize برسائل عامة، ولا يعرض body الخام في UI (`src/data/http.ts:11-16`).
- حد الاستجابة المعلن والمقروء streaming موجود، وحد map في config هو 5,000، وحد repository المسموح 20,000؛ لا يوجد اختراع page/offset/cursor (`src/data/config.ts:2`, `src/data/repositories/api.ts:8-9`).
- `normalizeCollection` يرفض FeatureCollection غير الصالحة، يحتفظ بالأصل، يرفض السجل الاصطناعي في real mode، يرفض تعارض geometry/properties، ويضع partial/warning عند records مرفوضة أو بلوغ الحد (`src/data/normalize.ts:19-26`).
- اختيار الحساسات والتاريخ يمرّر كـ repeated query params ويُرفض empty-sensor في summary/quality/analyze بدل تحويله إلى كل الحساسات (`src/data/apiClient.ts:9,20-22`; `tests/empty-sensors.test.ts`).
- لا يوجد fallback صامت إلى demo في failure أو empty real؛ `useObservationData` يختار repository حسب mode ويضع error/empty صريحًا (`src/features/observations/useObservationData.ts:11-17`).
- حماية اللقطات وإلغاء الطلب موجودة في hook وفي Analytics وLab؛ state القديمة لا تُعرض عند تغيّر المفتاح (`useObservationData.ts:11-16`, `Analytics.tsx:55-60`, `HarmonizationLab.tsx:121-140`).
- Analytics real يستخدم summary/quality/calendar وbounded analyze، ولا يجلب raw observations لإنشاء aggregate، ويعرض caveat للـ 50,000 وحدود التغطية (`analyticsService.ts:133-140,159-170`).
- MODIS وVIIRS لا يُدمجان في confidence score واحد؛ المختبر يميز الحالات implemented/conceptual/planned ولا يدّعي harmonized output (`harmonization/model.ts:19-83`, `HarmonizationLab.tsx:143-150`).
- Data Explorer يعلن صراحة أن search/FRP/confidence/day-night/export تعمل على loaded bounded subset، ويصدر كل filtered loaded records لا صفحة واحدة، مع partial warning (`DataExplorer.tsx:74,80-82`).
- fixtures والاختبارات تغطي empty، malformed JSON، timeouts/network، response-size streaming، geometry، native confidence، duplicate/partial، leap dates، limits، وعدم pagination؛ لم أعِد تشغيلها وفق تعليمات المهمة.

## القيود

- هذه مراجعة static فقط؛ لم أشغّل build/tests ولم أستخدم browser أو endpoints، واعتمدت على نتائج التنفيذ الموثقة مسبقًا في تقارير Phase 3A/3B التي قدمها المشروع.
- لم أعدّل backend أو frontend، ولم أتحقق من سلوك العيوب تحت بيانات live. العيوب الموسومة «محتملة» تحتاج fixture إضافيًا أو اختبارًا موجّهًا قبل رفع شدتها.
- لا أعدّ غياب backend pagination/auth/research endpoints، أو حالة harmonization algorithm، عيوبًا في هذا التقرير لأنها قيود عقد موثقة وخارج متطلبات frontend الحالية. كما أن هذا التقرير لا يقيّم أداء build أو browser أو accessibility خارج مسار API/الفشل.

**التوصية ضمن هذا النطاق:** جاهزية مشروطة فقط بعد إصلاح خلط zero/missing ورابط CSV ذي النطاق الخاطئ، ثم توحيد 4xx/رسائل backend، وتشديد guards؛ لا أقدّم حكم release شاملًا.
