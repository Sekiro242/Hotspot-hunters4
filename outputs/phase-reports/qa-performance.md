# QA مستقل — الأداء ودورة حياة الذاكرة

**النطاق:** `src/map/Earth.tsx` و`src/map/layers.ts` وReact hooks، lazy feature chunks، طلبات API وإلغاؤها، البحث المؤجل، paging، وسلامة التصدير.

**نوع الفحص:** مراجعة ساكنة للمصدر مع قراءة أدلة وتقارير Phases 2 و4 و5 وتقارير البناء الحالية. لم أشغّل browser أو build أو npm أو tests أو server، التزامًا بطلب عدم التنافس على البيئة المشتركة.

## الخلاصة

الحالة: **جاهز بشروط / Conditionally Ready** لهذا النطاق. لا يوجد عيب Critical أو High مؤكد في الفحص الساكن، ولا يوجد دليل كافٍ لإعلان غياب تسرب ذاكرة بنسبة 100%. دورة حياة MapLibre الأساسية والإلغاء وحماية stale responses مصممة بصورة جيدة، كما أن الـlazy chunks والتقسيم المحلي والتصدير bounded موجودة. لكن توجد أربع inefficiencies مؤكدة على مستوى الكود تستحق الإصلاح قبل اعتبار الأداء محكمًا: تكرار طلب التقويم في صفحة Analytics، إبطال فعالية deferred search بسبب إعادة بناء كائن الفلاتر، إدخال metadata الخام في مصدري GeoJSON للخريطة، وذروة ذاكرة غير مثلى أثناء التصدير.

## النتائج المؤكدة

### 1. طلب تقويم مكرر عند استخدام Analytics — متوسط

- **الملف/الأسطر:** `src/App.tsx:33`، `src/features/observations/useObservationData.ts:11-13`، `src/features/analytics/analyticsService.ts:159`
- **المشكلة:** `App` يشغّل `useObservationData` دون شرط على المشهد، والـhook يشغّل دائمًا `repository.load` و`repository.calendar`. عند وضع real، صفحة Analytics تشغّل في الوقت نفسه `client.getCalendar` ضمن `Promise.all`. لذلك لنفس `region/date/sensors` يوجد مسار تقويم عالمي ومسار Analytics مستقل، من دون طبقة in-flight/cache dedupe مشتركة. عند تغيير الفلاتر يتكرر ذلك مع بقية طلبات Analytics؛ وعند فتح Analytics لا تكون نتيجة تقويم الـhook قابلة لإعادة الاستخدام من الخدمة.
- **الدليل/التعليل:** السطر 33 في `App` يستدعي الـhook بصرف النظر عن `scene`. السطران 11-13 في الـhook يبدآن الطلبين لكل key. السطر 159 في خدمة Analytics يبدأ طلب `getCalendar` آخر لنفس query. هذا استنتاج call-graph ساكن، وليس ادعاءً بعدد requests رُصد في المتصفح.
- **الإصلاح المقترح:** رفع نتيجة التقويم إلى مصدر مشترك وتمريرها إلى Analytics، أو إضافة request/cache layer keyed by endpoint + canonical query مع إدارة lifetime/ref-count للإلغاء. يجب توحيد ترتيب `sensors` في المفتاح قبل dedupe. لا ينبغي مشاركة Promise ملغاة مع مستهلكين غير تابعين لها بلا سياسة واضحة.

### 2. `useDeferredValue` لا يؤجل كامل كلفة البحث — متوسط

- **الملف/الأسطر:** `src/features/data-explorer/DataExplorer.tsx:34-35,47-50`، و`src/features/data-explorer/model.ts:31-35,37-54`
- **المشكلة:** `deferredSearch` مؤجل، لكن `effectiveFilters` يعتمد على كائن `props.filters` كاملًا وينسخه كلما تغيّر نص البحث. وبذلك يتغير `effectiveFilters` في كل ضغطة مفتاح حتى عندما لم يتغير `deferredSearch` بعد، فتُعاد `filterRecords` عبر كل السجلات قبل اكتمال التأجيل. علاوة على ذلك، كل تطابق بحث يستدعي `JSON.stringify(record.originalProperties)` في `searchableRecord`؛ أي أن كل دورة بحث تنشئ strings مؤقتة بحجم metadata لكل سجل.
- **الدليل/التعليل:** السطر 35 يجعل object memo يتأثر بـ`props.filters` الحي، والسطر 48 يعتمد على `effectiveFilters`. السطر 33 في `model.ts` يعيد stringify للـ`originalProperties`، والسطر 54 يمرر كل `records` إلى filter. هذا عيب كفاءة مؤكد ساكنًا؛ لم أدّعِ زمنًا أو frame-rate محددًا.
- **الإصلاح المقترح:** بناء `effectiveFilters` من الحقول غير البحثية كاعتمادات منفصلة مع `deferredSearch` فقط بدل نسخ كائن الفلاتر الحي، ثم جعل memo الخاص بالترشيح يتغير عند القيمة المؤجلة فقط. أنشئ search index memoized عند تغيّر `records`/metadata، أو خزّن تمثيلًا نصيًا محدودًا بدل `JSON.stringify` للـmetadata الخام في كل مقارنة. يجب إبقاء البحث معلنًا على subset المحمل كما هو حاليًا.

