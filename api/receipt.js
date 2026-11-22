// GET /api/receipt?code=PIX-XXXX-XXXX
// Com WOOVI_APP_ID busca a cobrança e devolve os dados do comprovante; sem chave, 404 (o front cai no cache local).
const WOOVI_API = process.env.WOOVI_API_URL || 'https://api.openpix.com.br';

export default async function handler(req, res) {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: 'code_required' });

  const appId = process.env.WOOVI_APP_ID;
  if (!appId) return res.status(404).json({ found: false });

  try {
    const r = await fetch(`${WOOVI_API}/api/v1/charge/${encodeURIComponent(code)}`, {
      headers: { 'Authorization': appId }
    });
    const j = await r.json();
    if (!r.ok) return res.status(404).json({ found: false });
    const c = j.charge;
    res.status(200).json({
      found: true,
      statusLabel: c.status === 'COMPLETED' ? 'PIX enviado' : c.status === 'EXPIRED' ? 'Expirada' : 'Aguardando',
      brl: (c.value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      dest: c.pixKey || 'chave registrada na operação',
      when: new Date(c.createdAt || Date.now()).toLocaleString('pt-BR')
    });
  } catch (e) {
    res.status(502).json({ error: 'woovi_unreachable' });
  }
}
