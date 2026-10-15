'use strict';
const topicService = require('../../services/topicService');
const { detectFeature, FEATURES } = require('../../config/topicFeatures');
const { getThreadId } = require('../../utils/topic');
const { escapeHtml } = require('../../utils/format');
const { scheduleDelete } = require('../../utils/messageCleanup');

const NOTICE_LIFETIME_MS = 15 * 1000;

/** Learns topic names from service messages / replies so the admin panel can show them. */
function captureTopicName(ctx, groupId, threadId) {
  const msg = ctx.message;
  if (!msg) return;
  const created = msg.forum_topic_created;
  if (created && created.name) {
    topicService.rememberTopicName(groupId, msg.message_thread_id || msg.message_id, created.name).catch(() => {});
    return;
  }
  if (msg.forum_topic_edited && msg.forum_topic_edited.name && threadId) {
    topicService.rememberTopicName(groupId, threadId, msg.forum_topic_edited.name).catch(() => {});
    return;
  }
  const root = msg.reply_to_message && msg.reply_to_message.forum_topic_created;
  if (root && root.name && threadId) {
    topicService.rememberTopicName(groupId, threadId, root.name).catch(() => {});
  }
}

/**
 * Must be registered after ensureContext + autoDeleteMiddleware.
 * Blocks a section when an admin pinned it to other topics. Sections without
 * any rule are never touched, so the feature stays fully optional.
 */
async function topicGuard(ctx, next) {
  if (!ctx.state || !ctx.state.isGroup) return next();

  const groupId = ctx.state.groupId;
  const threadId = getThreadId(ctx);
  ctx.state.threadId = threadId;

  try {
    captureTopicName(ctx, groupId, threadId);

    const feature = detectFeature(ctx);
    if (!feature) return next();
    if (await topicService.isAllowed(groupId, feature, threadId)) return next();

    const allowed = await topicService.getAllowedThreads(groupId, feature);
    const names = await topicService.getNames(groupId);
    const where = allowed.map((id) => topicService.labelOf(names, id)).join('، ');
    const label = FEATURES[feature].label;

    if (ctx.callbackQuery) {
      return await ctx.answerCbQuery(`«${label}» فقط در این موضوع‌ها کار می‌کند: ${where}`, { show_alert: true });
    }

    const sent = await ctx.replyPersist(
      `🧭 بخش «${escapeHtml(label)}» فقط در این موضوع‌ها فعال است:\n<b>${escapeHtml(where)}</b>`,
      { parse_mode: 'HTML' }
    );
    if (sent) scheduleDelete(ctx.telegram, sent.chat.id, sent.message_id, NOTICE_LIFETIME_MS);
    return undefined;
  } catch (err) {
    // A failing guard must never take the whole bot down — fail open.
    // eslint-disable-next-line no-console
    console.error('[topicGuard] failed, allowing update:', err);
    return next();
  }
}

module.exports = topicGuard;
