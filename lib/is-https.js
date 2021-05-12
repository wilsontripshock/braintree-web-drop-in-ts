'use strict';

function isHTTPS() {
  return window.location.protocol === 'https:';
}

module.exports = {
  isHTTPS: isHTTPS
};
