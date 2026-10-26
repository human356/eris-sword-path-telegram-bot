# پرامپت‌های عکس آیتم‌ها و قالب‌های پولی (English prompts)

این فایل فقط **پرامپت متنی انگلیسی** است تا خودتان بعداً عکس‌ها را بسازید.  
هر بخش دو چیز دارد: **نام فایل** برای قرار دادن در پروژه و **پرامپت**.

## قوانین کلی

| موضوع | مقدار |
|---|---|
| عکس آیتم‌ها | **مربع 1:1** ، پیشنهاد `1024×1024` ، سوژه وسط ، پس‌زمینهٔ ساده‌ی تیره و بدون جزئیات ، **بدون هیچ متن** |
| عکس قالب‌های پروفایل | **16:9** ، `1920×1080` — پرامپت‌ها و نقشهٔ جاها در [`AI_IMAGE_PROMPTS.md`](AI_IMAGE_PROMPTS.md) |
| فرمت | `.png` یا `.jpg` یا `.webp` |
| مسیر آیتم‌ها | `assets/items/<ITEM_KEY>.png` |
| مسیر قالب‌ها | `assets/templates/<TEMPLATE_KEY>.png` |
| مسیر عکس لول‌ها | `assets/levels/<شماره>.png` و `assets/levels/default.png` |
| مسیر بنر فروشگاه | `assets/shop/banner.png` |

یا به‌جای فایل، همین عکس‌ها را در پیوی ربات با `/admin` بفرستید (به‌صورت Photo).

آیتم‌های تزئینی در **سه جا** دیده می‌شوند: پست محصول در فروشگاه/اینلاین، ویترین سه‌خانه‌ای کارت پروفایل (حدود ۹۰ پیکسل — پس سوژه باید ساده و خوانا باشد) و صفحهٔ خرید.

### پیشوند مشترک آیتم‌ها (Item prefix)

```
Single centered game item icon, high-quality polished digital illustration in a
fantasy anime-inspired style, strong readable silhouette that still works when
shrunk to 90 pixels, soft rim light, simple dark plain background with a subtle
vignette, square 1:1 composition, the object fills about 70% of the frame,
no text, no letters, no numbers, no watermark, no border
```

### پرامپت منفی مشترک (Negative)

```
text, letters, numbers, watermark, logo, signature, multiple objects, cluttered
background, cropped object, blurry, low quality, hands holding the object, UI
```

---
## بخش A — آیتم‌های تزئینی (Decorative items)

## 🏷 عنوان‌ها (Titles)

### عنوان «شاگرد شمشیر» — Sword Disciple title plaque
- کلید: `TITLE_SWORD_DISCIPLE`
- فایل: `assets/items/TITLE_SWORD_DISCIPLE.png`

```
[ITEM PREFIX], a small ornate bronze plaque shaped like a scroll banner with a single upright sword emblem, no text
```

### عنوان «مورد علاقهٔ اریس» — Eris's Favorite title plaque
- کلید: `TITLE_ERIS_FAVORITE`
- فایل: `assets/items/TITLE_ERIS_FAVORITE.png`

```
[ITEM PREFIX], a crimson-and-gold plaque with a glowing heart-shaped ruby set between two crossed swords, no text
```

### عنوان «شوالیهٔ بوریاس» — Knight of Boreas title plaque
- کلید: `TITLE_BORDER_KNIGHT`
- فایل: `assets/items/TITLE_BORDER_KNIGHT.png`

```
[ITEM PREFIX], a steel-blue heraldic plaque with a knight helmet and a shield crest, no text
```

### عنوان «شاگرد رودیوس» — Rudeus's Student title plaque
- کلید: `TITLE_RUDEUS_STUDENT`
- فایل: `assets/items/TITLE_RUDEUS_STUDENT.png`

```
[ITEM PREFIX], a parchment scroll plaque with a small magic-staff emblem and a glowing blue spell rune, no text
```

### عنوان «دوست سیلفی» — Sylphy's Friend title plaque
- کلید: `TITLE_SYLPHY_FRIEND`
- فایل: `assets/items/TITLE_SYLPHY_FRIEND.png`

```
[ITEM PREFIX], a soft green wooden plaque with a leaf-and-feather emblem and gentle emerald glow, no text
```

## 🖼 قاب‌ها (Frames)

### قاب پروفایل طلایی — golden profile frame
- کلید: `FRAME_GOLDEN`
- فایل: `assets/items/FRAME_GOLDEN.png`

