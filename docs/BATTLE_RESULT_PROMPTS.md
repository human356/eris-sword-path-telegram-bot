# پرامپت‌های عکس نتیجهٔ نبرد (English prompts)

بعد از پیروزی در نبرد، ربات روی **آخرین گزارش راند ریپلای** می‌زند و یک **عکس نتیجه** می‌فرستد:

```
          [ برنده ]     [ عکس اریس ]     [ بازنده ]
        شخصیت پیکسلی   (برد یا باخت)    شخصیت پیکسلی
        ───────────────  عنوان  ───────────────
       [ پنل وضعیت برنده ]          [ پنل وضعیت بازنده ]
       سلامتی · تجربه · سکه ·       سلامتی · تجربه · سکه ·
       امتیاز · احترام اریس · …      امتیاز …
```

- **دوئل، نبرد تیمی و آزاد:** وسط بالا عکس اریس برنده (`eris_win`)، سمت چپ برنده‌ها و سمت راست بازنده‌ها.
- **نبرد تمرینی با اریس:** اگر بازیکن ببرد اریس در سمت بازنده با عکس `eris_lose` دیده می‌شود، اگر اریس ببرد در سمت برنده با `eris_win`.
- در مساوی/بدون برنده همان متن قبلی فرستاده می‌شود. اگر عکس‌ها یا کتابخانهٔ canvas در دسترس نباشند هم متن قبلی ارسال می‌شود، یعنی نتیجه هیچ‌وقت گم نمی‌شود.

بدون هیچ عکسی هم کار می‌کند (پس‌زمینهٔ گرادیان داخلی). با ساختن این ۳ عکس ظاهر کامل می‌شود.

## فایل‌ها و جای قرارگیری

| عکس | فایل در پروژه | یا اسلات `/admin` |
|---|---|---|
| اریس برنده | `assets/results/eris_win.png` | 🏆 عکس‌های نتیجهٔ نبرد ← «اریس برنده» |
| اریس بازنده | `assets/results/eris_lose.png` | همان‌جا ← «اریس بازنده» |
| پس‌زمینهٔ کارت نتیجه | `assets/results/bg.png` | همان‌جا ← «پس‌زمینهٔ کارت نتیجهٔ نبرد» |

فرمت `.png` / `.jpg` / `.webp`. عکس ارسالی ادمین از پیوی ربات (`/admin`) بر فایل پروژه اولویت دارد.

## ۱) عکس اریس برنده — `eris_win`

- **نسبت:** عمودی-مربعی `4:5` ، پیشنهاد `1024×1280`
- **پس‌زمینه: شفاف** (PNG با آلفا) تا روی پس‌زمینهٔ کارت بنشیند. اگر ابزارتان شفاف نمی‌دهد، پس‌زمینهٔ سبز `#00ff00` بخواهید و حذفش کنید.
- بالاتنه یا تمام‌قد، سوژه وسط، پایین عکس مماس با لبه (کارت آن را پایین‌چین می‌کند).
- **بدون متن.**

```
Anime-style illustration of Eris Boreas Greyrat (long fiery crimson-red hair, sharp
amber-red eyes, proud noble swordswoman, fantasy adventurer outfit), full-body or
three-quarter view, standing victorious with one fist on her hip and a smug confident
grin, chin slightly raised, a sword resting on her shoulder, dynamic heroic pose,
clean cel shading, vibrant colors, soft rim light, centered composition, 4:5 vertical
frame, subject touches the bottom edge of the image, transparent background (or flat
#00ff00 chroma-key background), no text, no letters, no watermark, no border
```

## ۲) عکس اریس بازنده — `eris_lose`

مثل بالا، همان لباس و همان طراحی؛ فقط حالت: ناراحت/لجباز.

```
Anime-style illustration of Eris Boreas Greyrat (long fiery crimson-red hair, sharp
amber-red eyes, fantasy adventurer outfit), full-body or three-quarter view, defeated
and sulking: sitting or kneeling on the ground, arms crossed, cheeks puffed, teary
angry eyes looking away, a little embarrassed pout, her sword stuck in the ground
beside her, clean cel shading, vibrant colors, centered composition, 4:5 vertical
frame, subject touches the bottom edge of the image, transparent background (or flat
#00ff00 chroma-key background), no text, no letters, no watermark, no border
```

> برای یکدست بودن، اول `eris_win` را بسازید و بعد آن را به‌عنوان **رفرنس تصویر** به ابزار بدهید تا `eris_lose` همان شخصیت باشد.

## ۳) پس‌زمینهٔ کارت — `bg`

- **نسبت:** `16:9` ، دقیقاً `1280×720` (یا `1920×1080`) ، فرمت jpg/png.
- **بدون متن و بدون شخصیت.** وسط و پایین تصویر **تیره و ساده** باشد چون پنل‌های وضعیت (پایین) و عنوان (وسط) روی آن نوشته می‌شوند. دو شخصیت در بالا-چپ و بالا-راست و عکس اریس در وسط بالا می‌ایستند، پس آن ناحیه‌ها شلوغ نباشند.

```
Wide cinematic fantasy battle arena background, 16:9, empty stone colosseum courtyard
at golden-hour dusk with drifting embers and soft dust in the air, a few torn red
banners on the far walls, warm orange light from the left and cool blue-purple light
from the right, strong depth of field and blur on the far background, the center and
the lower third are darker and calm with low detail so that text panels stay readable,
painterly anime background art, no characters, no people, no text, no letters,
no logo, no watermark, no UI, no border
```

### نسخهٔ جایگزین (ورزشگاه برفی)

```
Wide cinematic fantasy training-ground background, 16:9, snowy courtyard of a noble
swordsman estate at twilight, falling snow, lanterns glowing softly, wooden practice
dummies blurred in the distance, cold blue palette with warm lantern accents, the
center and lower third are dark and calm with low detail for readable text overlays,
painterly anime background art, no characters, no people, no text, no letters,
no watermark, no UI, no border
```

## پرامپت منفی مشترک

```
text, letters, numbers, watermark, logo, signature, UI, border, frame, extra
characters, extra limbs, deformed hands, blurry, low quality, cropped head
```

## نکتهٔ آزمایش

بعد از گذاشتن عکس‌ها یک دوئل یا نبرد تمرینی تا آخر انجام دهید. اگر عکس اریس لب‌ پایین بریده شد، سوژه را در عکس کمی بالاتر بگذارید (کارت آن را `contain` و پایین‌چین می‌کند و برش نمی‌دهد).
