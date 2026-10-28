# پرامپت‌ها و دستورعمل ساخت عکس‌های شخصیت نیمه‌پیکسلی (English prompts)

> ربات **بدون هیچ عکسی هم کار می‌کند**: شخصیت به‌صورت پیش‌فرض با کد (پیکسل‌آرت داخلی) کشیده می‌شود.  
> این فایل برای وقتی است که می‌خواهید **ظاهر حرفه‌ای‌تر با نقاشی خودتان** جایگزین شود. هر قطعه‌ای که عکسش را بگذارید، جای نسخهٔ داخلی همان قطعه را می‌گیرد.

## ۱) ایدهٔ کلی: «لایه‌ها»

شخصیت از چند **لایهٔ شفاف PNG هم‌اندازه** ساخته می‌شود که روی هم قرار می‌گیرند (بدن ← لباس‌ها ← صورت ← چشم/دهن/… ← مو ← کلاه/سلاح).  
**همهٔ لایه‌ها دقیقاً `512×768` پیکسل و PNG با پس‌زمینهٔ شفاف** باشند. شبکهٔ پیکسلی شخصیت `32×48` خانه است و هر خانه `16×16` پیکسل.  
لایه‌ها باید **دقیقاً روی همان نقطه‌ای** باشند که در عکس‌های راهنما می‌بینید، وگرنه چشم/لباس جابه‌جا می‌افتد.

عکس‌های راهنما (داخل پروژه):

| فایل | کاربرد |
|---|---|
| `docs/character-guide/reference_male.png` | بدن و ظاهر پیش‌فرض پسر — به‌عنوان **رفرنس تصویر (img2img / reference image)** به هوش مصنوعی بدهید |
| `docs/character-guide/reference_female.png` | همین برای دختر |
| `docs/character-guide/zones_grid.png` | نقشهٔ جای هر عضو روی شبکه (سر، چشم‌ها، ابرو، دماغ، دهن، سیبیل، تنه، پا، سلاح) |

### جای هر عضو روی بوم `512×768` (پیکسل)

| عضو | ناحیه (x, y, عرض, ارتفاع) |
|---|---|
| سر / صورت | `144, 80, 224, 224` |
| گوش‌ها | چپ `128, 160, 16, 48` — راست `368, 160, 16, 48` |
| چشم‌ها | چپ `176, 176, 48, 48` — راست `288, 176, 48, 48` |
| ابروها | چپ `176, 128, 48, 32` — راست `288, 128, 48, 32` |
| دماغ | `240, 224, 32, 32` |
| دهن | `224, 256, 64, 32` |
| سیبیل | `192, 240, 128, 16` (ریش کامل تا پایین فک) |
| تنه (پسر) | `176, 336, 160, 192` — (دختر `192, 336, 128, 192`) |
| پاها | `192, 528, 128, 160` |
| کفش‌ها | `176, 688, 160, 48` |
| سلاح (دست راست شخصیت = سمت راست عکس) | `384, 128, 48, 416` |

## ۲) رنگ‌پذیری (خیلی مهم)

بعضی قطعات را ربات **با رنگی که بازیکن انتخاب می‌کند رنگ می‌کند** (ضرب رنگ). برای همین باید آن‌ها را **خاکستری/سفید خنثی** بکشید:

| قطعه | چطور بکشید |
|---|---|
| بدن، شکل صورت، گوش | پوست **خیلی روشن و خنثی** (`#fff1e6`) با سایه‌های خاکستری ملایم — ربات رنگ پوست را رویش می‌اندازد |
| مو (جلو و پشت)، ابرو، سیبیل | **خاکستری روشن / سفید** (`#e6e6e6`) با سایه‌های خاکستری — ربات رنگ مو را رویش می‌اندازد |
| چشم، دماغ، دهن، تمام لباس‌ها و لوازم | **رنگی و نهایی** (رنگ نمی‌شوند). توجه: با عکس چشم، گزینهٔ «رنگ چشم» اثری ندارد |

## ۳) ساخت با هوش مصنوعی — مراحل