```
[ITEM PREFIX], an ornate square-ish golden picture frame with engraved sword motifs and tiny gems, empty transparent-looking dark center
```

### قاب پروفایل یخی — ice profile frame
- کلید: `FRAME_ICE`
- فایل: `assets/items/FRAME_ICE.png`

```
[ITEM PREFIX], a picture frame made of jagged frozen crystal and frost, pale blue glow, empty dark center
```

### قاب پروفایل شعله‌ای — flame profile frame
- کلید: `FRAME_FLAME`
- فایل: `assets/items/FRAME_FLAME.png`

```
[ITEM PREFIX], a picture frame made of living fire and glowing embers, orange-red, empty dark center
```

### قاب پروفایل بنفش سلطنتی — royal purple profile frame
- کلید: `FRAME_ROYAL_PURPLE`
- فایل: `assets/items/FRAME_ROYAL_PURPLE.png`

```
[ITEM PREFIX], a picture frame of purple velvet with gold filigree and a small crown on top, empty dark center
```

### قاب پروفایل رنگین‌کمانی — rainbow profile frame
- کلید: `FRAME_RAINBOW`
- فایل: `assets/items/FRAME_RAINBOW.png`

```
[ITEM PREFIX], a picture frame woven from shimmering rainbow light ribbons with sparkles, empty dark center
```

## 🎖 نشان‌ها (Badges)

### نشان «طرفدار خدای شمشیر» — Sword God fan badge
- کلید: `BADGE_SWORD_GOD_FAN`
- فایل: `assets/items/BADGE_SWORD_GOD_FAN.png`

```
[ITEM PREFIX], a round enamel badge showing a majestic sword wrapped in white light with tiny stars, metallic rim, no text
```

### نشان «شکست‌ناپذیر» — Undefeated badge
- کلید: `BADGE_UNDEFEATED`
- فایل: `assets/items/BADGE_UNDEFEATED.png`

```
[ITEM PREFIX], a heavy golden medal with a laurel wreath around an unbroken upright sword and a small diamond, no text
```

## 😺 برچسب‌های ایموجی (Emoji tags)

### برچسب ایموجی گربه‌ای — cat emoji sticker
- کلید: `EMOJI_TAG_CAT`
- فایل: `assets/items/EMOJI_TAG_CAT.png`

```
[ITEM PREFIX], a cute chibi cat head sticker with a tiny sword-shaped tail, thick white sticker outline, playful
```

### برچسب ایموجی اژدها — dragon emoji sticker
- کلید: `EMOJI_TAG_DRAGON`
- فایل: `assets/items/EMOJI_TAG_DRAGON.png`

```
[ITEM PREFIX], a cute chibi baby dragon head sticker breathing a small flame, thick white sticker outline, playful
```

### برچسب ایموجی ستاره‌ای — star emoji sticker
- کلید: `EMOJI_TAG_STAR`
- فایل: `assets/items/EMOJI_TAG_STAR.png`

```
[ITEM PREFIX], a glossy golden five-point star sticker with a happy tiny face and sparkles, thick white sticker outline
```

## 🐾 همراه (Pet)

### همراه کوچک «اریس مینیاتوری» — miniature companion
- کلید: `PET_MINI_ERIS`
- فایل: `assets/items/PET_MINI_ERIS.png`

```
[ITEM PREFIX], an adorable chibi red-haired swordswoman figurine, about the size of a doll, wearing small adventurer armor, holding a tiny sword, standing on a small round base
```

---

## بخش B — قالب‌های پولی پروفایل (Paid profile templates)

این‌ها عکس **16:9** هستند و **نقشهٔ جای المان‌ها** (عکس پروفایل، نام، لول، آمار، ویترین...) را باید رعایت کنند.  
پرامپت کامل هر قالب + بلوک مشترک + نقشهٔ جاها: **[`AI_IMAGE_PROMPTS.md`](AI_IMAGE_PROMPTS.md)**

| کلید | فایل | تم | قیمت |
|---|---|---|---|
| `TPL_FLAME` | `assets/templates/TPL_FLAME.png` | قالب پروفایل شعله‌ی اریس | 1200 🪙 |
| `TPL_FROST` | `assets/templates/TPL_FROST.png` | قالب پروفایل یخ‌بندان | 1200 🪙 |
| `TPL_ROYAL` | `assets/templates/TPL_ROYAL.png` | قالب پروفایل سلطنتی بوریاس | 1800 🪙 |
| `TPL_FOREST` | `assets/templates/TPL_FOREST.png` | قالب پروفایل جنگل سیلفی | 1500 🪙 |
| `TPL_SHADOW` | `assets/templates/TPL_SHADOW.png` | قالب پروفایل سایه‌ی خدای شمشیر | 2500 🪙 |

