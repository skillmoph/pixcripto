// GET /api/swap-quote?from=USDC&to=USDT&amount=1[&fromAddress=0x...]
// Cotação e rota REAL de swap na Polygon via LI.FI (API pública, sem chave).
// Com fromAddress válido, devolve também a transação pronta para a carteira
// do cliente assinar — o PixCripto não custeia gás nem liquidez.
const CHAIN = 137; // Polygon
const TOKENS = {
  USDT: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
  USDC: { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 }, // USDC.e
  ETH:  { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 }, // WETH
  DAI:  { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18 },
  WBTC: { address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', decimals: 8 },
  MATIC:{ address: '0x0000000000000000000000000000000000000000', decimals: 18 } // nativo (POL)
};
const QUOTE_ADDR = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // endereço neutro só para simular a cotação

export default async function handler(req, res) {
  res.setHeader('cache-control', 's-maxage=10, stale-while-revalidate=20');
  const { from, to, amount, fromAddress, toAddress } = req.query || {};
  const A = TOKENS[from], B = TOKENS[to];
  const amt = parseFloat(amount);
  if (!A || !B) return res.status(400).json({ error: 'unknown_token', tokens: Object.keys(TOKENS) });
  if (from === to) return res.status(400).json({ error: 'same_token' });
  if (!(amt > 0)) return res.status(400).json({ error: 'amount_required' });

  const amountIn = BigInt(Math.round(amt * 10 ** A.decimals)).toString();
  const realAddr = /^0x[0-9a-fA-F]{40}$/.test(fromAddress || '');
  const addr = realAddr ? fromAddress : QUOTE_ADDR;
  const u = new URL('https://li.quest/v1/quote');
  const params = {
    fromChain: String(CHAIN), toChain: String(CHAIN),
    fromToken: A.address, toToken: B.address,
    fromAmount: amountIn, fromAddress: addr,
    slippage: '0.01'
  };
  // Destino diferente do pagador (aba Privado: USDT cai direto no endereço do pedido)
  if (/^0x[0-9a-fA-F]{40}$/.test(toAddress || '')) params.toAddress = toAddress;
  u.search = new URLSearchParams(params).toString();
  try {
    const r = await fetch(u, { headers: { accept: 'application/json' } });
    const j = await r.json();
    if (!r.ok || !j.transactionRequest) {
      return res.status(502).json({ error: 'quote_failed', detail: j.message || undefined });
    }
    const steps = j.includedSteps || [];
    const step = steps.find(st => st.type === 'swap') || steps[steps.length - 1] || {};
    const gasUsd = j.estimate && j.estimate.gasCosts && j.estimate.gasCosts[0]
      ? parseFloat(j.estimate.gasCosts[0].amountUSD) : null;
    return res.status(200).json({
      from, to, amountIn: amt,
      amountOut: Number(j.estimate.toAmount) / 10 ** B.decimals,
      amountOutUsd: parseFloat(j.estimate.toAmountUSD) || null,
      gasUsd,
      tool: (step.toolDetails && step.toolDetails.name) || step.tool || 'aggregator',
      approvalAddress: j.estimate.approvalAddress || null,
      source: 'li.fi',
      chainId: CHAIN,
      tx: realAddr ? {
        to: j.transactionRequest.to,
        data: j.transactionRequest.data,
        value: j.transactionRequest.value || '0x0',
        gas: j.transactionRequest.gasLimit || null,
        chainId: CHAIN
      } : null
    });
  } catch (e) {
    return res.status(502).json({ error: 'quote_unreachable' });
  }
}