1. رفرنس `reference_male.png` یا `reference_female.png` را به ابزار بدهید (حالت Reference / Image-to-Image / Edit با قدرت پایین تا ابعاد و جای اعضا حفظ شود).
2. **پرامپت مشترک (Prefix)** + پرامپت همان قطعه را بدهید. هر بار **فقط یک قطعه** بسازید.
3. پس‌زمینه را حذف کنید (یا پس‌زمینهٔ سبز `#00ff00` خواسته‌اید و با ابزار remove-background شفافش کنید).
4. اگر خروجی «پیکسل‌های تمیز» نبود: عکس را به `32×48` کوچک کنید با روش **Nearest Neighbor** و دوباره با Nearest به `512×768` بزرگ کنید تا پیکسل‌ها دقیقاً `16×16` شوند.
5. روی بوم `512×768` در همان جای راهنما قرار دهید و PNG ذخیره کنید.
6. فایل را با نام و پوشهٔ زیر در پروژه بگذارید. نیازی به راه‌اندازی مجدد ربات نیست؛ کارت‌ها خودکار دوباره ساخته می‌شوند.

> **توصیه:** یا همهٔ لایه‌ها را با یک سبک بسازید یا اصلاً نسازید؛ قاطی‌شدن نقاشی خودتان با پیکسل‌آرت داخلی در یک شخصیت ظاهر ناهمگون می‌دهد. اگر فقط لباس‌ها را می‌خواهید جایگزین کنید (قطعات `gear/…`) مشکلی نیست.

## ۴) مسیر فایل‌ها

```
assets/character/<نوع>/<شناسه>.png
```

`<نوع>/<شناسه>` برای هر قطعه در بخش‌های پایین آمده است. نمونه: `assets/character/hair_front/spiky.png` ، `assets/character/gear/IRON_SWORD.png`.

عکس‌های **محصول در فروشگاه** برای لوازم شخصیت (کلیدهایی مثل `GEAR_IRON_SWORD`) جدا هستند: `assets/items/GEAR_IRON_SWORD.png` (مربع 1:1، همان قوانین [`ITEM_IMAGE_PROMPTS.md`](ITEM_IMAGE_PROMPTS.md)) یا از `/admin` در پیوی ربات بفرستید.

---

## ۵) پرامپت مشترک (Prefix) — برای همهٔ لایه‌ها

```
[LAYER PREFIX] =
Semi-pixel chibi game character layer, front view, crisp square pixels as if drawn on a 32x48 pixel grid and upscaled 16x (every pixel block is exactly 16x16 px), 1-pixel dark outline (#1e1a24), flat cel shading with at most 4 tones per color, limited palette, no anti-aliasing, no gradients, no text, no watermark, canvas 512x768 px, transparent background (or flat #00ff00 chroma-key to remove), the following single part only, everything else empty/transparent:
```

## پرامپت منفی مشترک (Negative)

```
photo, realistic, 3d render, blurry, anti-aliasing, smooth gradient, soft brush, text, letters, watermark, background scenery, cropped, extra limbs, different pose
```

---

## ۶) بدن (جنسیت) — `body`

بدن لخت پایه (بدون لباس و بدون جزئیات صورت). **رنگ‌پذیر (پوست)**.

### `body/male.png`
- فایل: `assets/character/body/male.png`

```
[LAYER PREFIX] bare boy body base: big head (14 pixels wide), neck, bare torso 10 pixels wide, arms hanging down, bare legs, standing straight, light neutral skin tone (#fff1e6) with soft gray shading, wearing nothing, no face details (blank face shape is a separate layer)
```

### `body/female.png`
- فایل: `assets/character/body/female.png`

```
[LAYER PREFIX] bare girl body base: big head, slim neck, bare torso 8 pixels wide, arms hanging down, bare legs, standing straight, light neutral skin tone (#fff1e6) with soft gray shading, wearing nothing, no face details
```

## ۷) شکل صورت — `face`

فقط شکل سر. **رنگ‌پذیر (پوست)**.

### `face/round.png`
- فایل: `assets/character/face/round.png`

```
[LAYER PREFIX] head/face shape layer only: round head, 14 pixels wide and 14 tall with the four corners cut by one pixel, plain light skin (#fff1e6), no eyes, no mouth, no hair
```

### `face/oval.png`
- فایل: `assets/character/face/oval.png`

