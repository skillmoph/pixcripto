// Mercado Pago — payout PIX (POST /v1/payouts) e cobrança PIX (POST /v1/payments).
// Idempotência nativa: X-Idempotency-Key determinístico por pedido +
// external_reference único (a API rejeita referência duplicada).
import crypto from 'node:crypto';

const MP_BASE = 'https://api.mercadopago.com';

function pixType(key) {
  const k = String(key || '').trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return 'PIX_CODE';
  if (k.includes('@')) return 'EMAIL';
  const d = k.replace(/\D/g, '');
  if (d.length === 14) return 'CNPJ';
  if (d.length === 11 && !/^\+/.test(k)) return 'CPF';
  if (/^\+?\d{10,15}$/.test(k.replace(/[\s()-]/g, ''))) return 'PHONE';
  return 'PIX_CODE';
}

const idemKey = (code) => crypto.createHash('sha256').update('pixcripto:' + code).digest('hex');

export async function ensureMpPixPayout({ code, brl, pixKey }) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return { skipped: 'mp_not_configured' };
  try {
    const r = await fetch(MP_BASE + '/v1/payouts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'X-Idempotency-Key': idemKey(code)
      },
      body: JSON.stringify({
        external_reference: String(code).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 50),
        description: 'PixCripto ' + code,
        transactions: [{
          description: 'PixCripto ' + code,
          type: 'pix',
          pix: { type: pixType(pixKey), chave: String(pixKey).trim() },
          amount: { currency: 'BRL', value: Number(brl) },
          external_reference: String(code).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 50)
        }]
      })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok && r.status !== 202) {
      return { error: 'mp_payout_failed', detail: j.message || (j.error) || ('http_' + r.status), mpStatus: r.status };
    }
    const tx = (j.transactions || [])[0] || {};
    return { id: j.id, txId: tx.id, status: j.status, value: tx.amount && tx.amount.value, method: 'PIX_MP', created: true };
  } catch (e) {
    return { error: 'mp_unreachable' };
  }
}

// Cobrança PIX (dinheiro entrando): cria QR/copia-e-cola para o pagador.
export async function ensureMpPixCharge({ code, brl, payerEmail }) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return { skipped: 'mp_not_configured' };
  try {
    const r = await fetch(MP_BASE + '/v1/payments', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'X-Idempotency-Key': idemKey('charge:' + code)
      },
      body: JSON.stringify({
        transaction_amount: Number(brl),
        payment_method_id: 'pix',
        description: 'PixCripto ' + code,
        external_reference: String(code).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 50),
        payer: { email: payerEmail || 'pagador@exemplo.com' }
      })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok && r.status !== 201) {
      return { error: 'mp_charge_failed', detail: j.message || (j.cause && j.cause[0] && j.cause[0].description) || ('http_' + r.status), mpStatus: r.status };
    }
    const poi = j.point_of_interaction && j.point_of_interaction.transaction_data || {};
    return {
      id: j.id, status: j.status, value: j.transaction_amount,
      qrCode: poi.qr_code || null, qrCodeBase64: poi.qr_code_base64 || null,
      ticketUrl: poi.ticket_url || null, created: true
    };
  } catch (e) {
    return { error: 'mp_unreachable' };
  }
}
