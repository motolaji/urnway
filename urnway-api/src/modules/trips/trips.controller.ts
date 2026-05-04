import type { RequestHandler } from 'express';

import { fail, ok } from '../../utils/api-response.js';
import {
  createTripItineraryItemSchema,
  createTripSchema,
  generateTripItinerarySchema,
  itineraryItemIdSchema,
  tripIdSchema,
  updateTripItineraryItemSchema,
  updateTripSchema,
} from './trips.schema.js';
import {
  createTrip,
  createTripItineraryItem,
  generateTripItineraryDraft,
  getTripById,
  listUserTrips,
  updateTrip,
  updateTripItineraryItem,
} from './trips.service.js';

function getUserFromRequest(req: Express.Request) {
  if (!req.user) {
    throw new Error('Authenticated user missing from request');
  }

  return req.user;
}

export const listTripsHandler: RequestHandler = (req, res) => {
  try {
    return Promise.resolve(listUserTrips(getUserFromRequest(req))).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    res.status(401).json(fail(error instanceof Error ? error.message : 'Unauthorized'));
  }
};

export const createTripHandler: RequestHandler = (req, res) => {
  try {
    const input = createTripSchema.parse(req.body);

    return Promise.resolve(createTrip(getUserFromRequest(req), input)).then((data) => {
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

export const getTripHandler: RequestHandler = (req, res) => {
  try {
    const { id } = tripIdSchema.parse(req.params);

    return Promise.resolve(getTripById(getUserFromRequest(req), id)).then((data) => {
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

export const updateTripHandler: RequestHandler = (req, res) => {
  try {
    const { id } = tripIdSchema.parse(req.params);
    const input = updateTripSchema.parse(req.body);

    return Promise.resolve(updateTrip(getUserFromRequest(req), id, input)).then((data) => {
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

export const createTripItineraryItemHandler: RequestHandler = (req, res) => {
  try {
    const { id } = tripIdSchema.parse(req.params);
    const input = createTripItineraryItemSchema.parse(req.body);

    return Promise.resolve(
      createTripItineraryItem(getUserFromRequest(req), id, input)
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

export const updateTripItineraryItemHandler: RequestHandler = (req, res) => {
  try {
    const { id } = tripIdSchema.parse(req.params);
    const { itemId } = itineraryItemIdSchema.parse(req.params);
    const input = updateTripItineraryItemSchema.parse(req.body);

    return Promise.resolve(
      updateTripItineraryItem(getUserFromRequest(req), id, itemId, input)
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

export const generateTripItineraryHandler: RequestHandler = (req, res) => {
  try {
    const { id } = tripIdSchema.parse(req.params);
    const input = generateTripItinerarySchema.parse(req.body ?? {});

    return Promise.resolve(
      generateTripItineraryDraft(getUserFromRequest(req), id, input)
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