```
[LAYER PREFIX] head/face shape layer only: oval head narrowing toward the chin, plain light skin (#fff1e6), no eyes, no mouth, no hair
```

### `face/square.png`
- فایل: `assets/character/face/square.png`

```
[LAYER PREFIX] head/face shape layer only: boxy square jaw head, plain light skin (#fff1e6), no features, no hair
```

### `face/heart.png`
- فایل: `assets/character/face/heart.png`

```
[LAYER PREFIX] head/face shape layer only: heart-shaped face wide at the forehead and pointed at the chin, plain light skin (#fff1e6), no features, no hair
```

## ۸) گوش — `ears`

فقط گوش‌ها. **رنگ‌پذیر (پوست)**.

### `ears/normal.png`
- فایل: `assets/character/ears/normal.png`

```
[LAYER PREFIX] a pair of ears only, one on each side of the head at eye level, normal human ears, light skin (#fff1e6)
```

### `ears/pointed.png`
- فایل: `assets/character/ears/pointed.png`

```
[LAYER PREFIX] a pair of long pointed elf ears only, slanting upward and outward, light skin (#fff1e6)
```

### `ears/small.png`
- فایل: `assets/character/ears/small.png`

```
[LAYER PREFIX] a pair of tiny small ears only, light skin (#fff1e6)
```

### `ears/large.png`
- فایل: `assets/character/ears/large.png`

```
[LAYER PREFIX] a pair of large round protruding ears only, light skin (#fff1e6)
```

## ۹) چشم — `eyes`

فقط چشم‌ها (دو چشم در یک لایه). **رنگی نهایی**.

### `eyes/normal.png`
- فایل: `assets/character/eyes/normal.png`

```
[LAYER PREFIX] a pair of eyes only (positioned at pixel rows 11-13 of the head), neutral dark eyes with a white highlight pixel, 2 pixels wide and 3 tall each
```

### `eyes/round.png`
- فایل: `assets/character/eyes/round.png`

```
[LAYER PREFIX] a pair of big round shiny anime eyes only, 3x3 pixels each with a white highlight, cute
```

### `eyes/sharp.png`
- فایل: `assets/character/eyes/sharp.png`

```
[LAYER PREFIX] a pair of sharp narrow confident eyes only with a dark upper lash line slanting outward
```

### `eyes/sleepy.png`
- فایل: `assets/character/eyes/sleepy.png`

```
[LAYER PREFIX] a pair of sleepy half-closed eyes only, heavy eyelids, calm
```

### `eyes/happy.png`
- فایل: `assets/character/eyes/happy.png`

```
[LAYER PREFIX] a pair of happy closed smiling eyes only, shaped like upward arcs ^ ^
```

## ۱۰) دماغ — `nose`

**رنگی نهایی** و خیلی ملایم (روی هر رنگ پوستی بنشیند: سایهٔ خاکستری-قهوه‌ای با شفافیت).

### `nose/small.png`
- فایل: `assets/character/nose/small.png`

```
[LAYER PREFIX] a tiny nose only: a single small soft shade mark, 2x1 pixels, slightly darker than skin, very subtle
```

### `nose/normal.png`
- فایل: `assets/character/nose/normal.png`

```
[LAYER PREFIX] a normal nose only: a small soft 2x2 pixel shade block, subtle skin-tone shadow
```

### `nose/big.png`
- فایل: `assets/character/nose/big.png`

```
[LAYER PREFIX] a big wide nose only: a 4x2 pixel soft shade block, subtle skin-tone shadow
```

### `nose/pointed.png`
- فایل: `assets/character/nose/pointed.png`

```
[LAYER PREFIX] a long pointed nose only: a thin vertical highlight with a small shadow at the tip
```

## ۱۱) دهن — `mouth`

**رنگی نهایی**.

### `mouth/smile.png`
- فایل: `assets/character/mouth/smile.png`

```
[LAYER PREFIX] a small friendly smile only, curved up, dusty red (#9a3d45), 4 pixels wide
```

### `mouth/neutral.png`
- فایل: `assets/character/mouth/neutral.png`

```
[LAYER PREFIX] a flat neutral mouth only, a 4x1 pixel dusty red line
```