### 3. payload الخريطة يحمل metadata الخام إلى مصدرين — منخفض إلى متوسط

- **الملف/الأسطر:** `src/data/normalize.ts:16-17`، `src/data/observations.ts:32`، `src/map/layers.ts:17-23`
- **المشكلة:** التطبيع يحفظ كامل `properties` القادم من الباك في `originalProperties`. ثم `geojson` ينشر كل حقول `Observation`، بما فيها `originalProperties`، داخل كل feature. `updateObservationLayers` يرسل نفس الـFeatureCollection الكامل إلى مصدري `observations` و`clusters`. الخريطة تحتاج فعليًا إلى geometry و`id` و`sensor` للتفاعل/الرسم؛ تفاصيل metadata محفوظة أصلًا في `recordIndex`/React لتفاصيل السجل.
- **الدليل/التعليل:** السطر 17 يحفظ `{...p}`، والسطر 32 يبني properties من `{...o}`، والأسطر 20-22 يطبقان collection نفسها على مصدرين. هذا يثبت payload زائدًا وتكرارًا محتملًا في نسخ/تحليل MapLibre؛ لا يثبت leak دائمًا ولا يثبت نسبة تضاعف محددة داخل worker.
- **الإصلاح المقترح:** إنشاء map-specific feature projection صغيرة (`id`, `sensor` والحقول الضرورية للرسم فقط) مع إبقاء `originalProperties` خارج GeoJSON. إن احتاجت ألوان clusters إلى sensor aggregation، عرّف cluster properties صراحةً بدل تمرير metadata الخام. أبقِ record lookup في `recordIndex` لتفاصيل الملاحظة.

### 4. التصدير bounded لكنه يسبب ذروة ذاكرة مؤقتة غير مثلى — منخفض

- **الملف/الأسطر:** `src/features/data-explorer/DataExplorer.tsx:58`، `src/features/data-explorer/export.ts:39-47`
- **المشكلة:** `exportRecords` يبني النص الكامل للـCSV أو `JSON.stringify(buildGeoJson(...), null, 2)` أولًا، ثم `downloadText` ينشئ `Blob` جديدًا قبل التنزيل. فحص حد 10MB يحدث داخل `downloadText` بعد اكتمال serialization؛ أثناء النافذة القصيرة قد توجد بنية GeoJSON، النص، وBlob/نسخة browser معًا. هذا ليس bypass لحد الحجم ولا leak مثبتًا، لكنه peak memory غير ضروري، خصوصًا مع `originalProperties` في GeoJSON.
- **الدليل/التعليل:** السطر 58 يكوّن string كاملًا قبل الاستدعاء. السطران 42-45 يطبقان `assertExportSize` ثم ينشئان Blob من النص؛ لذلك لا يمنع الفحص الذروة التي سبقت الفحص.
- **الإصلاح المقترح:** إبقاء الحد الصريح وعدم truncation، لكن قلّل النسخ المؤقتة: تجنب pretty-print في الإنتاج، استخدم serialization على دفعات/Blob chunks مع عدّ bytes، أو نفّذ تقديرًا/حدًا مبكرًا قبل بناء metadata الكبيرة. يجب استمرار revoke للـobject URL كما هو موجود حاليًا.

## ما اجتاز المراجعة الساكنة أو تؤيده الأدلة السابقة

