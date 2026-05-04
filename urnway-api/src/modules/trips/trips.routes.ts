import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import {
  createTripHandler,
  createTripItineraryItemHandler,
  generateTripItineraryHandler,
  getTripHandler,
  listTripsHandler,
  updateTripItineraryItemHandler,
  updateTripHandler,
} from './trips.controller.js';

export const tripsRouter = Router();

tripsRouter.get('/', requireAuth, listTripsHandler);
tripsRouter.post('/', requireAuth, createTripHandler);
tripsRouter.get('/:id', requireAuth, getTripHandler);
tripsRouter.patch('/:id', requireAuth, updateTripHandler);
tripsRouter.post('/:id/itinerary/generate', requireAuth, generateTripItineraryHandler);
tripsRouter.post('/:id/itinerary', requireAuth, createTripItineraryItemHandler);
tripsRouter.patch(
  '/:id/itinerary/:itemId',
  requireAuth,
  updateTripItineraryItemHandler
);
