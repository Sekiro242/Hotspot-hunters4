# Phase 3B — تكامل API الحقيقي

اعتمد التنفيذ على تقرير 3A وroutes/models/OpenAPI المحلي فقط. لا تعديل باك، ولا keys في الفرونت، ولا endpoint/response مختلق. `contracts.ts` مُستخرج من OpenAPI؛ `http.ts` مسؤول عن timeout/cancellation/HTTP/JSON/response-size safe errors؛ `normalize.ts` يتحقق من geometry/date/time/native confidence/FRP وprocessing وmetadata، ويرفض synthetic records في real mode ويحفظ originalProperties. القيم الناقصة تبقى null ولا تُfabricate. GeoJSON geometry يجب أن يتفق مع properties.

الديمو موجود خلف repository وموسوم بوضوح، وreal/demo اختيار صريح default demo وليس نتيجة health. failure وempty لا يعرضان synthetic fallback. snapshot key/cancellation يمنعان data race وstale records، والتقويم يعتمد نفس source في App وليس جلبًا مستقلًا مع fallback مختلف. labels وScience وتفاصيل الملاحظة تتبع actual source. timestamp العرض اسمه «Fetched» وهو client time وليس source last-updated لأن الباك لا يقدمه.

## endpoints

`GET /api/v1/map/geojson` مع region/date range/repeated sensors وlimit=5000 افتراضي للخريطة؛ count عند الحد يظهر bounded/partial warning وليس total. `GET /api/v1/calendar` مع صفر-الفهرسة لشهر التقويم. `GET /api/v1/summary` و`quality` و`POST /api/v1/analyze` raw فقط مُجهزة كخدمات typed للصفحة التالية؛ تُختبر عند استهلاكها. metadata sensors/methodology helper وhealth موجودان، لكن health لا يقرر source. CSV backend link date/sensor/region فقط وآخر يوم حقيقي بالشهر؛ الحد 50,000 والـsource_product غير موجود فيه معلنان في عنوان الرابط. في Phase 5 سيكون تصدير filtered bounded records محليًا هو المسار الآمن لأنه يحفظ provenance والفلاتر الإضافية.

لم نربط `/map/tiles` لأنه envelope placeholder، ولا harmonized outputs لأن validation غير مثبتة، ولا jobs لأن النطاق الحالي لا يطلب تحليلًا يتجاوز 366 يومًا، ولا research/auth/pagination غير الموجودة.

## نتائج المتصفح الحالية

`api-browser.mjs` على Chrome 1440×900: 10/10 فحوص ناجحة، بدون page errors. demo لا يرسل observation requests؛ actual fixture normalization؛ queries الفعلية بتواريخ صحيحـة وsensors متكررة دون page مختلق؛ real-empty يبقى فارغًا؛ HTTP500 يبقى error ويخفي previous dataset ولا يكشف تفاصيل داخلية؛ retry؛ network failure؛ delayed response لا يستبدل mode الأحدث؛ Science provenance؛ actual local backend يعمل عبر configured Vite proxy. الصور والأدلة في `.work/phases/phase3b`.

البناء بعد الدمج ناجح؛ اختبارات الديمو/repository الحالية 5/5. الاختبارات المستقلة الموسعة لعميل API ما زالت تُجمع ويُسجل عددها عند إغلاق البوابة. لا ادعاء اكتمال الفيزس اللاحقة هنا.

## حدود موثقة

لا pagination ولا stable server sorting/search/FRP/confidence/daynight filtering. أي فلاتر إضافية لاحقًا تُطبق فقط على subset محمل ومُعلن، وليس كامل قاعدة البيانات. server summary/calendar نفسهما يحسبان بحد 50,000 غير مُعلن في API metadata، لذلك dashboard يوضح bounded backend aggregation لا scientific population total عند بلوغ الحد. region property قد تكون global من ingestion رغم query region؛ ليست دليل membership. missing/unobserved ليست صفر حرائق، وzero لا يثبت coverage. CORS permissive يظل قيد production خارج نطاق تعديل الفرونت.

## إغلاق بوابة التكامل

اختبارات مستقلة `tests/api.test.ts`: 17/17 ناجحة تشمل HTTP422/503، network/timeout/external cancellation، declared+streamed response-size limits، malformed JSON، geometry/native confidence/null/provenance، duplicate/partial/all-invalid/synthetic rejection، leap dates، invalid filters، forwarding وbounded limit وcalendar contract. إجمالي `npm test`: 22/22. `npm run build`: ناجح 5.96 ثانية. regression المتصفح الأصلي نجح بالكامل للـdesktop/mobile/navigation/globe/region/sensors/timeline/calendar/compare/science/projection وimagery failure، وصفر console/page errors. لذلك بوابة Phase3B مجتازة ضمن هذه الأدلة؛ لا ادعاء أن قدرات الباك الناقصة أصبحت موجودة.
