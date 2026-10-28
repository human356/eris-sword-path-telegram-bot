/* eslint-disable */
// Shared (Node + browser) catalog of the semi-pixel character: every customisable part,
// the default look and the gear sprites. Loaded by the server (require) and by the Mini App (<script>).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CharParts = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const opt = (id, label) => ({ id, label });

  const GENDERS = [opt('male', 'پسر'), opt('female', 'دختر')];
  const FACES = [opt('round', 'گرد'), opt('oval', 'بیضی'), opt('square', 'مربعی'), opt('heart', 'قلبی')];
  const EARS = [opt('normal', 'معمولی'), opt('pointed', 'کشیده (الف)'), opt('small', 'کوچک'), opt('large', 'بزرگ')];
  const EYES = [opt('normal', 'معمولی'), opt('round', 'درشت'), opt('sharp', 'تیز'), opt('sleepy', 'خواب‌آلود'), opt('happy', 'خندان')];
  const MOUTHS = [opt('smile', 'لبخند'), opt('neutral', 'خنثی'), opt('open', 'باز'), opt('smirk', 'پوزخند'), opt('sad', 'ناراحت')];
  const NOSES = [opt('small', 'کوچک'), opt('normal', 'معمولی'), opt('big', 'بزرگ'), opt('pointed', 'کشیده')];
  const EYEBROWS = [opt('thin', 'نازک'), opt('thick', 'کلفت'), opt('angled', 'زاویه‌دار'), opt('straight', 'صاف')];
  const HAIRS = [
    opt('short', 'کوتاه'), opt('spiky', 'سیخ‌سیخی'), opt('long', 'بلند'), opt('ponytail', 'دم‌اسبی'),
    opt('twintail', 'دو‌دم'), opt('bun', 'گره‌ای'), opt('bald', 'بدون مو'),
  ];
  const MUSTACHES = [opt('none', 'ندارد'), opt('classic', 'کلاسیک'), opt('handlebar', 'فرفری'), opt('goatee', 'خط‌ریش'), opt('beard', 'ریش کامل')];

  const HAIR_COLORS = ['#1b1b1f', '#5a3a22', '#e0b84c', '#c0392b', '#e8e8ee', '#3b6fd4', '#3a9a5b', '#7b4fc4', '#e07aa8', '#e67e22'];
  const SKIN_COLORS = ['#ffe0c7', '#f5c9a0', '#e0a878', '#b9794d', '#8a5634', '#5e3a22'];
  const EYE_COLORS = ['#2b2b33', '#5a3a22', '#3b6fd4', '#3a9a5b', '#c0392b', '#7b4fc4', '#d4a017'];

  const SLOTS = [
    { id: 'hat', label: 'کلاه' },
    { id: 'top', label: 'لباس بالاتنه' },
    { id: 'bottom', label: 'شلوار' },
    { id: 'shoes', label: 'کفش' },
    { id: 'gloves', label: 'دستکش' },
    { id: 'cape', label: 'شنل' },
    { id: 'weapon', label: 'سلاح' },
    { id: 'accessory', label: 'اکسسوری' },
  ];

  // Gear sprites: id -> how the procedural renderer draws it. Items in items.json point here via
  // "gear": { "slot", "id" }. The three "free" ones are the default outfit.
  const GEAR = {
    ADVENTURER:    { slot: 'top', label: 'لباس ماجراجو', free: true, shape: 'tunic', c1: '#4f7ac7', c2: '#2f4a85' },
    LEATHER_ARMOR: { slot: 'top', label: 'زره چرمی', shape: 'armor', c1: '#8a5a33', c2: '#5a3a1e' },
    IRON_ARMOR:    { slot: 'top', label: 'زره آهنی', shape: 'armor', c1: '#aab4c0', c2: '#6b7684' },
    MAGE_ROBE:     { slot: 'top', label: 'ردای جادوگر', shape: 'robe', c1: '#6b4fc4', c2: '#f0c84a' },
    NOBLE_COAT:    { slot: 'top', label: 'لباس اشرافی', shape: 'noble', c1: '#a02848', c2: '#f0c84a' },
    BASIC_PANTS:   { slot: 'bottom', label: 'شلوار ساده', free: true, shape: 'pants', c1: '#3b3f58', c2: '#2a2d40' },
    LEATHER_PANTS: { slot: 'bottom', label: 'شلوار چرمی', shape: 'pants', c1: '#7a4f2c', c2: '#55361d' },
    IRON_GREAVES:  { slot: 'bottom', label: 'ساق‌بند آهنی', shape: 'greaves', c1: '#aab4c0', c2: '#6b7684' },
    BASIC_BOOTS:   { slot: 'shoes', label: 'چکمه ساده', free: true, shape: 'boots', c1: '#5a3a22', c2: '#3a2414' },
    LEATHER_BOOTS: { slot: 'shoes', label: 'چکمه چرمی', shape: 'boots', c1: '#9a6a3a', c2: '#6a4624' },
    IRON_BOOTS:    { slot: 'shoes', label: 'چکمه آهنی', shape: 'boots', c1: '#aab4c0', c2: '#6b7684' },
    LEATHER_GLOVES:{ slot: 'gloves', label: 'دستکش چرمی', shape: 'gloves', c1: '#8a5a33', c2: '#5a3a1e' },
    IRON_GAUNTLETS:{ slot: 'gloves', label: 'دستکش آهنی', shape: 'gloves', c1: '#aab4c0', c2: '#6b7684' },
    RED_CAPE:      { slot: 'cape', label: 'شنل قرمز', shape: 'cape', c1: '#c0392b', c2: '#8a2519' },
    ROYAL_CAPE:    { slot: 'cape', label: 'شنل سلطنتی', shape: 'cape', c1: '#5b2a9a', c2: '#f0c84a' },
    KNIGHT_HELM:   { slot: 'hat', label: 'کلاه‌خود شوالیه', shape: 'helm', c1: '#aab4c0', c2: '#6b7684' },
    WIZARD_HAT:    { slot: 'hat', label: 'کلاه جادوگر', shape: 'wizard', c1: '#6b4fc4', c2: '#f0c84a' },
    BANDANA:       { slot: 'hat', label: 'سربند', shape: 'band', c1: '#c0392b', c2: '#8a2519' },
    CROWN:         { slot: 'hat', label: 'تاج', shape: 'crown', c1: '#f0c84a', c2: '#c9a227' },
    WOOD_SWORD:    { slot: 'weapon', label: 'شمشیر چوبی', shape: 'sword', c1: '#b98a52', c2: '#7a5530' },
    IRON_SWORD:    { slot: 'weapon', label: 'شمشیر آهنی', shape: 'sword', c1: '#d6dde6', c2: '#8a6a3a' },
    FLAME_SWORD:   { slot: 'weapon', label: 'شمشیر شعله', shape: 'flamesword', c1: '#ff7a2a', c2: '#ffd34a' },
    MAGE_STAFF:    { slot: 'weapon', label: 'عصای جادو', shape: 'staff', c1: '#7a5530', c2: '#58c4ff' },
    GLASSES:       { slot: 'accessory', label: 'عینک', shape: 'glasses', c1: '#222831', c2: '#9ad7ff' },
    HERO_MASK:     { slot: 'accessory', label: 'ماسک', shape: 'mask', c1: '#222831', c2: '#ffffff' },
    AMULET:        { slot: 'accessory', label: 'گردنبند', shape: 'amulet', c1: '#f0c84a', c2: '#d94a6a' },
  };

  const DEFAULT_OUTFIT = { hat: null, top: 'ADVENTURER', bottom: 'BASIC_PANTS', shoes: 'BASIC_BOOTS', gloves: null, cape: null, weapon: null, accessory: null };

  const DEFAULT_APPEARANCE = {
    male: {
      gender: 'male', skin: '#f5c9a0', face: 'round', ears: 'normal', eyes: 'normal', eyeColor: '#2b2b33', mouth: 'smile', nose: 'small',
      eyebrow: 'straight', eyebrowColor: '#5a3a22', hair: 'short', hairColor: '#5a3a22', mustache: 'none', mustacheColor: '#5a3a22',
    },
    female: {
      gender: 'female', skin: '#ffe0c7', face: 'oval', ears: 'normal', eyes: 'round', eyeColor: '#c0392b', mouth: 'smile', nose: 'small',
      eyebrow: 'thin', eyebrowColor: '#c0392b', hair: 'twintail', hairColor: '#c0392b', mustache: 'none', mustacheColor: '#c0392b',
    },
  };

  const OPTION_LISTS = {
    gender: GENDERS, face: FACES, ears: EARS, eyes: EYES, mouth: MOUTHS, nose: NOSES,
    eyebrow: EYEBROWS, hair: HAIRS, mustache: MUSTACHES,
  };
  const COLOR_LISTS = {
    skin: SKIN_COLORS, eyeColor: EYE_COLORS, eyebrowColor: HAIR_COLORS, hairColor: HAIR_COLORS, mustacheColor: HAIR_COLORS,
  };

  const hasId = (list, id) => list.some((o) => o.id === id);

  /** Returns a clean, complete appearance (unknown / missing values fall back to the gender's default). */
  function sanitizeAppearance(input) {
    const raw = input && typeof input === 'object' ? input : {};
    const gender = hasId(GENDERS, raw.gender) ? raw.gender : 'male';
    const out = { ...DEFAULT_APPEARANCE[gender] };
    for (const [key, list] of Object.entries(OPTION_LISTS)) {
      if (key === 'gender') continue;
      if (hasId(list, raw[key])) out[key] = raw[key];
    }
    for (const [key, list] of Object.entries(COLOR_LISTS)) {
      if (typeof raw[key] === 'string' && list.includes(raw[key].toLowerCase())) out[key] = raw[key].toLowerCase();
    }
    out.gender = gender;
    return out;
  }

  /**
   * Returns a clean outfit. `ownedGear` (Set of gear ids the player may wear) is optional:
   * when given, anything not owned (and not free) is dropped.
   */
  function sanitizeOutfit(input, ownedGear) {
    const raw = input && typeof input === 'object' ? input : {};
    const out = { ...DEFAULT_OUTFIT };
    for (const slot of SLOTS) {
      const id = raw[slot.id];
      if (id === null) { out[slot.id] = slot.id === 'top' || slot.id === 'bottom' || slot.id === 'shoes' ? DEFAULT_OUTFIT[slot.id] : null; continue; }
      if (typeof id !== 'string' || !GEAR[id] || GEAR[id].slot !== slot.id) continue;
      if (ownedGear && !GEAR[id].free && !ownedGear.has(id)) continue;
      out[slot.id] = id;
    }
    return out;
  }

  return {
    GENDERS, FACES, EARS, EYES, MOUTHS, NOSES, EYEBROWS, HAIRS, MUSTACHES,
    HAIR_COLORS, SKIN_COLORS, EYE_COLORS, SLOTS, GEAR, DEFAULT_OUTFIT, DEFAULT_APPEARANCE,
    OPTION_LISTS, COLOR_LISTS, sanitizeAppearance, sanitizeOutfit,
  };
});
