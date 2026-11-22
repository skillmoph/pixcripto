// Asaas — repasse PIX (sandbox ou produção, conforme ASAAS_BASE_URL).
// Idempotente por pedido: procura uma transferência cuja descrição contém o
// código do pedido antes de criar outra.
const BASE = () => (process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3').replace(/\/+$/, '');
export const asaasSandbox = () => BASE().includes('sandbox');

function pixKeyType(key) {
  const k = String(key || '').trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return 'EVP';
  if (k.includes('@')) return 'EMAIL';
  const d = k.replace(/\D/g, '');
  if (d.length === 14) return 'CNPJ';
  if (d.length === 11 && !/^\+/.test(k)) return 'CPF';
  if (/^\+?\d{10,15}$/.test(k.replace(/[\s()-]/g, ''))) return 'PHONE';
  return 'EVP';
}

export async function ensurePixTransfer({ code, brl, pixKey }) {
  const key = process.env.ASAAS_API_KEY;
  if (!key) return { skipped: 'asaas_not_configured' };
  const headers = { 'content-type': 'application/json', access_token: key };
  const desc = 'PixCripto ' + code;
  try {
    const lr = await fetch(BASE() + '/transfers?limit=100', { headers });
    if (lr.ok) {
      const lj = await lr.json();
      const found = (lj.data || []).find(t => (t.description || '').includes(code));
      if (found) return { id: found.id, status: found.status, value: found.value, existed: true };
    }
    const r = await fetch(BASE() + '/transfers', {
      method: 'POST', headers,
      body: JSON.stringify({
        value: Number(brl),
        pixAddressKey: String(pixKey),
        pixAddressKeyType: pixKeyType(pixKey),
        description: desc
      })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      return { error: 'asaas_transfer_failed', detail: (j.errors && j.errors[0] && j.errors[0].description) || ('http_' + r.status) };
    }
    return { id: j.id, status: j.status, value: j.value, created: true };
  } catch (e) {
    return { error: 'asaas_unreachable' };
  }
}
