'use strict';

var assign = require('../../lib/assign').assign;
var BaseView = require('../base-view');
var btApplePay = require('braintree-web/apple-pay');
var DropinError = require('../../lib/dropin-error');
var isHTTPS = require('../../lib/is-https');
var Promise = require('../../lib/promise');
var paymentOptionIDs = require('../../constants').paymentOptionIDs;

var DEFAULT_APPLE_PAY_SESSION_VERSION = 2;

function ApplePayView() {
  BaseView.apply(this, arguments);
}

ApplePayView.prototype = Object.create(BaseView.prototype);
ApplePayView.prototype.constructor = ApplePayView;
ApplePayView.ID = ApplePayView.prototype.ID = paymentOptionIDs.applePay;

ApplePayView.prototype.initialize = function () {
  var self = this;

  self.applePayConfiguration = assign({}, self.model.merchantConfiguration.applePay);
  self.applePaySessionVersion = self.applePayConfiguration.applePaySessionVersion || DEFAULT_APPLE_PAY_SESSION_VERSION;

  delete self.applePayConfiguration.applePaySessionVersion;

  return btApplePay.create({client: this.client}).then(function (applePayInstance) {
    var buttonDiv = self.getElementById('apple-pay-button');

    self.applePayInstance = applePayInstance;

    buttonDiv.onclick = self._showPaymentSheet.bind(self);
    buttonDiv.style['-apple-pay-button-style'] = self.model.merchantConfiguration.applePay.buttonStyle || 'black';

    self.model.asyncDependencyReady(ApplePayView.ID);
  }).catch(function (err) {
    self.model.asyncDependencyFailed({
      view: self.ID,
      error: new DropinError(err)
    });
  });
};

ApplePayView.prototype._showPaymentSheet = function () {
  var self = this;
  var request = self.applePayInstance.createPaymentRequest(this.applePayConfiguration.paymentRequest);
  var session = new window.ApplePaySession(self.applePaySessionVersion, request);

  session.onvalidatemerchant = function (event) {
    self.applePayInstance.performValidation({
      validationURL: event.validationURL,
      displayName: self.applePayConfiguration.displayName
    }).then(function (validationData) {
      session.completeMerchantValidation(validationData);
    }).catch(function (validationErr) {
      self.model.reportError(validationErr);
      session.abort();
    });
  };

  session.onpaymentauthorized = function (event) {
    self.applePayInstance.tokenize({
      token: event.payment.token
    }).then(function (payload) {
      session.completePayment(window.ApplePaySession.STATUS_SUCCESS);
      payload.rawPaymentData = event.payment;
      self.model.addPaymentMethod(payload);
    }).catch(function (tokenizeErr) {
      self.model.reportError(tokenizeErr);
      session.completePayment(window.ApplePaySession.STATUS_FAILURE);
    });
  };

  session.begin();

  return false;
};

ApplePayView.prototype.updateConfiguration = function (key, value) {
  this.applePayConfiguration[key] = value;
};

ApplePayView.isEnabled = function (options) {
  var gatewayConfiguration = options.client.getConfiguration().gatewayConfiguration;
  var applePayEnabled = gatewayConfiguration.applePayWeb && Boolean(options.merchantConfiguration.applePay);
  var applePaySessionVersion = options.merchantConfiguration.applePay && options.merchantConfiguration.applePay.applePaySessionVersion;
  var applePayBrowserSupported;

  applePaySessionVersion = applePaySessionVersion || DEFAULT_APPLE_PAY_SESSION_VERSION;

  if (!applePayEnabled) {
    return Promise.resolve(false);
  }

  applePayBrowserSupported = window.ApplePaySession && isHTTPS.isHTTPS();

  if (!applePayBrowserSupported) {
    return Promise.resolve(false);
  }

  if (!window.ApplePaySession.supportsVersion(applePaySessionVersion)) {
    return Promise.resolve(false);
  }

  return Promise.resolve(Boolean(window.ApplePaySession.canMakePayments()));
};

module.exports = ApplePayView;