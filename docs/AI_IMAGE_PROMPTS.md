# پرامپت ساخت قالب پروفایل عکسی (۱۶:۹) / Profile-card template prompts

قالب پروفایل یک **عکس ۱۶:۹** است (پیشنهاد: `1920×1080` یا `1280×720`؛ نسبت مهم است نه اندازه).  
ربات فقط **متن‌ها و عکس‌ها را روی قالب می‌نویسد** — خودِ قالب باید **بدون هیچ متن، عدد، لوگو و واترمارک** باشد.

> قالب‌ها هیچ‌چیزِ ثابتی ندارند که باید دقیقاً جای مشخصی باشد؛ فقط **نواحی مشخص‌شده باید آرام، کم‌جزئیات و نسبتاً تیره** باشند تا متن خوانا بماند. ربات یک لایهٔ نیمه‌شفاف تیره زیر هر بخش هم می‌کشد.

---

## ۱) نقشهٔ جای هر المان (روی بوم 1280×720)

| المان | مختصات (px) | درصد از عرض/ارتفاع | چه چیزی ربات می‌نویسد |
|---|---|---|---|
| 🟠 **عکس پروفایل (دایره)** | مرکز (190, 185)، شعاع 105 | مرکز 14.8% / 25.7% ؛ قطر ≈ 16.4% عرض | عکس تلگرام کاربر (گرد) + حلقهٔ رنگی |
| 🟦 **بلوک نام** | x 340→980، y 80→290 | چپ 26.6% ، بالا 11.1% ، عرض 50% ، ارتفاع 29.2% | نام کاربر (درشت) · @یوزرنیم · عنوان انتخابی (قرص) |
| 🔵 **نشان لول (دایره)** | مرکز (1120, 185)، شعاع 100 | مرکز 87.5% / 25.7% | کلمهٔ «سطح» + عدد لول |
| 🟪 **نوار رتبه و XP** | x 60→1220، y 315→430 | چپ 4.7% ، بالا 43.8% ، عرض 90.6% ، ارتفاع 16% | نام رتبهٔ شمشیر + نوار پیشرفت XP |
| 🟩 **جدول آمار (۳ ستون × ۴ ردیف)** | x 60→820، y 455→680 | چپ 4.7% ، بالا 63.2% ، عرض 59.4% ، ارتفاع 31.3% | حمله، دفاع، سرعت، ضربه بحرانی، HP، استقامت، امتیاز، نرخ پیروزی، پیروزی، شکست، پیروزی متوالی، احترام اریس |
| 🟨 **ویترین (۳ خانهٔ مربع ۹۰px)** | x 850→1220، y 455→615 | چپ 66.4% ، بالا 63.2% ، عرض 28.9% ، ارتفاع 22.2% | عکس ۳ آیتم تزئینی انتخاب‌شده + نام زیر هرکدام |
| 🟫 **نوار عنوان‌ها** | x 850→1220، y 625→680 | چپ 66.4% ، بالا 86.8% ، عرض 28.9% ، ارتفاع 7.6% | عنوان‌های خریداری‌شده |

نقشهٔ متنی (۱۶:۹):