### `mouth/open.png`
- فایل: `assets/character/mouth/open.png`

```
[LAYER PREFIX] an open mouth only, dark red inside with a tiny pink tongue, 4x2 pixels, surprised or cheering
```

### `mouth/smirk.png`
- فایل: `assets/character/mouth/smirk.png`

```
[LAYER PREFIX] a cocky smirk only, lifted on one side
```

### `mouth/sad.png`
- فایل: `assets/character/mouth/sad.png`

```
[LAYER PREFIX] a small sad frowning mouth only, corners down
```

## ۱۲) ابرو — `eyebrow`

**رنگ‌پذیر (رنگ ابرو)** — خاکستری/سفید بکشید.

### `eyebrow/thin.png`
- فایل: `assets/character/eyebrow/thin.png`

```
[LAYER PREFIX] a pair of thin eyebrows only, 2 pixels wide each, painted WHITE-GRAY (#e6e6e6) so the bot can tint them
```

### `eyebrow/thick.png`
- فایل: `assets/character/eyebrow/thick.png`

```
[LAYER PREFIX] a pair of thick bold eyebrows only, 3x2 pixels each, painted white-gray (#e6e6e6) for tinting
```

### `eyebrow/angled.png`
- فایل: `assets/character/eyebrow/angled.png`

```
[LAYER PREFIX] a pair of angled determined eyebrows only, slanting down toward the nose, painted white-gray for tinting
```

### `eyebrow/straight.png`
- فایل: `assets/character/eyebrow/straight.png`

```
[LAYER PREFIX] a pair of straight flat eyebrows only, 3x1 pixels each, painted white-gray for tinting
```

## ۱۳) مو — `hair_front` و `hair_back`

**رنگ‌پذیر (رنگ مو)** — خاکستری روشن بکشید. هر مو یک لایهٔ **جلو** (`hair_front`، روی صورت) دارد و مدل‌های `long` ، `ponytail` و `twintail` یک لایهٔ **پشت** (`hair_back`، پشت بدن) هم دارند. مدل `bald` (بدون مو) عکس لازم ندارد.

### `hair_front/short.png`
- فایل: `assets/character/hair_front/short.png`

```
[LAYER PREFIX] short neat hair, cap covering the top of the head with small sideburns, painted in neutral light gray (#e6e6e6) with white highlight pixels and mid-gray shading so the bot can tint it, painted in neutral light gray (#e6e6e6) with mid-gray shading for tinting
```

### `hair_front/spiky.png`
- فایل: `assets/character/hair_front/spiky.png`

```
[LAYER PREFIX] spiky anime hair with four pointed spikes on top, painted in neutral light gray with shading for tinting, painted in neutral light gray (#e6e6e6) with mid-gray shading for tinting
```

### `hair_front/long.png`
- فایل: `assets/character/hair_front/long.png`

```
[LAYER PREFIX] long straight hair, FRONT part: top cap, fringe and side locks only, painted in neutral light gray (#e6e6e6) with mid-gray shading for tinting
```

### `hair_front/ponytail.png`
- فایل: `assets/character/hair_front/ponytail.png`

```
[LAYER PREFIX] hair tied into a high ponytail, FRONT part: top cap and sideburns only, painted in neutral light gray (#e6e6e6) with mid-gray shading for tinting
```

### `hair_front/twintail.png`
- فایل: `assets/character/hair_front/twintail.png`

```
[LAYER PREFIX] hair in twin tails, FRONT part: top cap and sideburns only, painted in neutral light gray (#e6e6e6) with mid-gray shading for tinting
```

### `hair_front/bun.png`
- فایل: `assets/character/hair_front/bun.png`

```
[LAYER PREFIX] hair in a round top bun, FRONT part: cap and the bun on top, painted in neutral light gray (#e6e6e6) with mid-gray shading for tinting
```

### `hair_back/long.png`
- فایل: `assets/character/hair_back/long.png`

```
[LAYER PREFIX] long straight hair, BACK part only: the long hair mass that falls behind the head and shoulders down to the waist (it is drawn behind the body), painted in neutral light gray (#e6e6e6) with mid-gray shading for tinting
```

### `hair_back/ponytail.png`
- فایل: `assets/character/hair_back/ponytail.png`

