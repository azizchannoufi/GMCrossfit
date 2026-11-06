/**
 * GMCrossfit Cloud Functions entry point (2nd gen, Node 20).
 * Region: europe-west1
 */
const { initializeApp } = require("firebase-admin/app");

initializeApp();

const { createOrder } = require("./createOrder");
const { notifyOrder } = require("./notifyOrder");
const { productShare } = require("./productShare");
const { sitemap } = require("./sitemap");
const { trackEvent } = require("./trackEvent");

exports.createOrder = createOrder;
exports.notifyOrder = notifyOrder;
exports.productShare = productShare;
exports.sitemap = sitemap;
exports.trackEvent = trackEvent;
