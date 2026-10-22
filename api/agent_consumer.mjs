import { logNodeRuntimeVersion } from '../lib/node-runtime-version.mjs';

import { consumer } from '../lib/hubQueueConsumer.mjs';
logNodeRuntimeVersion('hub/api/agent_consumer');
export const POST = consumer('agent');
export default { fetch: POST };
