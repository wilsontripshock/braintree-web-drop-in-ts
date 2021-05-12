'use strict';

module.exports = function (win) {
  win = win || window;

  return Boolean(win.document.characterSet && win.document.characterSet.toLowerCase() === 'utf-8');
};