```
[LAYER PREFIX] a ponytail BACK part only: the tail hanging down on the right side behind the arm, with a small red tie at the top, painted in neutral light gray (#e6e6e6) with mid-gray shading for tinting
```

### `hair_back/twintail.png`
- فایل: `assets/character/hair_back/twintail.png`

```
[LAYER PREFIX] twin tails BACK part only: two long tails hanging on both sides behind the arms, with small red ribbons at the top, painted in neutral light gray (#e6e6e6) with mid-gray shading for tinting
```

## ۱۴) سیبیل / ریش — `mustache`

**رنگ‌پذیر (رنگ سیبیل)**. گزینهٔ `none` عکس ندارد.

### `mustache/classic.png`
- فایل: `assets/character/mustache/classic.png`

```
[LAYER PREFIX] a classic straight mustache only, painted light gray (#e6e6e6) for tinting, sitting between nose and mouth, 8 pixels wide
```

### `mustache/handlebar.png`
- فایل: `assets/character/mustache/handlebar.png`

```
[LAYER PREFIX] a curly handlebar mustache only, ends curled upward, light gray for tinting
```

### `mustache/goatee.png`
- فایل: `assets/character/mustache/goatee.png`

```
[LAYER PREFIX] a small mustache plus a chin goatee only, light gray for tinting
```

### `mustache/beard.png`
- فایل: `assets/character/mustache/beard.png`

```
[LAYER PREFIX] a full beard covering the jaw and cheeks with a mustache only, light gray for tinting, leave the mouth area readable
```

## ۱۵) لباس‌ها و لوازم — `gear`

**رنگی نهایی**، رنگ نمی‌شوند. «لباس پیش‌فرض» (سه مورد اول `free`: `ADVENTURER` ، `BASIC_PANTS` ، `BASIC_BOOTS`) رایگان است و بقیه از فروشگاه خریده می‌شوند. هر لایه باید **روی همان بدن مرجع** بنشیند (برای دختر و پسر یک لایه مشترک است؛ تنهٔ دختر کمی باریک‌تر است، پس لباس را برای `176…336` پسر بکشید و کمی ارتجاعی/گشاد باشد).

### ترتیب لایه‌ها از عقب به جلو
`cape` ← `hair_back` ← `body` ← `bottom` ← `shoes` ← `top` ← `gloves` ← `face` ← `ears` ← `eyes` ← `nose` ← `mustache` ← `mouth` ← `eyebrow` ← `hair_front` ← `hat` ← `accessory` ← `weapon`

#### دستهٔ «لباس بالاتنه» (`top`)

##### `gear/ADVENTURER.png`
- فایل: `assets/character/gear/ADVENTURER.png`  — محصول فروشگاه: (رایگان، پیش‌فرض)

```
[LAYER PREFIX] default simple adventurer tunic: blue (#4f7ac7) with dark blue (#2f4a85) belt and collar, short sleeves, small gold buckle, the top layer only, drawn exactly over the reference body, everything else transparent
```

##### `gear/LEATHER_ARMOR.png`
- فایل: `assets/character/gear/LEATHER_ARMOR.png`  — محصول فروشگاه: `GEAR_LEATHER_ARMOR`

```
[LAYER PREFIX] brown leather armor vest with shoulder pads and a belt, the top layer only, drawn exactly over the reference body, everything else transparent
```

##### `gear/IRON_ARMOR.png`
- فایل: `assets/character/gear/IRON_ARMOR.png`  — محصول فروشگاه: `GEAR_IRON_ARMOR`

```
[LAYER PREFIX] shiny steel plate armor with big pauldrons, chest plate and gold belt buckle, the top layer only, drawn exactly over the reference body, everything else transparent
```

##### `gear/MAGE_ROBE.png`
- فایل: `assets/character/gear/MAGE_ROBE.png`  — محصول فروشگاه: `GEAR_MAGE_ROBE`

```
[LAYER PREFIX] long purple mage robe with gold trim and wide sleeves, reaching down over the knees, the top layer only, drawn exactly over the reference body, everything else transparent
```

##### `gear/NOBLE_COAT.png`
- فایل: `assets/character/gear/NOBLE_COAT.png`  — محصول فروشگاه: `GEAR_NOBLE_COAT`

