import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import {
  completeSendCheckoutHandler,
  completeNearbyPaymentIntentHandler,
  createNearbyPaymentIntentHandler,
  createPaymentQrHandler,
  createPaymentLinkHandler,
  deletePaymentLinkHandler,
  getSendCheckoutHandler,
  getNearbyPaymentIntentHandler,
  getPublicPaymentQrHandler,
  getPaymentsOverviewHandler,
  getPublicPaymentLinkHandler,
  listPaymentLinksHandler,
  prepareSendCheckoutHandler,
  preflightDirectSendHandler,
  preflightPaymentQrHandler,
  preflightPaymentLinkHandler,
  resetPaymentLinkHandler,
  submitPaymentLinkHandler,
} from './payments.controller.js';

export const paymentsRouter = Router();

paymentsRouter.get('/', requireAuth, getPaymentsOverviewHandler);
paymentsRouter.post('/send', requireAuth, preflightDirectSendHandler);
paymentsRouter.post('/send/prepare', requireAuth, prepareSendCheckoutHandler);
paymentsRouter.get('/send/:checkoutId', requireAuth, getSendCheckoutHandler);
paymentsRouter.post(
  '/send/:checkoutId/complete',
  requireAuth,
  completeSendCheckoutHandler
);
paymentsRouter.post('/nearby/intents', requireAuth, createNearbyPaymentIntentHandler);
paymentsRouter.get('/nearby/intents/:intentId', requireAuth, getNearbyPaymentIntentHandler);
paymentsRouter.post(
  '/nearby/intents/:intentId/complete',
  requireAuth,
  completeNearbyPaymentIntentHandler
);
paymentsRouter.get('/links', requireAuth, listPaymentLinksHandler);
paymentsRouter.post('/links', requireAuth, createPaymentLinkHandler);
paymentsRouter.post('/qr/generate', requireAuth, createPaymentQrHandler);
paymentsRouter.get('/links/:slug', getPublicPaymentLinkHandler);
paymentsRouter.get('/qr/:qrId', getPublicPaymentQrHandler);
paymentsRouter.post('/links/:slug/pay', requireAuth, preflightPaymentLinkHandler);
paymentsRouter.post('/qr/:qrId/pay', requireAuth, preflightPaymentQrHandler);
paymentsRouter.post('/links/:slug/submit', requireAuth, submitPaymentLinkHandler);
paymentsRouter.post('/links/:slug/reset', requireAuth, resetPaymentLinkHandler);
paymentsRouter.delete('/links/:slug', requireAuth, deletePaymentLinkHandler);
