'use strict';

function progressBar(current, max, length = 10) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const filled = Math.round(ratio * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

function pct(current, max) {
  if (max <= 0) return 0;
  return Math.round((current / max) * 100);
}

function num(n) {
  return Number(n).toLocaleString('en-US');
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Safe display name for a Telegram "from" object. */
function displayNameOf(from) {
  if (!from) return 'Unknown';
  return [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || 'Unknown';
}

module.exports = { progressBar, pct, num, escapeHtml, displayNameOf };
