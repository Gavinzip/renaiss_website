import { consumer } from '../lib/hubQueueConsumer.mjs';
export const POST = consumer('agent');
export default { fetch: POST };
