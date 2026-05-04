import { Router } from 'express';

import { authRouter } from '../modules/auth/auth.routes.js';
import { boardingPassesRouter } from '../modules/boarding-passes/boarding-passes.routes.js';
import { bookingsRouter } from '../modules/bookings/bookings.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { paymentsRouter } from '../modules/payments/payments.routes.js';
import { tripsRouter } from '../modules/trips/trips.routes.js';
import { usersRouter } from '../modules/users/users.routes.js';
import { vaultsRouter } from '../modules/vaults/vaults.routes.js';
import { walletRouter } from '../modules/wallet/wallet.routes.js';
import { webhooksRouter } from '../modules/webhooks/webhooks.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/wallet', walletRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/trips', tripsRouter);
apiRouter.use('/bookings', bookingsRouter);
apiRouter.use('/boarding-passes', boardingPassesRouter);
apiRouter.use('/vaults', vaultsRouter);
apiRouter.use('/webhooks', webhooksRouter);
