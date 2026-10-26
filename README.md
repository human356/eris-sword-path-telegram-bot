# ⚔️ Eris — Sword Path

A Telegram group PvP game bot inspired by *Mushoku Tensei*'s Eris Boreas Greyrat. Built with **Node.js** (Telegraf) and **PostgreSQL**.

Players duel each other with turn-based moves (Attack, Heavy Attack, Guard, Dodge, Counter), level up, climb a Sword Rank ladder, train stats, complete daily challenges, and collectively fill a group-wide "Eris Rage" meter that unleashes a boss-style event when it maxes out.

## Features

- **Turn-based PvP duels** — challenge via reply or `@username`, both players pick moves simultaneously each round, resolved with a full damage/crit/dodge/guard/counter engine.
- **Per-group progress** — the same Telegram account has completely independent Level/Rating/Rank in every group it plays in.
- **Sword Rank ladder** — derived from Level + Rating + duel count + win-rate (not just Level), from Beginner up to Sword God.
- **Training** — spend stamina to grind XP and a chance at permanent stat gains, on a cooldown.
- **Daily Challenges** — one random objective per day per player, with claimable rewards.
- **Eris Rage meter** — every duel, training session, and claimed daily challenge nudges a group-wide rage meter. At 100%, Eris challenges the whole group to a timed event where everyone gets one attack and the top damage dealers win big.
- **Leaderboards** — `/top` (per-group) and `/globaltop` (across all groups).
- **Admin tools** — `/give`, `/ban`, `/unban`, `/resetplayer`, `/startevent`, `/settings`.
- **Anti-abuse** — cooldowns on challenges/training, replay-proof callback handling, and reward decay for two players farming each other repeatedly.

## Requirements

- Node.js 18+
- PostgreSQL 13+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

## Setup

```bash
npm install
cp .env.example .env
# edit .env: set BOT_TOKEN and DATABASE_URL (or the discrete PG* vars)

npm run migrate   # creates all tables
npm start         # launches the bot (long polling)
```

Add the bot to a Telegram **group** (not a channel or private chat — the game is group-only) and give it permission to read messages. Then run `/start` in the group.

## Project layout

```
src/
  config/         # env loading + all game-balance constants (edit constants.js to re-tune the game)
  database/       # pg pool, schema.sql, migration runner, and one model file per table
  utils/          # XP curve, ELO, Sword Rank derivation, formatting, anti-abuse helpers
  eris/           # Eris's dialogue lines (dialogues.json — editable without touching code) + rage service
  ranking/        # XP/level, rating (ELO), win-streak services
  economy/        # coin grant/spend helpers
  training/       # /train logic
  battle/         # the combat engine (pure functions) + battle manager (state machine, timers, payouts)
  events/         # Eris Rage Event (group boss-style event)
  services/       # cross-cutting glue (daily challenge progress hooks)
  bot/
    commands/     # one file per slash command
    actions/      # inline-button callback handlers
    middlewares/  # per-update context loading, callback replay guard, admin guard
    keyboards.js  # inline keyboard builders
    views/        # text renderers (profile card, etc.)
  index.js        # bootstrap: wires everything + cron sweeps for expired challenges/events
```

## Re-balancing the game

Every number that affects gameplay (damage multipliers, stamina costs, XP curve, coin rewards, rank thresholds, cooldown lengths, rage gains, etc.) lives in **`src/config/constants.js`**. Nothing else in the codebase hard-codes these values — change them there and restart the bot.

## Editing Eris's dialogue

Her lines live in **`src/eris/dialogues.json`**, grouped by moment (duel win/loss, rank up, rage thresholds, event start/end, etc.). Add or edit lines there; no code changes needed.

## Commands

See `/help` in-bot for the full, current list. Highlights: `/start`, `/profile`, `/fight`, `/train`, `/rank`, `/stats`, `/top`, `/globaltop`, `/daily`, `/rage`, `/event`.

## Notes on scaling

- Battle round timers currently live in-process (`Map`s in `battleManager.js`). If you ever run more than one bot instance, move these to a shared store (Redis) or make Postgres the source of truth for timeouts via a polling sweep — the DB-side state machine is already the source of truth for everything else, so this is a small extension, not a rewrite.
- All authoritative game state is in Postgres; the in-memory pieces are only for coordinating "did both players move yet" within one live round.

