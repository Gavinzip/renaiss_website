import { logNodeRuntimeVersion } from '../lib/node-runtime-version.mjs';

import { consumer } from '../lib/hubQueueConsumer.mjs';
logNodeRuntimeVersion('hub/api/queue_consumer');
export const POST = consumer('mutation');
export default { fetch: POST };
