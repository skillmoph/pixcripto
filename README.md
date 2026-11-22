# PixCripto

Clone funcional do fluxo do NakSwap (nakpix.xyz): USDT (Polygon/Solana) → PIX ou boleto.

- `index.html` — SPA completa (4 abas: PIX Direto, PIX Web3, PIX Privado, Swap)
- `api/quote.js` — cotação USDT/BRL ao vivo (Binance pública, fallback CoinGecko). Grátis, sem chave.
- `api/order.js` — cria a operação. Com `WOOVI_APP_ID` cria cobrança PIX real na Woovi/OpenPix (sandbox ou produção). Sem chave, modo demonstração.
- `api/order-status.js` — status da operação (Woovi ou simulação demo).
- `api/receipt.js` — comprovante pelo código de resgate.

## Deploy

Vercel, estático + serverless functions, zero dependências de build.

## Ativando a Woovi (o único passo que depende do dono)

1. Criar conta grátis em https://woovi.com (pede CPF ou CNPJ e verificação de identidade — não dá para um agente fazer por você).
2. Em https://developers.woovi.com (ou no painel: API/Plugins → Nova API/Plugin) criar uma **Application** do tipo API e copiar o **AppID**.
3. No projeto Vercel: Settings → Environment Variables → adicionar `WOOVI_APP_ID` = AppID copiado. Redeploy.
4. Teste em sandbox: a Woovi tem ambiente de testes; com o AppID de sandbox as cobranças são simuladas e nenhum dinheiro se move. Para produção, trocar pelo AppID de produção após o KYC da conta ser aprovado.

Custos Woovi (tabela pública, nov/2026): sem mensalidade nem adesão; 0,80% por Pix recebido (mín R$ 0,50, máx R$ 5,00).

## O que ainda é vitrine (precisa de parceiro/decisão)

- Custódia e conversão real USDT→BRL (hoje o Woovi cobre a perna PIX; a perna cripto precisa de parceiro de liquidez — Bitso Business ou BlindPay).
- Envio Web3 direto da carteira (abas PIX Web3/Privado/Swap): UI pronta, transação real depende da infra escolhida.