- **دورة حياة MapLibre:** `Earth.tsx:21-48` ينشئ الخريطة داخل effect ثابت، يزيل listeners، يفصل `ResizeObserver`، يمسح cache ويستدعي `map.remove()` عند cleanup، مع `active` guards. الخريطة الثانوية في `Earth.tsx:51-61` لها cleanup مستقل، ومصدر layer cache يُحذف عبر `clearSourceCache`. لا يظهر leak مؤكد من تبديل comparison.
- **جاهزية المصادر والتحديثات:** `layers.ts:6-23` لا يضيف المصادر/الطبقات مرتين، ولا يعيد `setData` إذا كانت مرجعية السجلات نفسها (`WeakMap`)، وتتغير visibility بدل إعادة بناء المصادر. تقرير Phase 2 يوثق أن instrumentation وجد صفر `setData` في layer-only updates؛ اعتمدت ذلك كدليل سابق ولم أعد تشغيله.
- **الإلغاء وstale data:** `useObservationData.ts:11-17` ينشئ `AbortController` لكل key ويلغي السابق في cleanup، ويتحقق من signal/key قبل commit. `http.ts:5-17` يربط signal خارجيًا بمهلة وينظف timer/listener. `Analytics.tsx:55-59` يستخدم active guard وabort، وLab metadata لديه النمط نفسه في `HarmonizationLab.tsx:121-138`.
- **عدم الاستبدال الصامت:** repository الحقيقي لا يعيد demo عند الفشل، والـHTTP client يميز timeout/network/schema/size. هذا متسق مع تقرير Phase 3B، وليس اختبارًا جديدًا مني.
- **التقسيم lazy:** `App.tsx:21-24` يستخدم `lazy()` لـResearch وHarmonization Lab وData Explorer وAnalytics مع Suspense fallbacks. تقرير Phase 2/4/5 يثبت أن chunks المناظرة ظهرت منفصلة. تبقى خريطة MapLibre والـmain bundle كبيرين كما هو معلن؛ لا أعدّ التحذير وحده defect جديدًا دون قياس جديد.
- **Client paging:** `model.ts:88-92` يقيّد page size إلى 1-100 ويقص page index بأمان، و`DataExplorer.tsx:82` يعرض الصفحة الحالية فقط. التصدير يستخدم `filtered` لا `pagination.rows`، ويصرّح بأنه يصدّر كل السجلات المحملة المطابقة.
- **Deferred search/export state:** توجد حماية مقصودة من التصدير أثناء `searchPending` أو `exporting` في `DataExplorer.tsx:58,82`، وحد 10MB وفحص bytes وsafe filenames وrevoke URL في `export.ts:39-50`. الملاحظة أعلاه تخص peak memory، لا فقدان البيانات أو تجاوز الحد.
- **أدلة البوابات السابقة:** Phase 2: اختبارات Chrome الموثقة 14 + edge 4، وصفر page/map errors ضمن السيناريوهات المحددة؛ Phase 4: 11/11؛ Phase 5: 16/16، مع build strict والاختبارات الموثقة في تقاريرها. هذه أدلة تاريخية/مقدمة من التقارير وليست إعادة تشغيل في هذه المراجعة.

## مخاطر محتملة غير مثبتة كعيوب runtime

- التشغيل السريع للـtimeline مؤكد من الكود أنه يغيّر الشهر كل `1600/speed` ms، والسرعة القصوى المعروضة 4x (`Timeline.tsx:5` و`App.tsx:42`). في real mode يطلق كل تغيير تحميل observations وتقويمًا جديدين؛ cancellation يمنع commit للنتيجة القديمة، لكن لا يمكن من المصدر وحده إثبات ما إذا كان backend يوقف العمل بعد client abort. أوصي بقياس request rate قبل فرض debounce أو سياسة prefetch؛ لم أعدّه عيبًا مؤكدًا لأن الجلب لكل شهر جزء مقصود من playback.
- لم أجد في المراجعة الساكنة دليلًا على تسرب دائم بعد تكرار scenes أو comparison. قياس Phase 2 السابق هو snapshot واحد للـheap، والتقرير نفسه ينبه بأنه لا يثبت غياب leak.
- لم أقم بprofiling لحجم `originalProperties`، ولا بقياس وقت filter/export عند 5,000 سجل، ولا بقياس استهلاك MapLibre worker؛ لذلك لا أضع أرقامًا أو ادعاءات أجهزة/دقة/ذاكرة.

## القيود

1. لم أشغّل browser أو build أو npm/tests أو server، ولم أضف credentials أو logging أو hardware/runtime claims.
2. لا يشمل هذا التقرير نقص backend pagination/auth أو server-side search/sort أو harmonization algorithms؛ هذه حدود API موثقة وليست متطلبات frontend ناقصة في هذا النطاق.
3. لا يمكن للمراجعة الساكنة إثبات سلوك كل GPU/جهاز أو أثر إلغاء fetch على الخادم.
4. لا يوجد تعديل على المصدر؛ الملف الوحيد الناتج هو هذا التقرير.

## توصية الإصدار

**Conditionally Ready.** أصلح النقاط الأربع، وبالأولوية: dedupe/رفع تقويم Analytics، ثم إصلاح dependencies الخاصة بالبحث المؤجل وفهرسة metadata. بعد ذلك يكفي profiling موجّه واحد على real bounded response وexport قريب من الحد قبل إعلان أداء نهائي؛ لا حاجة لإعادة بناء أو تغيير MapLibre.