```
[LAYER PREFIX] noble crimson coat with gold buttons, gold collar and cuffs, the top layer only, drawn exactly over the reference body, everything else transparent
```

#### دستهٔ «شلوار» (`bottom`)

##### `gear/BASIC_PANTS.png`
- فایل: `assets/character/gear/BASIC_PANTS.png`  — محصول فروشگاه: (رایگان، پیش‌فرض)

```
[LAYER PREFIX] default plain dark blue-gray pants, the bottom layer only, drawn exactly over the reference body, everything else transparent
```

##### `gear/LEATHER_PANTS.png`
- فایل: `assets/character/gear/LEATHER_PANTS.png`  — محصول فروشگاه: `GEAR_LEATHER_PANTS`

```
[LAYER PREFIX] brown leather pants, the bottom layer only, drawn exactly over the reference body, everything else transparent
```

##### `gear/IRON_GREAVES.png`
- فایل: `assets/character/gear/IRON_GREAVES.png`  — محصول فروشگاه: `GEAR_IRON_GREAVES`

```
[LAYER PREFIX] steel leg greaves with knee plates over dark pants, the bottom layer only, drawn exactly over the reference body, everything else transparent
```

#### دستهٔ «کفش» (`shoes`)

##### `gear/BASIC_BOOTS.png`
- فایل: `assets/character/gear/BASIC_BOOTS.png`  — محصول فروشگاه: (رایگان، پیش‌فرض)

```
[LAYER PREFIX] default plain brown boots, the shoes layer only, drawn exactly over the reference body, everything else transparent
```

##### `gear/LEATHER_BOOTS.png`
- فایل: `assets/character/gear/LEATHER_BOOTS.png`  — محصول فروشگاه: `GEAR_LEATHER_BOOTS`

```
[LAYER PREFIX] light-brown leather boots with darker cuffs, the shoes layer only, drawn exactly over the reference body, everything else transparent
```

##### `gear/IRON_BOOTS.png`
- فایل: `assets/character/gear/IRON_BOOTS.png`  — محصول فروشگاه: `GEAR_IRON_BOOTS`

```
[LAYER PREFIX] steel armored boots, the shoes layer only, drawn exactly over the reference body, everything else transparent
```

#### دستهٔ «دستکش» (`gloves`)

##### `gear/LEATHER_GLOVES.png`
- فایل: `assets/character/gear/LEATHER_GLOVES.png`  — محصول فروشگاه: `GEAR_LEATHER_GLOVES`

```
[LAYER PREFIX] brown leather gloves with dark cuffs (a pair of hands only), the gloves layer only, drawn exactly over the reference body, everything else transparent
```

##### `gear/IRON_GAUNTLETS.png`
- فایل: `assets/character/gear/IRON_GAUNTLETS.png`  — محصول فروشگاه: `GEAR_IRON_GAUNTLETS`

```
[LAYER PREFIX] steel gauntlets (a pair of hands only), the gloves layer only, drawn exactly over the reference body, everything else transparent
```

#### دستهٔ «شنل» (`cape`)

##### `gear/RED_CAPE.png`
- فایل: `assets/character/gear/RED_CAPE.png`  — محصول فروشگاه: `GEAR_RED_CAPE`

```
[LAYER PREFIX] red cape falling behind the body from the shoulders to the feet, with a small clasp at the neck (cape is drawn BEHIND the body), the cape layer only, drawn exactly over the reference body, everything else transparent
```

##### `gear/ROYAL_CAPE.png`
- فایل: `assets/character/gear/ROYAL_CAPE.png`  — محصول فروشگاه: `GEAR_ROYAL_CAPE`

```
[LAYER PREFIX] royal purple cape with golden hem, behind the body, the cape layer only, drawn exactly over the reference body, everything else transparent
```

#### دستهٔ «کلاه» (`hat`)

##### `gear/KNIGHT_HELM.png`
- فایل: `assets/character/gear/KNIGHT_HELM.png`  — محصول فروشگاه: `GEAR_KNIGHT_HELM`

```
[LAYER PREFIX] steel knight helmet with side plates, nose guard and a small red plume, the hat layer only, drawn exactly over the reference body, everything else transparent
```

