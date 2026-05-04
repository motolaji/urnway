import type { Request, RequestHandler } from 'express';

import { renderDocsPage, renderLandingPage } from './render.js';

function getOrigin(req: Request) {
  const host = req.get('host') ?? 'localhost';
  return `${req.protocol}://${host}`;
}

export const getLandingPage: RequestHandler = (req, res) => {
  res.type('html').send(renderLandingPage({ origin: getOrigin(req) }));
};

export const getDocsPage: RequestHandler = (req, res) => {
  res.type('html').send(renderDocsPage({ origin: getOrigin(req) }));
};