نکته: برای هر قالب، **یک تصویر کوچک مربع** (آیکون فروشگاه) هم می‌توان ساخت و در `assets/items/<TPL_KEY>.png` گذاشت تا در فروشگاه اینلاین به‌جای نام ساده نمایش داده شود. پرامپت پیشنهادی:

```
[ITEM PREFIX], a miniature preview card of a landscape game profile theme,
showing only the mood and color palette of the theme (flame / frost / royal / forest / shadow), tilted slightly, floating, glowing edges
```

---

## بخش C — بقیهٔ محصولات فروشگاه (اختیاری)

برای اینکه در فروشگاه اینلاین عکس هم داشته باشند. همه با **[ITEM PREFIX]** شروع می‌شوند.

### قرص استامینا
- فایل: `assets/items/STAMINA_PILL.png`

```
[ITEM PREFIX], a glowing green-yellow energy pill capsule with small lightning sparks
```

### معجون درمان
- فایل: `assets/items/HEALING_POTION.png`

```
[ITEM PREFIX], a round glass potion bottle filled with glowing red liquid, cork stopper
```

### برنج اریس
- فایل: `assets/items/ERIS_RICE.png`

```
[ITEM PREFIX], a steaming bowl of white rice with a small red flower garnish, warm home-cooked feeling
```

### عروسک گربه‌ای
- فایل: `assets/items/CAT_DOLL.png`

```
[ITEM PREFIX], a cute plush cat doll with button eyes and a tiny sword-shaped ribbon
```

### باتلاق سمی
- فایل: `assets/items/POISON_SWAMP.png`

```
[ITEM PREFIX], a swirling dark purple-green poison swamp orb with bubbles and skull-shaped vapor, no text
```

### طومار پنهان کردن حقیقت
- فایل: `assets/items/TRUTH_SCROLL.png`

```
[ITEM PREFIX], an old rolled parchment scroll sealed with a black wax stamp, mysterious glowing question-mark-like swirl made of light (no letters)
```

### کارت حمله شهابی
- فایل: `assets/items/METEOR_STRIKE.png`

```
[ITEM PREFIX], a flaming meteor streaking down with a long fiery tail, impact sparks
```

### کارت گلوله آتش
- فایل: `assets/items/FIREBALL.png`

```
[ITEM PREFIX], a swirling ball of orange fire with a bright white core, trailing flame
```

### کارت حملهٔ فریب‌دهنده
- فایل: `assets/items/DECEPTIVE_STRIKE.png`

```
[ITEM PREFIX], a sword blade split into two mirrored translucent illusions, one real one ghostly
```

### کارت سپر یخی
- فایل: `assets/items/ICE_SHIELD.png`

```
[ITEM PREFIX], a large round shield made of translucent blue ice crystal with frost swirls
```

### کارت درمانگری(سیلفی)
- فایل: `assets/items/SYLPHY_HEAL.png`

```
[ITEM PREFIX], a floating green healing sigil with leaves and soft glowing particles
```

### کارت حملهٔ چند ضربهٔ سورزنی
- فایل: `assets/items/MULTI_STRIKE.png`

```
[ITEM PREFIX], three bright diagonal sword slash arcs radiating from one point
```

### کارت حملهٔ رعد و برقی(راکسی)
- فایل: `assets/items/THUNDER_STRIKE.png`

```
[ITEM PREFIX], a branching blue-white lightning bolt hitting a small sword, electric sparks
```

### کارت پری کردن با شمشیر
- فایل: `assets/items/SWORD_PARRY.png`

```
[ITEM PREFIX], two swords clashing at a point with a bright spark, deflected motion lines
```

### کارت دیوارشکن
- فایل: `assets/items/WALL_BREAKER.png`

```
[ITEM PREFIX], a heavy cracked stone wall shattering from a single sword impact, flying rubble
```

### صندوقچهٔ گنج افسانه‌ای
- فایل: `assets/items/TREASURE_CHEST.png`

```
[ITEM PREFIX], an ornate golden-trimmed wooden treasure chest, lid slightly open, radiant light pouring out
```

