// Helpers da carteira quente HD (BIP44 m/44'/60'/0'/0, xpub em HOT_WALLET_XPUB)
// e dos tokens de pedido assinados com HMAC (ORDER_HMAC_SECRET). Sem banco: stateless.
import crypto from 'node:crypto';
import { HDNodeWallet } from 'ethers';

export function orderIndex(secret, code) {
  const h = crypto.createHmac('sha256', secret).update('idx:' + code).digest();
  return h.readUInt32BE(0) & 0x7fffffff; // BIP32 não-endurecido
}
export function deriveAddress(xpub, idx) {
  return HDNodeWallet.fromExtendedKey(xpub).deriveChild(idx).address;
}
export function signToken(secret, payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return body + '.' + sig;
}
export function verifyToken(secret, token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const want = crypto.createHmac('sha256', secret).update(body).digest();
  let got; try { got = Buffer.from(sig, 'base64url'); } catch { return null; }
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
}
