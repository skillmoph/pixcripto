// Helpers da carteira quente HD (BIP44 m/44'/60'/0'/0, xpub em HOT_WALLET_XPUB)
// e dos tokens de pedido assinados com HMAC (ORDER_HMAC_SECRET). Sem banco: stateless.
import crypto from 'node:crypto';
import { HDNodeWallet } from 'ethers';
import { ed25519 } from '@noble/curves/ed25519';

export function orderIndex(secret, code) {
  const h = crypto.createHmac('sha256', secret).update('idx:' + code).digest();
  return h.readUInt32BE(0) & 0x7fffffff; // BIP32 não-endurecido
}
export function deriveAddress(xpub, idx) {
  return HDNodeWallet.fromExtendedKey(xpub).deriveChild(idx).address;
}
// ---- Solana: endereço de depósito único por pedido ----
// seed = HMAC(secret, 'sol:'+code) -> ed25519 -> base58(pubkey).
// Determinístico: a chave privada pode ser refeita a qualquer momento
// a partir de ORDER_HMAC_SECRET para mover os fundos recebidos.
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function base58Encode(buf) {
  const digits = [0];
  for (const byte of buf) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) { carry += digits[i] << 8; digits[i] = carry % 58; carry = (carry / 58) | 0; }
    while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = '';
  for (const byte of buf) { if (byte === 0) out += '1'; else break; }
  return out + digits.reverse().map(d => B58[d]).join('');
}
export function deriveSolanaAddress(seedSecret, code) {
  const seed = crypto.createHmac('sha256', seedSecret).update('sol:' + code).digest();
  return base58Encode(Buffer.from(ed25519.getPublicKey(seed)));
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
