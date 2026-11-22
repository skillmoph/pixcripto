// GET /api/quote — cotação USDT/BRL ao vivo (grátis, sem chave)
export default async function handler(req, res) {
  res.setHeader('cache-control', 's-maxage=20, stale-while-revalidate=40');
  // 1) Binance pública (par USDT/BRL direto)
  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTBRL');
    if (r.ok) {
      const j = await r.json();
      const brl = parseFloat(j.price);
      if (brl > 0) return res.status(200).json({ brl, source: 'binance', at: new Date().toISOString() });
    }
  } catch (e) {}
  // 2) CoinGecko (fallback)
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=brl');
    if (r.ok) {
      const j = await r.json();
      const brl = j?.tether?.brl;
      if (brl > 0) return res.status(200).json({ brl, source: 'coingecko', at: new Date().toISOString() });
    }
  } catch (e) {}
  return res.status(503).json({ error: 'quote_unavailable' });
}
