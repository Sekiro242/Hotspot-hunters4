# تشغيل Hotspot Hunters محليًا

الكود المعدّل موجود في `D:\Hotspot hunters2\Hotspot-hunters`، والباك الأصلي في `D:\Hotspot hunters2\backend`. لم يُرفع الكود ولم يُنشر. عناوين التشغيل الحالية على **نفس جهازك**: [الفرونت](http://127.0.0.1:5173)، [production preview](http://127.0.0.1:4173)، و[وثائق الباك](http://127.0.0.1:8000/docs).

## بدء التشغيل من جديد

لو الخدمات تعمل، افتح العنوان فقط؛ لا تبدأ نسخة ثانية على نفس المنفذ. لو أُغلقت، افتح PowerShell في فولدر المشروع وشغّل الباك في terminal مستقل:

```powershell
Set-Location 'D:\Hotspot hunters2'
$env:PYTHONPATH='D:\Hotspot hunters2\backend'
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

لا تستبدل `.env` الموجود ولا تضع FIRMS_MAP_KEY في الفرونت. الباك يجب أن يملك بيانات Parquet ليعرض real observations؛ تفعيل Backend mode لا يشغّل ingestion تلقائيًا. راجع وثائق ingestion الموجودة في المشروع إذا أردت تحديث المصدر، فهذا ليس جزءًا من تغيير الفرونت.

في terminal ثانٍ:

```powershell
Set-Location 'D:\Hotspot hunters2\Hotspot-hunters'
npm run dev -- --port 5173 --strictPort
```

Dependencies مثبتة حاليًا. فقط إن لم تكن موجودة عند تشغيل نسخة أخرى من المشروع، استخدم `npm ci` قبل التشغيل. أغلق الخادم من نفس terminal بـCtrl+C، ولا تحذف source أو `.env` لإعادة التشغيل.

للـproduction preview:

```powershell
Set-Location 'D:\Hotspot hunters2\Hotspot-hunters'
npm run build
npm run preview -- --port 4173 --strictPort
```

الـpreview محلي أيضًا، ويحتاج الباك على 8000 لأن `/backend-api` يمر عبر proxy. البناء ليس نشرًا. لا تفتح `dist/index.html` عبر `file://`؛ استخدم خادم preview.

## أين الصفحات الجديدة؟

Explore وTime وCompare وThe Science ما زالت في التنقل الرئيسي. قائمة **RESEARCH** تفتح Analytics وData Explorer وResearch Workspace وHarmonization Lab. كل صفحة لها scroll داخلي عندما يكون المحتوى أطول من المساحة، خصوصًا على الموبايل. شريط DATA SOURCE في أسفل الصفحة يغيّر صراحة بين Synthetic demo وBackend / FIRMS.

للعرض المحلي: ابدأ بالديمو للتنقل بين كل المشاهد دون انتظار استعلامات كبيرة. لا تقدمه على أنه داتا NASA. لإظهار المصدر الحقيقي، اختر Backend / FIRMS واستخدم فترة موجودة في الباك؛ فُحص النطاق `2026-11-06` إلى `2026-11-13` فعليًا. التواريخ ليست وعدًا بتحديث يومي. نطاقات واسعة قد تكون أبطأ أو empty أو partial، وRetry أو نطاق أقصر هما المساران المعلنان.

في Analytics استخدم Apply range لتغيير الفترة العالمية. الرسوم تعرض raw counts بوحداتها، ومعها View chart values/View accessible data table. ملخص FRP per-sensor sum أو day/night الذي لا يقدمه الباك يظهر Unavailable. التقويم التاريخي للشهر ليس إجمالي السنة؛ yearly totals لها summaries مستقلة.

في Data Explorer، date/region/sensors فلاتر عالمية، وFRP/day-night/native confidence/processing/search فلاتر المجموعة المحملة. الفرز وpagination محليان على حد 5,000 record؛ المقارنة بين confidence MODIS numeric وVIIRS categorical لا تتم على score واحد. Details يفتح السجل، وFocus map يعرض نفس الـID/coordinates ويبرز الملاحظة، والعودة للجدول تحفظ فلاتره.

Export all filtered CSV/GeoJSON يصدّر **كل السجلات المفلترة المحملة** لا الـ25 row الظاهرة فقط. الحد 10MB؛ يُعرض خطأ عند تجاوزه بدل truncation. رابط Backend CSV في footer مستقل: يطبق التاريخ/المنطقة/المستشعرات فقط، لا فلاتر Explorer المحلية، وبحد backend 50,000.

Research يحفظ selection ووصفته وnotes محليًا، لا نتيجة محسوبة أو حسابًا خادميًا. Apply to parent يعيد الإعدادات صراحة؛ Reopen/Edit/Save/Duplicate/Delete تعمل على المكتبة المحلية. الرابط المشترك يفتح snapshot كمسودة للمراجعة؛ لا يطبقها ولا يحفظها فوق دراسة أخرى تلقائيًا. لا تضع اعتماديات أو معلومات سرية في notes المراد مشاركتها.

LocalStorage مرتبط بالـorigin؛ مكتبة `5173` لا تظهر تلقائيًا في `4173` أو متصفح آخر. استخدم نفس origin للعرض وحفظ الدراسات، أو افتح snapshot link على الـorigin المقصود وراجعه ثم احفظه. حذف بيانات المتصفح قد يمحو الدراسات؛ الرابط لا يمثل server backup.

Lab يشرح المراحل السبع ويقرأ metadata الباك في real mode. Calibration وIndependent validation ليست pipeline مثبتة هنا؛ لا زر ينتج harmonized index وهميًا. يمكن إرسال methodology notes إلى Research مع المصدر الحالي.

## إعداد URL آمن

الافتراضي هو `/backend-api` إلى `http://127.0.0.1:8000`. لتغيير السيرفر المحلي في التطوير، ضع **عنوان الباك فقط** في ملف الفرونت `.env.local`:

```dotenv
DEV_BACKEND_URL=http://127.0.0.1:8000
VITE_API_URL=/backend-api
```

أعد تشغيل Vite بعد التغيير. إذا اخترت URL مباشرًا بدل proxy، يجب أن يدعم الباك CORS لذلك origin. أي قيمة تبدأ بـVITE متاحة للمتصفح: **لا تضع API keys أو secrets في هذه المتغيرات**. template آمن موجود في `Hotspot-hunters/.env.example`.

## إعادة الاختبارات

داخل فولدر الفرونت:

```powershell
npm run build
npm test
npm run test:browser
```

الأمر الأخير يحتاج Chrome مثبتًا وخادم Vite على 5173. يحفظ الأدلة داخل `D:\Hotspot hunters2\.work\browser-smoke` وليس داخل source. يمكن ضبط URL للاختبار العام، لكن اختبار الديمو والخريطة يحتاج نفس إعدادات التطبيق:

```powershell
$env:HOTSPOT_TEST_URL='http://127.0.0.1:5173'
npm run test:browser
Remove-Item Env:HOTSPOT_TEST_URL
```

نتائج آخر تسليم: build ناجح، 58/58 unit checks، browser smoke ناجح. QA الإضافي والـWCAG/قياسات production موثق في [تقرير الجاهزية](phase-reports/release-readiness.md)، والـscripts والأدلة في `.work/phases` محفوظة للمتابعة. أداة axe الخاصة بالتدقيق مثبتة في `.work/tools/qa` وليست dependency إضافية للتطبيق.

اختبارات الباك تحتاج عزل إعداد المفتاح في **عملية الاختبار** كي لا يستخدم اختبار missing-key الاعتماد المحلي. هذا الأمر لا يعدّل الملف أو الباك الجاري:

```powershell
Set-Location 'D:\Hotspot hunters2'
$env:PYTHONPATH='D:\Hotspot hunters2\backend'
@'
from app.config import settings
settings.FIRMS_MAP_KEY = None
import pytest
raise SystemExit(pytest.main(['backend/tests', '-q', '--log-disable=httpx']))
'@ | python -
```

آخر نتيجة: 38/38 مع warning deprecation واحد. تشغيلها من دون هذا العزل يعطي فشل missing-key المعروف منذ خط الأساس. لا تشارك HTTP backend logs الخام؛ بعضها قد يحتوي URL حساسًا.

## قبل مشاركة المشروع خارج الجهاز

`.env` لم يعد متتبعًا في index والملف المحلي محفوظ، لكن history الأصلية ما زالت قد تحتويه. تدوير الاعتمادات ومعالجة التاريخ مطلوبان قبل أي push/public sharing. لم أعد كتابة Git history أو أدوّر مفتاحًا أو أنشر شيئًا. لا ترفع `.work` أو raw logs أو `.env`، ولا تستخدم metadata تعليمية في Lab كدليل أن النظام ينتج harmonized results.
