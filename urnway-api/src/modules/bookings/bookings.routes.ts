import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import {
  cancelBookingHandler,
  completeBookingCheckoutHandler,
  createFlightBookingHandler,
  createHotelBookingHandler,
  getBookingHandler,
  issueBoardingPassHandler,
  listBookingsHandler,
  prepareBookingCheckoutHandler,
  searchFlightOffersHandler,
  searchHotelOffersHandler,
} from './bookings.controller.js';

export const bookingsRouter = Router();

bookingsRouter.get('/', requireAuth, listBookingsHandler);
bookingsRouter.post('/flights/search', requireAuth, searchFlightOffersHandler);
bookingsRouter.post('/checkout/prepare', requireAuth, prepareBookingCheckoutHandler);
bookingsRouter.post(
  '/checkout/:checkoutId/complete',
  requireAuth,
  completeBookingCheckoutHandler
);
bookingsRouter.post('/flights/book', requireAuth, createFlightBookingHandler);
bookingsRouter.post('/hotels/search', requireAuth, searchHotelOffersHandler);
bookingsRouter.post('/hotels/book', requireAuth, createHotelBookingHandler);
bookingsRouter.get('/:id', requireAuth, getBookingHandler);
bookingsRouter.post('/:id/ticket', requireAuth, issueBoardingPassHandler);
bookingsRouter.post('/:id/cancel', requireAuth, cancelBookingHandler);
