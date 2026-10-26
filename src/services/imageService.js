'use strict';
const fs = require('fs');
const crypto = require('crypto');
const env = require('../config/env');
const slots = require('../config/imageSlots');
const botImageModel = require('../database/models/botImageModel');

/**
 * Single place that knows where every picture of the bot comes from.
 *
 * For each slot key (see config/imageSlots.js) the picture is, in priority order:
 *   1. a photo a super admin sent to the bot in private  -> Telegram file_id
 *   2. a file shipped in /assets                          -> uploaded to Telegram ONCE,
 *      after that it is sent by file_id (re-uploaded only when the file's content changes)
 *   3. nothing -> callers fall back to a text-only message / the built-in card background.
 *
 * Sending by file_id costs the server nothing (no upload, no re-encoding), which is
 * the whole point of the file_id cache.
 */

let telegram = null;

function init(telegramClient) {
  telegram = telegramClient;
}

// ---------------------------------------------------------------------------
// Local files in /assets
// ---------------------------------------------------------------------------

const assetSigCache = new Map(); // path -> { size, mtimeMs, sig }

function findAsset(slotKey) {
  for (const filePath of slots.assetCandidates(slotKey)) {
    let st;
    try {
      st = fs.statSync(filePath);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    const cached = assetSigCache.get(filePath);
    if (cached && cached.size === st.size && cached.mtimeMs === st.mtimeMs) {
      return { path: filePath, sig: cached.sig };
    }
    const sig = crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex').slice(0, 16);
    assetSigCache.set(filePath, { size: st.size, mtimeMs: st.mtimeMs, sig });
    return { path: filePath, sig };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

function largestPhoto(message) {
  const sizes = message && message.photo;
  if (!Array.isArray(sizes) || sizes.length === 0) return null;
  return sizes[sizes.length - 1];
}

/**
 * Describes how to obtain the picture of a slot:
 *   { mode: 'file_id', fileId, sig, asset? }  -> can be sent / used by file_id right now
 *   { mode: 'source', path, sig, asset }      -> only a local file so far (must be uploaded once)
 *   null                                      -> no picture configured
 * `sig` changes whenever the picture changes (used inside the profile-card hash).
 */
async function resolve(slotKey) {
  const row = await botImageModel.getImage(slotKey);

  if (row && row.source === 'admin') {
    return { mode: 'file_id', fileId: row.file_id, sig: `a:${row.file_unique_id || row.file_id.slice(-12)}`, row };
  }

  const asset = findAsset(slotKey);
  if (asset) {
    if (row && row.source === 'asset' && row.asset_sig === asset.sig) {
      return { mode: 'file_id', fileId: row.file_id, sig: `s:${asset.sig}`, asset, row };
    }
    return { mode: 'source', path: asset.path, sig: `s:${asset.sig}`, asset };
  }

  if (row) {
    // The project file was removed after it had been uploaded — keep using Telegram's copy.
    return { mode: 'file_id', fileId: row.file_id, sig: `a:${row.file_unique_id || row.file_id.slice(-12)}`, row };
  }
  return null;
}

async function has(slotKey) {
  return !!(await resolve(slotKey));
}

async function getSignature(slotKey) {
  const r = await resolve(slotKey);
  return r ? r.sig : 'none';
}

/** file_id of the slot's picture, or null when it has to be uploaded first / doesn't exist. */
async function getFileId(slotKey) {
  const r = await resolve(slotKey);
  return r && r.mode === 'file_id' ? r.fileId : null;
}

/**
 * Ready-to-send Telegraf photo input for a slot:
 *   { input, remember(sentMessage) }  — `input` is a file_id or { source: path };
 *   call remember(msg) after a successful send so a freshly uploaded local file
 *   is cached by file_id from then on. Returns null if the slot has no picture.
 */
async function photoFor(slotKey) {
  const r = await resolve(slotKey);
  if (!r) return null;
  if (r.mode === 'file_id') return { input: r.fileId, remember: async () => {} };

  return {
    input: { source: r.path },
    remember: async (sentMessage) => {
      const photo = largestPhoto(sentMessage);
      if (!photo) return;
      await botImageModel.upsertImage({
        slotKey, fileId: photo.file_id, fileUniqueId: photo.file_unique_id, source: 'asset', assetSig: r.asset.sig,
      });
    },
  };
}

/** The first slot of the list that has a picture, e.g. [level:7, level:default]. */
async function photoForFirst(slotKeys) {
  for (const key of slotKeys) {
    const photo = await photoFor(key);
    if (photo) return { ...photo, slotKey: key };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Admin uploads
// ---------------------------------------------------------------------------

async function setFromAdmin(slotKey, photoSize, adminId) {
  if (!slots.isValidSlotKey(slotKey)) throw new Error(`invalid image slot: ${slotKey}`);
  return botImageModel.upsertImage({
    slotKey, fileId: photoSize.file_id, fileUniqueId: photoSize.file_unique_id, source: 'admin', updatedBy: adminId,
  });
}

async function remove(slotKey) {
  return botImageModel.deleteImage(slotKey);
}

async function listConfigured(prefix) {
  return botImageModel.listByPrefix(prefix);
}

// ---------------------------------------------------------------------------
// Raw bytes (only the profile-card renderer needs these: templates / item pictures / avatars)
// ---------------------------------------------------------------------------

const bufferCache = new Map(); // sig -> Buffer (small LRU)
const BUFFER_CACHE_MAX = 40;

function rememberBuffer(sig, buffer) {
  bufferCache.set(sig, buffer);
  if (bufferCache.size > BUFFER_CACHE_MAX) bufferCache.delete(bufferCache.keys().next().value);
}

async function downloadTelegramFile(fileId) {
  if (!telegram) throw new Error('imageService.init(telegram) was not called');
  const link = await telegram.getFileLink(fileId);
  const res = await fetch(String(link));
  if (!res.ok) throw new Error(`Telegram file download failed: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function getBuffer(slotKey) {
  const r = await resolve(slotKey);
  if (!r) return null;
  if (bufferCache.has(r.sig)) return bufferCache.get(r.sig);

  const buffer = r.asset ? await fs.promises.readFile(r.asset.path) : await downloadTelegramFile(r.fileId);
  rememberBuffer(r.sig, buffer);
  return buffer;
}

// ---------------------------------------------------------------------------
// Pre-upload of /assets files so the inline shop can use cached file_ids
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolveFn) => setTimeout(resolveFn, ms));

/**
 * Uploads every /assets picture that Telegram doesn't have yet (or whose file
 * changed) by sending it privately to the first super admin and deleting that
 * message right away. Needed because inline-shop results can only use a
 * file_id, never a local file. Safe to call on every boot (no-op when up to date).
 */
async function primeAssets() {
  if (!telegram) return { uploaded: 0, skipped: 0 };
  const adminId = env.SUPER_ADMIN_IDS[0];
  const keys = slots.listAssetSlotKeys();
  let uploaded = 0;
  let skipped = 0;

  for (const slotKey of keys) {
    let r;
    try {
      r = await resolve(slotKey);
    } catch (err) {
      console.error('[images] resolve failed for', slotKey, err.message);
      continue;
    }
    if (!r || r.mode !== 'source') {
      skipped += 1;
      continue;
    }
    if (!adminId) {
      console.warn('[images] SUPER_ADMIN_IDS is empty — cannot pre-upload /assets pictures (they will still work in posts).');
      break;
    }
    try {
      const msg = await telegram.sendPhoto(adminId, { source: r.path }, { disable_notification: true });
      const photo = largestPhoto(msg);
      if (photo) {
        await botImageModel.upsertImage({
          slotKey, fileId: photo.file_id, fileUniqueId: photo.file_unique_id, source: 'asset', assetSig: r.asset.sig,
        });
        uploaded += 1;
      }
      await telegram.deleteMessage(adminId, msg.message_id).catch(() => {});
    } catch (err) {
      console.error(`[images] could not pre-upload ${slotKey}: ${err.message} (has the super admin pressed Start in private?)`);
      break;
    }
    await sleep(1200);
  }
  return { uploaded, skipped };
}

module.exports = {
  init, resolve, has, getSignature, getFileId, photoFor, photoForFirst,
  setFromAdmin, remove, listConfigured, getBuffer, downloadTelegramFile, primeAssets, largestPhoto, findAsset,
};
