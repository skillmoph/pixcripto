// GET /api/swap-quote?from=USDC&to=USDT&amount=1
// Cotação real de swap na Ethereum mainnet via KyberSwap Aggregator (API pública, sem chave).
const TOKENS = {
  USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  ETH:  { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  DAI:  { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  WBTC: { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  MATIC:{ address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', decimals: 18 }
};

export default async function handler(req, res) {
  res.setHeader('cache-control', 's-maxage=10, stale-while-revalidate=20');
  const { from, to, amount } = req.query || {};
  const A = TOKENS[from], B = TOKENS[to];
  const amt = parseFloat(amount);
  if (!A || !B) return res.status(400).json({ error: 'unknown_token', tokens: Object.keys(TOKENS) });
  if (!(amt > 0)) return res.status(400).json({ error: 'amount_required' });

  const amountIn = BigInt(Math.round(amt * 10 ** A.decimals)).toString();
  const url = `https://aggregator-api.kyberswap.com/ethereum/api/v1/routes?tokenIn=${A.address}&tokenOut=${B.address}&amountIn=${amountIn}`;
  try {
    const r = await fetch(url, { headers: { 'accept': 'application/json' } });
    const j = await r.json();
    const sum = j?.data?.routeSummary;
    if (!r.ok || !sum) return res.status(502).json({ error: 'quote_failed' });
    const out = Number(sum.amountOut) / 10 ** B.decimals;
    res.status(200).json({
      from, to, amountIn: amt,
      amountOut: out,
      amountInUsd: parseFloat(sum.amountInUsd) || null,
      amountOutUsd: parseFloat(sum.amountOutUsd) || null,
      gasUsd: parseFloat(sum.gasUsd) || null,
      source: 'kyberswap'
    });
  } catch (e) {
    res.status(502).json({ error: 'quote_unreachable' });
  }
}
