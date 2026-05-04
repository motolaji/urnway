import { Router } from 'express';

import { getDocsPage, getLandingPage } from './docs.controller.js';

export const docsRouter = Router();

docsRouter.get('/', getLandingPage);
docsRouter.get('/docs', getDocsPage);
