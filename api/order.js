// POST /api/order — cria uma operação cripto -> PIX.
// Rede Polygon com HOT_WALLET_XPUB + ORDER_HMAC_SECRET: MODO REAL de recebimento.
// Gera endereço de depósito único derivado da carteira HD e um token assinado
// (HMAC) que carrega os dados do pedido sem banco de dados. O monitoramento
// on-chain acontece em /api/order-status.
// Solana (ou sem xpub configurado): modo demonstração, como antes.
import crypto from 'node:crypto';
import { orderIndex, deriveAddress, deriveSolanaAddress, signToken } from './_wallet.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { mode, net, usdt, brl, pixKey, boleto, coupon, code, feePct } = req.body || {};
  if (!brl || brl < 10 || brl > 250000) return res.status(400).json({ error: 'amount_out_of_range' });
  if (mode === 'pix' && !pixKey) return res.status(400).json({ error: 'pix_key_required' });
  if (!code) return res.status(400).json({ error: 'code_required' });

  const xpub = process.env.HOT_WALLET_XPUB;
  const secret = process.env.ORDER_HMAC_SECRET;

  if (net === 'polygon' && xpub && secret) {
    const idx = orderIndex(secret, code);
    const depositAddress = deriveAddress(xpub, idx);
    const token = signToken(secret, {
      v: 1, code, idx, net,
      usdt: Number(usdt), brl: Number(brl),
      pixKey: mode === 'pix' ? String(pixKey) : null,
      boleto: mode === 'boleto' ? String(boleto).slice(0, 60) : null,
      ts: Date.now()
    });
    return res.status(200).json({
      provider: 'onchain-polygon', code, depositAddress,
      status: 'WAITING_DEPOSIT', token, feePct
    });
  }

  const solSeed = process.env.SOLANA_SEED;
  if (net === 'solana' && solSeed && secret) {
    const depositAddress = deriveSolanaAddress(solSeed, code);
    const token = signToken(secret, {
      v: 1, code, net,
      usdt: Number(usdt), brl: Number(brl),
      pixKey: mode === 'pix' ? String(pixKey) : null,
      boleto: mode === 'boleto' ? String(boleto).slice(0, 60) : null,
      ts: Date.now()
    });
    return res.status(200).json({
      provider: 'onchain-solana', code, depositAddress,
      status: 'WAITING_DEPOSIT', token, feePct
    });
  }

  // ---- modo demonstração (carteira não configurada) ----
  const depositAddress = '0x' + crypto.randomBytes(20).toString('hex');
  return res.status(200).json({ provider: 'demo', code, depositAddress, status: 'WAITING_DEPOSIT', feePct });
}
