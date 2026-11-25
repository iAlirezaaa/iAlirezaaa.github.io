---
id: animation-ball-1
title: "توپ جهنده؛ بخش اول: سقوط عمودی"
dg-publish: true
public: true
permalink: /animation/ball-1/
group: انیمیشن
contentClasses: animation-lesson
dgShowTags: false
dg-path: "انیمیشن/۰۲ حرکت و تمرین/05-ball-1.md"
kind: guide
categoryId: fundamentals
aliases: ["Bouncing ball","vertical drop","squash stretch"]
tags: [انیمیشن]
created: 2026-11-26
updated: 2026-11-26
description: "تمرین بنیادی زمان‌بندی، فاصله‌گذاری، فشردگی و کاهش ارتفاع جهش."
---
تمرین توپ جهنده ساده به نظر می‌رسد، اما برای فهم وزن و تغییر سرعت بسیار مهم است. هدف این نیست که توپ را از A به B منتقل کنی؛ باید نیروی گرانش، برخورد با زمین و از دست رفتن انرژی خوانده شود.

## مرحلهٔ اول: زمان‌بندی سقوط

نقطهٔ شروع، تماس با زمین و اوج جهش بعدی را طراحی کن. اگر توپ از حالت سکون رها شود و شتاب تقریباً ثابت باشد، فاصله‌های مکانی با گذر زمان بزرگ‌تر می‌شوند. برای مدل سادهٔ فیزیکی، فاصلهٔ سقوط از حالت سکون برابر نصف شتاب گرانش ضربدر مربع زمان است. در یک انیمیشن ۲۴fps می‌توان فریم‌های نزدیک به اوج را متراکم‌تر و نزدیک برخورد را دورتر قرار داد.

<figure class="animation-study-figure"><a class="figure-open" aria-label="بزرگ‌نمایی شکل 1" href="/img/user/animation/vertical-spacing.svg" target="_blank" rel="noopener"><img src="/img/user/animation/vertical-spacing.svg" width="960" height="650" loading="lazy" decoding="async" alt="زمان‌بندی سقوط عمودی؛ نمونه‌گیری در فاصله‌های زمانی برابر"></a><figcaption>شکل 1 · نمونه‌گیری در فاصله‌های زمانی برابر</figcaption></figure>


## مرحلهٔ دوم: فشردگی و کشیدگی

در مسیر سریع رو به پایین، کشیدگی را در راستای حرکت به‌صورت کنترل‌شده استفاده کن. در لحظهٔ برخورد با زمین، توپ نرم پهن می‌شود و بلافاصله برای بازگشت کشیده می‌شود. نقطهٔ تماس با زمین نباید داخل سطح نفوذ کند. حجم ظاهری را تا حد امکان ثابت نگه دار. برای توپ سنگی، تغییر شکل بسیار کمتر و واکنش برخورد متفاوت است.

<figure class="animation-study-figure"><a class="figure-open" aria-label="بزرگ‌نمایی شکل 2" href="/img/user/animation/squash-stretch.svg" target="_blank" rel="noopener"><img src="/img/user/animation/squash-stretch.svg" width="960" height="615" loading="lazy" decoding="async" alt="فشردگی و کشیدگی؛ واکنش شکل به جهت حرکت و برخورد"></a><figcaption>شکل 2 · واکنش شکل به جهت حرکت و برخورد</figcaption></figure>


## مرحلهٔ سوم: جهش‌های کاهشی

هر بار برخورد بخشی از انرژی مکانیکی به صدا، گرما و تغییر شکل منتقل می‌شود. ارتفاع اوج جهش‌های بعدی کم‌تر و مدت پرواز کوتاه‌تر می‌شود. در مدل ایده‌آل ضریب بازگشت e سرعت بعد از برخورد را نسبت به سرعت پیش از برخورد تعیین می‌کند؛ نسبت ارتفاع دو جهش پیاپی تقریباً e² است. برای مثال اگر e برابر ۰٫۷ باشد، ارتفاع بعدی حدود ۴۹٪ ارتفاع قبلی است. این مدل ساده مقاومت هوا و جزئیات برخورد را در نظر نمی‌گیرد.

<figure class="animation-study-figure"><a class="figure-open" aria-label="بزرگ‌نمایی شکل 3" href="/img/user/animation/diminishing-bounces.svg" target="_blank" rel="noopener"><img src="/img/user/animation/diminishing-bounces.svg" width="960" height="600" loading="lazy" decoding="async" alt="جهش‌های کاهشی؛ نمودار شماتیک ارتفاع در طول زمان"></a><figcaption>شکل 3 · نمودار شماتیک ارتفاع در طول زمان</figcaption></figure>


## زمان‌بندی پیشنهادی برای یک تمرین

فریم ۱: اوج اولیه؛ فریم ۱۳: تماس اول؛ فریم ۲۲: اوج دوم؛ فریم ۳۱: تماس دوم؛ فریم ۳۷: اوج سوم؛ فریم ۴۳: تماس سوم. این فقط الگوی تمرینی است؛ با توجه به جنس و ارتفاع تغییرش بده. وضعیت نهایی باید بدون لرزش غیرمنطقی به سکون برسد.

## معیار بازبینی

در نمایش آهسته فاصله‌ها را کنترل کن؛ در سرعت واقعی بپرس آیا جنس توپ قابل تشخیص است. از فریم تماس برای رفع نفوذ به زمین استفاده کن. بعد از تکمیل نسخهٔ عمودی، [[animation-ball-2|تمرین حرکت روی قوس]] را انجام بده. برای علت تغییر شکل به [[animation-principles|اصول انیمیشن]] برگرد.


## ادامهٔ مطالعه

[[animation-index|بازگشت به مسیر آموزش انیمیشن]]

## منبع و اعتبار

[bouncing ball - part one — Mister Chad](https://mister-chad.com/animation/bouncing%20ball%20-%20part%20one) — مرجع موضوعی: Chad Bennett. متن و نمودارهای آموزشی این درس مستقل تدوین شده‌اند.
