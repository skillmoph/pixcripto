# REHEARSAL — PixCripto (clone NakSwap)

Padrão: skill Stageshow (regra do André, 22/11/2026) aplicada como padrão de design de UI.

## Base
- Original mapeado no navegador de nuvem (22/11/2026): 4 abas (PIX Direct, PIX Web3, Private PIX, Swap), tokens extraídos do CSS publicado do site (fundo #0a0a0f, cartão vidro 24px com glow violeta, acento #7c5cff, verde PIX #22c55e, laranja conectar #f75c2a, system-ui).
- Prints do original e do clone comparados lado a lado; hierarquia: logo + cotação → tabs → rede → valores → destino → CTA → comprovante.

## Verificado com prints reais do link público (página recarregada)
- Tela principal: tabs, seletor Polygon/Solana, campos envia/recebe, PIX/Boleto, chave PIX, cupom, CTA desabilitado até validar, consulta de comprovante. ✓
- Fluxo de ponta a ponta: 20 USDT → R$ 114,05 (cotação com taxa), operação criada, endereço de depósito + QR, código PIX-69C7-72E1, tela de status. ✓
- Cotação ao vivo no topo (API pública). ✓
- Mobile: layout empilha (media query 520px) — verificado por CSS, print mobile pendente.

## O que não foi checado / limites conhecidos
- Gate animado (film.mjs --gate) não se aplica: app de produção, não demo ilustrativa.
- Abas Web3/Privado/Swap: UI pronta; transação real depende da integração de pagamentos (Woovi) e do parceiro de liquidez.
- QR do depósito depende de CDN (jsdelivr); se o CDN falhar, o QR some e o endereço em texto permanece.
