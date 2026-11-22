// POST /api/order — cria uma operação cripto -> PIX.
// Com WOOVI_APP_ID (sandbox ou produção) cria a cobrança PIX de verdade na Woovi/OpenPix.
// Sem a chave, roda em modo demonstração: devolve endereço de depósito simulado e código de resgate.
import crypto from 'node:crypto';

const WOOVI_API = process.env.WOOVI_API_URL || 'https://api.openpix.com.br';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { mode, net, usdt, brl, pixKey, boleto, coupon, code, feePct } = req.body || {};
  if (!brl || brl < 10 || brl > 250000) return res.status(400).json({ error: 'amount_out_of_range' });
  if (mode === 'pix' && !pixKey) return res.status(400).json({ error: 'pix_key_required' });
  if (!code) return res.status(400).json({ error: 'code_required' });

  const appId = process.env.WOOVI_APP_ID;
  if (appId) {
    // Cobrança PIX real (sandbox ou produção, conforme a chave)
    try {
      const r = await fetch(`${WOOVI_API}/api/v1/charge?return_existing=true`, {
        method: 'POST',
        headers: { 'Authorization': appId, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correlationID: code,
          value: Math.round(brl * 100), // centavos
          type: 'DYNAMIC',
          comment: `PixCripto ${code} ${usdt} USDT ${net}`,
          expiresIn: 3600,
          additionalInfo: [
            { key: 'codigo', value: code },
            { key: 'usdt', value: String(usdt) },
            { key: 'rede', value: String(net) }
          ]
        })
      });
      const j = await r.json();
      if (!r.ok) return res.status(502).json({ error: 'woovi_error', detail: j?.error || r.status });
      return res.status(200).json({
        provider: 'woovi',
        code,
        charge: j.charge?.correlationID,
        brcode: j.charge?.brCode,
        status: j.charge?.status || 'ACTIVE',
        depositAddress: null // em produção: endereço USDT custodiado pelo parceiro de liquidez
      });
    } catch (e) {
      return res.status(502).json({ error: 'woovi_unreachable' });
    }
  }

  // ---- modo demonstração (sem chave) ----
  const depositAddress = net === 'solana'
    ? crypto.randomBytes(32).toString('base64').replace(/[^1-9A-HJ-NP-Za-km-z]/g, '').slice(0, 44)
    : '0x' + crypto.randomBytes(20).toString('hex');
  return res.status(200).json({ provider: 'demo', code, depositAddress, status: 'WAITING_DEPOSIT', feePct });
}