## Topics (forum threads)

The bot understands Telegram forum topics. By default every section works in every topic. Group admins can optionally pin sections to specific topics:

1. Open the topic where a section should work and send `/topics`.
2. Tap a section's button — this topic is added to (or removed from) that section. A section with at least one topic only works in those topics; a section with none works everywhere.
3. "♻️ Reset" restores the default (everything everywhere).

Replies, battle prompts, round reports and Eris events are always posted back into the topic they belong to. Buttons of battles that are already running keep working even if the rules change mid-fight. Set `DATABASE_SSL=true` in `.env` for hosted Postgres that requires SSL. The schema is applied automatically on every boot.

## Phase 8 — image profile, inline shop, admin images

**Install first:** `npm install` (adds `@napi-rs/canvas`, used to draw the profile card). Without it the bot still runs and `/profile` falls back to the old text profile.

Environment: `BOT_TOKEN`, `DATABASE_URL`, **`SUPER_ADMIN_IDS`** (the "mother admin" ids, comma separated) and **`BOT_USERNAME`** (without `@`).  
In @BotFather enable **Inline Mode** (`/setinline`, placeholder e.g. `shop`) — required for the `@bot shop` shop.

| Feature | How it works |
|---|---|
| **Image profile** | `/profile` sends a 16:9 card (name, @username, Telegram avatar, level, XP bar, stats, 3 showcase items, title). The card is rendered once, sent, and Telegram's `file_id` is cached in `profile_card_cache` together with a hash of everything drawn. Same hash → re-sent by `file_id` (no rendering). Any change (name, username, avatar, level, stats, showcase, title, template) → re-render + new `file_id`. |
| **Templates** | Free `tpl:DEFAULT` + paid `TPL_*` items (see `items.json`). Put pictures in `assets/templates/<KEY>.png` or send them to the bot with `/admin`. Layout numbers live in `src/config/profileLayout.js`; try them with `npm run preview:card`. |
| **پروفایل من** | «جیب من» → «🖼 پروفایل من»: choose template, choose title, edit showcase, preview, publish. Each change posts the new card in the group (30 s per-player rate limit). |
| **Level-up post** | After a training session that levels the player up, the bot replies to the training result with a photo (`level:<N>`, else `level:default`) and a congratulation naming the player (@username linked). |
| **/start gate** | In groups, a player who never pressed Start in private gets a «start the bot first» notice (5 s cooldown) instead of an answer. Running battles are never interrupted. |
| **Admin images** | In private chat, a super admin sends `/admin` → pick a slot (template / product / level / shop banner) → send the picture as a **Photo**. Admin pictures win over `assets/` files. |
| **Inline shop** | Type `@botusername shop` (optionally + a search word) in any chat → products with photo/description/price. Choosing one posts it with a button that opens the bot privately on the purchase screen (`/start buy_<ITEM>`). |
| **Weekly shop post** | A group admin runs `/shoptopic` inside the desired topic → «📍 همین موضوع». Every week the bot posts the new discounts + decorative rotation there (check every `SHOP_POST_SWEEP_CRON`). |
| **Weekly discounts** | `weekly_offers`: 3 random products get 10–30 % off for 7 days, applied everywhere prices are shown or charged. |
| **Coins** | Battle participation rewards lowered: PvP win 100→40, loss 10→4, PvE 40→15 (`src/config/constants.js`). |

Picture file names (`assets/…`): `templates/DEFAULT.png`, `templates/TPL_FLAME.png`, `items/<ITEM_KEY>.png`, `levels/<N>.png`, `levels/default.png`, `shop/banner.png`. Check with `npm run check:assets`.  
Image prompts for AI generators: [`docs/AI_IMAGE_PROMPTS.md`](docs/AI_IMAGE_PROMPTS.md) (16:9 profile templates + placement map) and [`docs/ITEM_IMAGE_PROMPTS.md`](docs/ITEM_IMAGE_PROMPTS.md) (decorative items, paid templates, products).
