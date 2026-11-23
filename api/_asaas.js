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

async function postTransfer(headers, body, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 45000);
  try {
    const r = await fetch(BASE() + '/transfers', { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, j };
  } finally { clearTimeout(t); }
}

// Conta bancária de fallback para quando o PIX está indisponível (ex.: chave Pix
// da conta ainda em ativação). Dados fictícios de sandbox via env; em produção,
// apontar para a conta bancária real do dono da operação.
function tedFallbackAccount() {
  const cpf = process.env.ASAAS_TED_CPF;
  if (!cpf || process.env.ASAAS_TED_FALLBACK === '0') return null;
  return {
    bank: { code: process.env.ASAAS_TED_BANK || '341' },
    accountName: 'PixCripto fallback',
    ownerName: process.env.ASAAS_TED_OWNER || '',
    cpfCnpj: cpf,
    agency: process.env.ASAAS_TED_AGENCY || '0001',
    account: process.env.ASAAS_TED_ACCOUNT || '',
    accountDigit: process.env.ASAAS_TED_ACCOUNT_DIGIT || '',
    bankAccountType: 'CONTA_CORRENTE'
  };
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
      if (found) return { id: found.id, status: found.status, value: found.value, method: found.operationType, existed: true };
    }
    // 1) tenta PIX (pode levar ~30s no sandbox antes de responder)
    const p = await postTransfer(headers, {
      value: Number(brl),
      operationType: 'PIX',
      pixAddressKey: String(pixKey),
      pixAddressKeyType: pixKeyType(pixKey),
      description: desc
    });
    if (p.ok) return { id: p.j.id, status: p.j.status, value: p.j.value, method: 'PIX', created: true };
    const pixError = (p.j.errors && p.j.errors[0] && p.j.errors[0].description) || ('http_' + p.status);
    // 2) fallback TED quando o PIX está indisponível
    const ted = tedFallbackAccount();
    if (ted) {
      const t = await postTransfer(headers, {
        value: Number(brl),
        operationType: 'TED',
        bankAccount: ted,
        description: desc + ' (fallback TED)'
      });
      if (t.ok) return { id: t.j.id, status: t.j.status, value: t.j.value, method: 'TED_FALLBACK', pixError, created: true };
      const tedError = (t.j.errors && t.j.errors[0] && t.j.errors[0].description) || ('http_' + t.status);
      return { error: 'asaas_transfer_failed', detail: pixError, tedError };
    }
    return { error: 'asaas_transfer_failed', detail: pixError };
  } catch (e) {
    return { error: 'asaas_unreachable' };
  }
}