```
┌──────────────────────────────────────────────────────────────┐
│  (◉ عکس)   ┌──────────────────────────┐       ( لول )        │
│  پروفایل   │  نام کاربر               │        عدد           │
│            │  @username               │                      │
│            │  [ عنوان انتخابی ]       │                      │
│            └──────────────────────────┘                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │      رتبهٔ شمشیر      ▓▓▓▓▓▓▓▓▓░░░░░░░  XP             │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌──────────────── آمار ────────────────┐ ┌─ ویترین ───────┐ │
│  │ حمله   دفاع   سرعت   بحرانی          │ │ [▢]  [▢]  [▢]  │ │
│  │ HP     استقامت امتیاز نرخ‌پیروزی     │ └────────────────┘ │
│  │ برد    باخت   متوالی  احترام         │ ┌─ عنوان‌ها ─────┐ │
│  └──────────────────────────────────────┘ └────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**قانون طراحی:** شخصیت/سوژهٔ اصلی و جزئیات شلوغ را به **حاشیه‌ها و گوشه‌های بالا** ببرید (بین عکس پروفایل، بلوک نام و نشان لول، یا لبهٔ بیرونی). وسط و پایین باید «بوم آرام» باشد.

اگر قالب نهایی شما جای المان‌ها را متفاوت دارد، اعداد را در `src/config/profileLayout.js` عوض کنید، `PROFILE_CARD_LAYOUT_VERSION` را در `src/config/constants.js` یک واحد زیاد کنید و با `npm run preview:card` نتیجه را ببینید.

---

## ۲) پرامپت‌ها (انگلیسی؛ برای Midjourney / DALL·E / Flux / Stable Diffusion)

### الگوی مشترک (همهٔ قالب‌ها)

**Common prompt block** — at the start of every prompt:

```
Wide 16:9 background illustration for a fantasy sword-fighting game profile card,
digital painting in a polished anime-inspired style, rich cinematic lighting,
the central and lower area is calm, dark and low-detail like a soft vignette so
overlay text stays readable, main visual interest only along the edges and the
top corners, three large empty circular/rectangular zones left clean,
absolutely no text, no letters, no numbers, no logos, no watermark, no UI elements,
no frames, no borders
```

**Common negative prompt:**

```
text, letters, numbers, watermark, logo, signature, UI, buttons, border, frame,
face in the center, busy center, cluttered, low quality, blurry, cropped, deformed hands
```

**Parameters:** `--ar 16:9` (Midjourney) · 1920×1080 · output PNG/JPG.

---

### 🆓 قالب رایگان — `assets/templates/DEFAULT.png`

```
[COMMON BLOCK], deep midnight-blue to violet gradient sky over a quiet battlefield
horizon, faint golden dust particles drifting, two crossed training swords as a
very subtle silhouette in the far top-right corner, calm and neutral mood,
dominant colors navy #101a3a, violet #2a1238 and warm gold accents #ffc857
```

### 🔥 قالب شعلهٔ اریس (TPL_FLAME) — `assets/templates/TPL_FLAME.png`

```
[COMMON BLOCK], fiery theme: a fierce red-haired young swordswoman in noble
adventurer armor drawn only as a large dramatic silhouette in the top-right corner
(cropped by the frame, back lit), embers and sparks rising along the left and
right edges, glowing lava cracks at the bottom corners, burning orange-red
palette with dark charred-brown center, dominant colors #3a0a06, #a8210d, #ff9f43
```

### ❄️ قالب یخ‌بندان (TPL_FROST) — `assets/templates/TPL_FROST.png`

```
[COMMON BLOCK], frozen theme: crystalline ice shards and frost patterns framing
the left and right edges, a pale blue magic circle faintly glowing in the top
center-right behind the empty zones, drifting snowflakes, cold moonlight,
deep navy center, dominant colors #0a2a4a, #4b8fc2, #7fd8ff
```

### 👑 قالب سلطنتی بوریاس (TPL_ROYAL) — `assets/templates/TPL_ROYAL.png`

```
[COMMON BLOCK], royal noble-house theme: dark purple velvet drapes and gold
ornamental filigree only in the corners, a large faint heraldic sword-and-crown
emblem engraved in the far top-right corner (no letters), warm candle-like light
from the top corners, regal and elegant, dominant colors #2a0d4a, #5b1d86, #f5c542
```

### 🌲 قالب جنگل سیلفی (TPL_FOREST) — `assets/templates/TPL_FOREST.png`

```
[COMMON BLOCK], enchanted forest theme: giant ancient trees and hanging leaves
framing the left and right edges, soft god-rays from the top-left, glowing green
fireflies and tiny spirit lights, gentle healing-magic atmosphere, deep green
calm center, dominant colors #0b3320, #2f7a46, #b7f07a
```

### 🌑 قالب سایهٔ خدای شمشیر (TPL_SHADOW) — `assets/templates/TPL_SHADOW.png`

```
[COMMON BLOCK], dark legendary theme: a colossal ghostly sword-saint silhouette
made of black smoke rising behind the empty zones, almost black center, thin
crimson energy lines along the edges, falling dark petals, ominous but majestic,
dominant colors #07070d, #2b0a14, #ff3b5c
```

---

## ۳) بعد از ساخت عکس‌ها

1. دو راه دارید و هر دو معتبرند:
   - **فایل در پروژه:** عکس را با **همین نام فایل** در `assets/templates/` بگذارید (پسوند `.png/.jpg/.webp`).  
     مثلاً `assets/templates/TPL_FLAME.png`. با اولین بالا آمدن ربات یک‌بار در تلگرام آپلود و بعد فقط با file_id ارسال می‌شود.
   - **از داخل ربات:** در پیوی ربات `/admin` ← «🖼 قالب‌های پروفایل» ← قالب ← «📤 ارسال عکس» (به‌صورت Photo، نه File).
2. عکس ادمین همیشه بر فایل پروژه اولویت دارد.
3. با `npm run preview:card` نتیجه را بدون تلگرام ببینید (خروجی در پوشهٔ `preview/`).
4. با `npm run check:assets` ببینید کدام عکس‌ها هنوز نیست.

> اگر قالبی عکس نداشته باشد ربات یک پس‌زمینهٔ گرادیانی هم‌رنگ همان قالب می‌کشد، پس هیچ‌چیز خراب نمی‌شود.