##### `gear/WIZARD_HAT.png`
- فایل: `assets/character/gear/WIZARD_HAT.png`  — محصول فروشگاه: `GEAR_WIZARD_HAT`

```
[LAYER PREFIX] purple wizard hat with a wide brim, gold band and a pointed tip, the hat layer only, drawn exactly over the reference body, everything else transparent
```

##### `gear/BANDANA.png`
- فایل: `assets/character/gear/BANDANA.png`  — محصول فروشگاه: `GEAR_BANDANA`

```
[LAYER PREFIX] red headband bandana with a knot on the right side, the hat layer only, drawn exactly over the reference body, everything else transparent
```

##### `gear/CROWN.png`
- فایل: `assets/character/gear/CROWN.png`  — محصول فروشگاه: `GEAR_CROWN`

```
[LAYER PREFIX] small golden crown with three points and a red gem, the hat layer only, drawn exactly over the reference body, everything else transparent
```

#### دستهٔ «سلاح» (`weapon`)

##### `gear/WOOD_SWORD.png`
- فایل: `assets/character/gear/WOOD_SWORD.png`  — محصول فروشگاه: `GEAR_WOOD_SWORD`

```
[LAYER PREFIX] wooden practice sword held vertically at the character's right hand (image right side), brown, the weapon layer only, drawn exactly over the reference body, everything else transparent
```

##### `gear/IRON_SWORD.png`
- فایل: `assets/character/gear/IRON_SWORD.png`  — محصول فروشگاه: `GEAR_IRON_SWORD`

```
[LAYER PREFIX] steel longsword held vertically at the right hand, silver blade, brown crossguard, the weapon layer only, drawn exactly over the reference body, everything else transparent
```

##### `gear/FLAME_SWORD.png`
- فایل: `assets/character/gear/FLAME_SWORD.png`  — محصول فروشگاه: `GEAR_FLAME_SWORD`

```
[LAYER PREFIX] sword with a glowing orange blade and yellow core, small flames licking the tip, held vertically at the right hand, the weapon layer only, drawn exactly over the reference body, everything else transparent
```

##### `gear/MAGE_STAFF.png`
- فایل: `assets/character/gear/MAGE_STAFF.png`  — محصول فروشگاه: `GEAR_MAGE_STAFF`

```
[LAYER PREFIX] wooden staff with a glowing cyan orb on top, held vertically at the right hand, the weapon layer only, drawn exactly over the reference body, everything else transparent
```

#### دستهٔ «اکسسوری» (`accessory`)

##### `gear/GLASSES.png`
- فایل: `assets/character/gear/GLASSES.png`  — محصول فروشگاه: `GEAR_GLASSES`

```
[LAYER PREFIX] round dark-framed glasses with light-blue lenses sitting over the eyes, the accessory layer only, drawn exactly over the reference body, everything else transparent
```

##### `gear/HERO_MASK.png`
- فایل: `assets/character/gear/HERO_MASK.png`  — محصول فروشگاه: `GEAR_HERO_MASK`

```
[LAYER PREFIX] black domino eye mask with white eye openings, the accessory layer only, drawn exactly over the reference body, everything else transparent
```

##### `gear/AMULET.png`
- فایل: `assets/character/gear/AMULET.png`  — محصول فروشگاه: `GEAR_AMULET`

```
[LAYER PREFIX] gold chain necklace with a pink gem pendant resting on the chest, the accessory layer only, drawn exactly over the reference body, everything else transparent
```

## ۱۶) چک‌لیست

- [ ] همهٔ فایل‌ها `512×768` ، PNG ، پس‌زمینهٔ شفاف
- [ ] لبه‌های پیکسلی تیز (بدون محوشدگی)
- [ ] قطعات رنگ‌پذیر خاکستری/سفید خنثی هستند
- [ ] جای اعضا با `zones_grid.png` یکی است
- [ ] مسیر و نام فایل‌ها (حروف بزرگ/کوچک) مثل بالا

با اجرای `node scripts/checkAssets.js` می‌توانید وضعیت عکس‌های `assets` را ببینید. برای تست: در مینی‌اپ شخصیت را عوض کنید و در گروه «شخصیت» بنویسید.
