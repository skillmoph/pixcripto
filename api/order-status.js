// GET /api/order-status?code=PIX-XXXX-XXXX
// Com WOOVI_APP_ID consulta a cobrança real; sem chave, simula a progressão da operação demo.
const WOOVI_API = process.env.WOOVI_API_URL || 'https://api.openpix.com.br';

export default async function handler(req, res) {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: 'code_required' });

  const appId = process.env.WOOVI_APP_ID;
  if (appId) {
    try {
      const r = await fetch(`${WOOVI_API}/api/v1/charge/${encodeURIComponent(code)}`, {
        headers: { 'Authorization': appId }
      });
      const j = await r.json();
      if (!r.ok) return res.status(404).json({ error: 'not_found' });
      const st = j.charge?.status; // ACTIVE | COMPLETED | EXPIRED
      return res.status(200).json({ status: st === 'COMPLETED' ? 'PAID' : st === 'EXPIRED' ? 'FAILED' : 'WAITING_DEPOSIT', raw: st });
    } catch (e) {
      return res.status(502).json({ error: 'woovi_unreachable' });
    }
  }

  // demo: progride sozinha a partir de um relógio determinístico do código
  let h = 0; for (const c of code) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const phase = (Math.floor(Date.now() / 15000) + h) % 4;
  const seq = ['WAITING_DEPOSIT', 'CONFIRMING', 'PROCESSING', 'PAID'];
  return res.status(200).json({ status: seq[phase], provider: 'demo' });
}
