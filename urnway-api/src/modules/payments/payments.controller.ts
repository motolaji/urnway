import type { RequestHandler } from 'express';

import { fail, ok } from '../../utils/api-response.js';
import {
  createPaymentQrSchema,
  createPaymentLinkSchema,
  resetPaymentLinkSchema,
  sendPaymentSchema,
  submitPaymentLinkSchema,
} from './payments.schema.js';
import {
  generatePaymentQr,
  createPaymentLink,
  deleteUserPaymentLink,
  getPublicPaymentQr,
  getPaymentsOverview,
  getPublicPaymentLink,
  listUserPaymentLinks,
  preflightDirectSendPayment,
  preflightPaymentQrPayment,
  preflightPaymentLinkPayment,
  resetPaymentLink,
  submitPaymentLinkPayment,
} from './payments.service.js';

function readRouteParam(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getUserFromRequest(req: Express.Request) {
  if (!req.user) {
    throw new Error('Authenticated user missing from request');
  }

  return req.user;
}

export const getPaymentsOverviewHandler: RequestHandler = (req, res) => {
  try {
    return Promise.resolve(getPaymentsOverview(getUserFromRequest(req))).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    res.status(401).json(fail(error instanceof Error ? error.message : 'Unauthorized'));
  }
};

export const listPaymentLinksHandler: RequestHandler = (req, res) => {
  try {
    return Promise.resolve(listUserPaymentLinks(getUserFromRequest(req))).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    res.status(401).json(fail(error instanceof Error ? error.message : 'Unauthorized'));
  }
};

export const createPaymentLinkHandler: RequestHandler = (req, res) => {
  try {
    const input = createPaymentLinkSchema.parse(req.body);

    return Promise.resolve(
      createPaymentLink(getUserFromRequest(req), input)
    ).then((data) => {
      res.status(201).json(ok(data));
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authenticated user missing from request') {
      res.status(401).json(fail(error.message));
      return;
    }

    throw error;
  }
};

export const createPaymentQrHandler: RequestHandler = (req, res) => {
  try {
    const input = createPaymentQrSchema.parse(req.body);

    return Promise.resolve(
      generatePaymentQr(getUserFromRequest(req), input)
    ).then((data) => {
      res.status(201).json(ok(data));
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authenticated user missing from request') {
      res.status(401).json(fail(error.message));
      return;
    }

    throw error;
  }
};

export const getPublicPaymentLinkHandler: RequestHandler = (req, res) =>
  Promise.resolve(getPublicPaymentLink(readRouteParam(req.params.slug))).then((data) => {
    res.json(ok(data));
  });

export const getPublicPaymentQrHandler: RequestHandler = (req, res) =>
  Promise.resolve(getPublicPaymentQr(readRouteParam(req.params.qrId))).then((data) => {
    res.json(ok(data));
  });

export const deletePaymentLinkHandler: RequestHandler = (req, res) => {
  try {
    return Promise.resolve(
      deleteUserPaymentLink(getUserFromRequest(req), readRouteParam(req.params.slug))
    ).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    res.status(401).json(fail(error instanceof Error ? error.message : 'Unauthorized'));
  }
};

export const preflightPaymentLinkHandler: RequestHandler = (req, res) => {
  try {
    return Promise.resolve(
      preflightPaymentLinkPayment(
        getUserFromRequest(req),
        readRouteParam(req.params.slug)
      )
    ).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    res.status(401).json(fail(error instanceof Error ? error.message : 'Unauthorized'));
  }
};

export const preflightPaymentQrHandler: RequestHandler = (req, res) => {
  try {
    return Promise.resolve(
      preflightPaymentQrPayment(
        getUserFromRequest(req),
        readRouteParam(req.params.qrId)
      )
    ).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    res.status(401).json(fail(error instanceof Error ? error.message : 'Unauthorized'));
  }
};

export const preflightDirectSendHandler: RequestHandler = (req, res) => {
  try {
    const input = sendPaymentSchema.parse(req.body);

    return Promise.resolve(
      preflightDirectSendPayment(getUserFromRequest(req), input)
    ).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authenticated user missing from request') {
      res.status(401).json(fail(error.message));
      return;
    }

    throw error;
  }
};

export const submitPaymentLinkHandler: RequestHandler = (req, res) => {
  try {
    const input = submitPaymentLinkSchema.parse(req.body);

    return Promise.resolve(
      submitPaymentLinkPayment(
        getUserFromRequest(req),
        readRouteParam(req.params.slug),
        input
      )
    ).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authenticated user missing from request') {
      res.status(401).json(fail(error.message));
      return;
    }

    throw error;
  }
};

export const resetPaymentLinkHandler: RequestHandler = (req, res) => {
  try {
    resetPaymentLinkSchema.parse(req.body ?? {});

    return Promise.resolve(
      resetPaymentLink(getUserFromRequest(req), readRouteParam(req.params.slug))
    ).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authenticated user missing from request') {
      res.status(401).json(fail(error.message));
      return;
    }

    throw error;
  }
};
