import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import {
  cancelBookingHandler,
  createFlightBookingHandler,
  createHotelBookingHandler,
  getBookingHandler,
  issueBoardingPassHandler,
  listBookingsHandler,
  searchFlightOffersHandler,
  searchHotelOffersHandler,
} from './bookings.controller.js';

export const bookingsRouter = Router();

bookingsRouter.get('/', requireAuth, listBookingsHandler);
bookingsRouter.post('/flights/search', requireAuth, searchFlightOffersHandler);
bookingsRouter.post('/flights/book', requireAuth, createFlightBookingHandler);
bookingsRouter.post('/hotels/search', requireAuth, searchHotelOffersHandler);
bookingsRouter.post('/hotels/book', requireAuth, createHotelBookingHandler);
bookingsRouter.get('/:id', requireAuth, getBookingHandler);
bookingsRouter.post('/:id/ticket', requireAuth, issueBoardingPassHandler);
bookingsRouter.post('/:id/cancel', requireAuth, cancelBookingHandler);
