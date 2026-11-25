---
id: animation-adobe-animate
title: "مبانی انیمیشن با Adobe Animate"
dg-publish: true
public: true
permalink: /animation/adobe-animate/
group: انیمیشن
contentClasses: animation-lesson
dgShowTags: false
dg-path: "انیمیشن/۰۵ نرم‌افزار و ارائه/01-adobe-animate.md"
kind: guide
categoryId: fundamentals
aliases: ["Adobe Animate","timeline","symbol","tween"]
tags: [انیمیشن]
created: 2026-11-26
updated: 2026-11-26
description: "آشنایی عملی با سند، Stage، Timeline، ابزار طراحی، Symbol، Library و Tween در Animate."
---
Adobe Animate برای انیمیشن دوبعدی برداری، طراحی فریم‌به‌فریم و حرکت عناصر گرافیکی کاربرد دارد. در پروژه‌ای که خروجی تعاملی یا انیمیشن دوبعدی نیاز دارد، امکاناتش مناسب‌اند؛ برای نقاشی سه‌بعدی یا ریگ پیچیدهٔ فضایی ابزار دیگری لازم است. نام گزینه‌ها ممکن است با نسخه و نوع سند فرق کند.

## آماده‌سازی سند و رابط

سند را با اندازهٔ خروجی، نرخ فریم و نوع خروجی مناسب بساز. Stage محدودهٔ قابل‌دیدن، Timeline زمان و Layers ترتیب عناصر را مشخص می‌کنند. Properties تنظیمات انتخاب فعلی را نشان می‌دهد؛ با انتخاب یک شیء، لایه یا سند، محتوای آن تغییر می‌کند. مسیر بالای Stage مشخص می‌کند داخل Scene هستی یا در حال ویرایش یک Symbol تو‌در‌تو. همیشه قبل از تغییر اجزا محل ویرایش را بررسی کن.

<figure class="animation-study-figure"><a class="figure-open" aria-label="بزرگ‌نمایی شکل 1" href="/img/user/animation/animate-interface.svg" target="_blank" rel="noopener"><img src="/img/user/animation/animate-interface.svg" width="960" height="660" loading="lazy" decoding="async" alt="ساختار رابط Animate؛ شمای آموزشی Stage، Properties، Library و Timeline"></a><figcaption>شکل 1 · شمای آموزشی Stage، Properties، Library و Timeline</figcaption></figure>


## طراحی شکل‌ها

حالت Merge Drawing می‌تواند شکل‌های هم‌پوشان را با هم ادغام کند؛ Object Drawing شکل را به صورت شیء مستقل نگه می‌دارد. قبل از نقاشی تصمیم بگیر اجزای حرکت باید جدا بمانند یا یکی شوند. با Brush برای خطوط آزاد و Shape tools برای فرم‌های هندسی شروع کن. ابتدا فرم اصلی و سیلوئت، سپس جزئیات را بساز.

## Library و Symbol

Library محل نگهداری دارایی‌های تکرارپذیر است. Symbol یک تعریف مشترک دارد و Instance نمونه‌ای از آن روی Stage است. تغییر تعریف روی نمونه‌ها اثر می‌گذارد، اما تغییر Transform نمونه فقط همان نمونه را تغییر می‌دهد. Graphic Symbol و Movie Clip رفتار زمانی متفاوت دارند؛ برای سنجش هماهنگی با تایم‌لاین و خروجی، نوع مناسب را انتخاب کن. نقطهٔ ثبت و نقطهٔ چرخش را قبل از انیمیت تنظیم کن.

## Timeline و Tween

Frame معمولی وضعیت موجود را ادامه می‌دهد، Keyframe نقطه‌ای برای تغییر و Blank Keyframe قاب خالی مستقل می‌سازد. برای حرکت سادهٔ یک Symbol، در بازهٔ زمانی ابتدا و انتها را مشخص و Motion Tween یا Classic Tween را متناسب با پروژه اعمال کن. Shape Tween برای تغییر شکل‌های قابل سازگاری است و با Symbol معمولی یکسان نیست. میان‌گذاری خودکار جای طراحی بریک‌داون را نمی‌گیرد؛ در صورت نیاز پز میانی و easing را دستی تعیین کن.

## تمرین

در یک سند ۲۴fps، یک مربع را به Symbol تبدیل کن. در فریم ۱ سمت راست، در فریم ۲۵ سمت چپ قرار بده تا یک ثانیه فاصلهٔ زمانی داشته باشی. یک نسخه با سرعت ثابت و نسخه‌ای با شروع و پایان نرم بساز. خروجی ویدئویی یا HTML5 را مطابق نوع سند بررسی کن و فایل FLA را به‌عنوان نسخهٔ قابل‌ویرایش نگه دار. از [[animation-motion-easing|منحنی‌های حرکت]] و [[animation-frame-by-frame|کی‌فریم‌گذاری]] برای درک تفاوت خروجی‌ها استفاده کن.


## ادامهٔ مطالعه

[[animation-index|بازگشت به مسیر آموزش انیمیشن]]

## منبع و اعتبار

[adobe animate basics — Mister Chad](https://mister-chad.com/animation/adobe%20animate%20basics) — مرجع موضوعی: Chad Bennett. متن و نمودارهای آموزشی این درس مستقل تدوین شده‌اند.
