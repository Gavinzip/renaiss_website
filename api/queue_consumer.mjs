import { consumer } from '../lib/hubQueueConsumer.mjs';
export const POST = consumer('mutation');
export default { fetch: POST };
