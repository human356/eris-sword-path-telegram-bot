'use strict';
const dialogues = require('./dialogues.json');

function say(key) {
  const lines = dialogues[key];
  if (!lines || lines.length === 0) return '';
  return lines[Math.floor(Math.random() * lines.length)];
}

module.exports = { say };
