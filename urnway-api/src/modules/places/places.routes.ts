import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import { autocompletePlacesHandler } from './places.controller.js';

export const placesRouter = Router();

placesRouter.get('/autocomplete', requireAuth, autocompletePlacesHandler);
