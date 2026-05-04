import type { RequestHandler } from 'express';

import { fail, ok } from '../../utils/api-response.js';
import {
  searchUsersSchema,
  updateCurrentUserSchema,
  updatePushTokenSchema,
} from './users.schema.js';
import {
  getCurrentUserProfile,
  getCurrentUserPushToken,
  getPublicUserProfile,
  getUserContacts,
  searchUsers,
  updateCurrentUserProfile,
  updateCurrentUserPushToken,
} from './users.service.js';

function readRouteParam(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getUserFromRequest(req: Express.Request) {
  if (!req.user) {
    throw new Error('Authenticated user missing from request');
  }

  return req.user;
}

export const getCurrentUserHandler: RequestHandler = (req, res) => {
  return Promise.resolve(getCurrentUserProfile(getUserFromRequest(req))).then((data) => {
    res.json(ok(data));
  });
};

export const updateCurrentUserHandler: RequestHandler = (req, res) => {
  try {
    const input = updateCurrentUserSchema.parse(req.body);

    return Promise.resolve(
      updateCurrentUserProfile(getUserFromRequest(req), input)
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

export const getCurrentUserPushTokenHandler: RequestHandler = (req, res) => {
  try {
    res.json(ok(getCurrentUserPushToken(getUserFromRequest(req))));
  } catch (error) {
    res.status(401).json(fail(error instanceof Error ? error.message : 'Unauthorized'));
  }
};

export const updateCurrentUserPushTokenHandler: RequestHandler = (req, res) => {
  try {
    const input = updatePushTokenSchema.parse(req.body);

    res.json(ok(updateCurrentUserPushToken(getUserFromRequest(req), input)));
  } catch (error) {
    if (error instanceof Error && error.message === 'Authenticated user missing from request') {
      res.status(401).json(fail(error.message));
      return;
    }

    throw error;
  }
};

export const getPublicUserProfileHandler: RequestHandler = (req, res) =>
  Promise.resolve(getPublicUserProfile(readRouteParam(req.params.username))).then((data) => {
    res.json(ok(data));
  });

export const searchUsersHandler: RequestHandler = (req, res) => {
  const input = searchUsersSchema.parse(req.query);

  res.json(ok(searchUsers(input.q)));
};

export const getUserContactsHandler: RequestHandler = (req, res) => {
  try {
    res.json(ok(getUserContacts(getUserFromRequest(req))));
  } catch (error) {
    res.status(401).json(fail(error instanceof Error ? error.message : 'Unauthorized'));
  }
};
