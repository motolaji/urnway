import type { RequestHandler } from 'express';

import { fail, ok } from '../../utils/api-response.js';
import {
  bookingIdSchema,
  bookingCheckoutIdSchema,
  completeBookingCheckoutSchema,
  createFlightBookingSchema,
  createHotelBookingSchema,
  flightSearchSchema,
  hotelSearchSchema,
  prepareBookingCheckoutSchema,
} from './bookings.schema.js';
import {
  completeBookingCheckout,
  createFlightBooking,
  createHotelBooking,
  cancelBooking,
  getBookingById,
  issueBoardingPass,
  listUserBookings,
  prepareBookingCheckout,
  searchFlightOffers,
  searchHotelOffers,
} from './bookings.service.js';

function getUserFromRequest(req: Express.Request) {
  if (!req.user) {
    throw new Error('Authenticated user missing from request');
  }

  return req.user;
}

export const listBookingsHandler: RequestHandler = (req, res) => {
  try {
    return Promise.resolve(listUserBookings(getUserFromRequest(req))).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    res.status(401).json(fail(error instanceof Error ? error.message : 'Unauthorized'));
  }
};

export const searchFlightOffersHandler: RequestHandler = (req, res) => {
  try {
    const input = flightSearchSchema.parse(req.body);

    return Promise.resolve(searchFlightOffers(input)).then((data) => {
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

export const createFlightBookingHandler: RequestHandler = (req, res) => {
  try {
    const input = createFlightBookingSchema.parse(req.body);

    return Promise.resolve(createFlightBooking(getUserFromRequest(req), input)).then((data) => {
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

export const searchHotelOffersHandler: RequestHandler = (req, res) => {
  try {
    const input = hotelSearchSchema.parse(req.body);

    return Promise.resolve(searchHotelOffers(input)).then((data) => {
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

export const prepareBookingCheckoutHandler: RequestHandler = (req, res) => {
  try {
    const input = prepareBookingCheckoutSchema.parse(req.body);

    return Promise.resolve(
      prepareBookingCheckout(getUserFromRequest(req), input)
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

export const completeBookingCheckoutHandler: RequestHandler = (req, res) => {
  try {
    const { checkoutId } = bookingCheckoutIdSchema.parse(req.params);
    const input = completeBookingCheckoutSchema.parse(req.body ?? {});

    return Promise.resolve(
      completeBookingCheckout(getUserFromRequest(req), checkoutId, input)
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

export const createHotelBookingHandler: RequestHandler = (req, res) => {
  try {
    const input = createHotelBookingSchema.parse(req.body);

    return Promise.resolve(createHotelBooking(getUserFromRequest(req), input)).then((data) => {
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

export const getBookingHandler: RequestHandler = (req, res) => {
  try {
    const { id } = bookingIdSchema.parse(req.params);

    return Promise.resolve(getBookingById(getUserFromRequest(req), id)).then((data) => {
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

export const issueBoardingPassHandler: RequestHandler = (req, res) => {
  try {
    const { id } = bookingIdSchema.parse(req.params);

    return Promise.resolve(issueBoardingPass(getUserFromRequest(req), id)).then((data) => {
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

export const cancelBookingHandler: RequestHandler = (req, res) => {
  try {
    const { id } = bookingIdSchema.parse(req.params);

    return Promise.resolve(cancelBooking(getUserFromRequest(req), id)).then((data) => {
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
