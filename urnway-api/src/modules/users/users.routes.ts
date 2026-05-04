import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import {
  getCurrentUserHandler,
  getCurrentUserPushTokenHandler,
  getPublicUserProfileHandler,
  getUserContactsHandler,
  searchUsersHandler,
  updateCurrentUserHandler,
  updateCurrentUserPushTokenHandler,
} from './users.controller.js';

export const usersRouter = Router();

usersRouter.get('/search', requireAuth, searchUsersHandler);
usersRouter.get('/me/contacts', requireAuth, getUserContactsHandler);
usersRouter.get('/me/push-token', requireAuth, getCurrentUserPushTokenHandler);
usersRouter.put('/me/push-token', requireAuth, updateCurrentUserPushTokenHandler);
usersRouter.get('/me', requireAuth, getCurrentUserHandler);
usersRouter.patch('/me', requireAuth, updateCurrentUserHandler);
usersRouter.get('/:username', getPublicUserProfileHandler);
