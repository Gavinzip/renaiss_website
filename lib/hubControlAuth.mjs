import { createHmac, timingSafeEqual } from 'node:crypto';

export function equal(left, right) {
  const a = Buffer.from(left || ''), b = Buffer.from(right || '');
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}
export function internal(request) {
  return Boolean(process.env.HUB_INTERNAL_SECRET) && equal(request.headers.get('authorization'), `Bearer ${process.env.HUB_INTERNAL_SECRET}`);
}
export function statusToken(id) {
  const data = Buffer.from(JSON.stringify({ id, exp: Math.floor(Date.now() / 1000) + 3_600 })).toString('base64url');
  return `${data}.${createHmac('sha256', process.env.HUB_INTERNAL_SECRET).update(data).digest('base64url')}`;
}
export function mayReadJob(token, id) {
  try {
    const [data, signature] = token.split('.');
    if (!equal(signature, createHmac('sha256', process.env.HUB_INTERNAL_SECRET).update(data).digest('base64url'))) return false;
    const value = JSON.parse(Buffer.from(data, 'base64url'));
    return value.id === id && value.exp > Date.now() / 1000;
  } catch { return false; }
}
