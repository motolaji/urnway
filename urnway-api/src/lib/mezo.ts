import { createPublicClient, http } from 'viem';

import { env } from '../config/env.js';

export const mezoClient = createPublicClient({
  transport: http(env.MEZO_RPC_URL),
});
