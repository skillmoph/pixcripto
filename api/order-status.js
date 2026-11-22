// GET /api/order-status?token=...  (modo real Polygon: lê o saldo USDT on-chain)
// GET /api/order-status?code=...   (legado/demo)
// Monitor: balanceOf(endereço derivado) no contrato oficial USDT (PoS) da Polygon
// via RPC público gratuito, com fallback.
import { deriveAddress, deriveSolanaAddress, verifyToken } from './_wallet.js';
import { ensurePixTransfer, asaasSandbox } from './_asaas.js';

const USDT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'; // USDT (PoS) na Polygon
const RPCS = ['https://polygon-bor-rpc.publicnode.com', 'https://polygon.drpc.org'];
const USDT_SPL = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'; // USDT na Solana mainnet
const SOL_RPCS = ['https://solana.publicnode.com', 'https://solana.drpc.org', 'https://api.mainnet-beta.solana.com'];

async function usdtBalance(addr) {
  const data = '0x70a08231' + addr.toLowerCase().replace('0x', '').padStart(64, '0');
  for (const url of RPCS) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: USDT, data }, 'latest'] })
      });
      const j = await r.json();
      if (j.result) return Number(BigInt(j.result)) / 1e6; // USDT tem 6 casas
    } catch (e) { /* tenta o próximo RPC */ }
  }
  throw new Error('rpc_unreachable');
}

async function usdtSplBalance(owner) {
  const body = JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner',
    params: [owner, { mint: USDT_SPL }, { encoding: 'jsonParsed' }]
  });
  for (const url of SOL_RPCS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
      const j = await r.json();
      if (j.result && Array.isArray(j.result.value)) {
        return j.result.value.reduce((sum, a) => {
          const amt = a?.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
          return sum + (typeof amt === 'number' ? amt : 0);
        }, 0);
      }
    } catch (e) { /* tenta o próximo RPC */ }
  }
  throw new Error('rpc_unreachable');
}

export default async function handler(req, res) {
  const { token, code } = req.query || {};

  if (token) {
    const secret = process.env.ORDER_HMAC_SECRET;
    const p = secret && verifyToken(secret, token);
    if (!p) return res.status(401).json({ error: 'invalid_token' });

    if (p.net === 'solana') {
      const solSeed = process.env.SOLANA_SEED;
      if (!solSeed) return res.status(401).json({ error: 'invalid_token' });
      const address = deriveSolanaAddress(solSeed, p.code);
      let balance;
      try { balance = await usdtSplBalance(address); }
      catch (e) { return res.status(502).json({ error: 'rpc_unreachable' }); }
      const expected = Number(p.usdt);
      let status = balance <= 0 ? 'WAITING_DEPOSIT'
        : balance + 1e-9 < expected ? 'CONFIRMING'
        : 'CONFIRMED_ONCHAIN';
      let payout = null;
      if (status === 'CONFIRMED_ONCHAIN' && p.pixKey && p.brl) {
        const t = await ensurePixTransfer({ code: p.code, brl: p.brl, pixKey: p.pixKey });
        if (!t.skipped) payout = { provider: 'asaas', sandbox: asaasSandbox(), ...t };
        if (t.status === 'DONE') status = 'PAID';
        else if (!t.error && !t.skipped) status = 'PROCESSING';
      }
      return res.status(200).json({
        status, provider: 'onchain-solana', address,
        balance, expected, code: p.code, payout
      });
    }

    const xpub = process.env.HOT_WALLET_XPUB;
    if (!xpub) return res.status(401).json({ error: 'invalid_token' });
    const address = deriveAddress(xpub, p.idx);
    let balance;
    try { balance = await usdtBalance(address); }
    catch (e) { return res.status(502).json({ error: 'rpc_unreachable' }); }
    const expected = Number(p.usdt);
    let status = balance <= 0 ? 'WAITING_DEPOSIT'
      : balance + 1e-9 < expected ? 'CONFIRMING'        // depósito parcial
      : 'CONFIRMED_ONCHAIN';                             // recebido on-chain
    let payout = null;
    if (status === 'CONFIRMED_ONCHAIN' && p.pixKey && p.brl) {
      // repasse PIX via Asaas (sandbox enquanto ASAAS_BASE_URL aponta para api-sandbox)
      const t = await ensurePixTransfer({ code: p.code, brl: p.brl, pixKey: p.pixKey });
      if (!t.skipped) payout = { provider: 'asaas', sandbox: asaasSandbox(), ...t };
      if (t.status === 'DONE') status = 'PAID';
      else if (!t.error && !t.skipped) status = 'PROCESSING';
    }
    return res.status(200).json({
      status, provider: 'onchain-polygon', address,
      balance, expected, code: p.code, payout
    });
  }

  if (!code) return res.status(400).json({ error: 'code_required' });
  // demo: progride sozinha a partir de um relógio determinístico do código
  let h = 0; for (const c of code) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const phase = (Math.floor(Date.now() / 15000) + h) % 4;
  const seq = ['WAITING_DEPOSIT', 'CONFIRMING', 'PROCESSING', 'PAID'];
  return res.status(200).json({ status: seq[phase], provider: 'demo' });
}
