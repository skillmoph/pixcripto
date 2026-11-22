# REHEARSAL — PixCripto (funcionalidades do NakSwap, identidade própria)

Padrão de UI: skill Stageshow (delegação do main em 22/11/2026, repassando pedido do André). Redesign v2 com identidade própria (não é cópia visual do NakSwap).

## Base
- Funcionalidades mapeadas do original no navegador de nuvem (22/11/2026): 4 abas (PIX Direto, Web3, Privado, Swap), rede Polygon/Solana, PIX/Boleto, chave PIX, cupom, comprovante.
- v2 (redesign): tema claro neutro quente, acento teal, Figtree, abas segmentadas, conversor com valor grande, zero emoji como ícone. Decisão: André pediu "extremamente elegante e premium e minimalista" (22/11/2026 17:22).
- v3 (tema): André pediu "Mantenha o tema dark!" (22/11/2026 17:32). Mesma estrutura e identidade do v2, paleta escura própria: grafite quente #0c0e0d, superfície #141817, acento menta #2fbf9f, CTA claro sobre escuro. Diferente do roxo/vidro do NakSwap.

## Verificado com prints reais do link público (página recarregada, 22/11/2026 — v3 dark)
- Tela principal desktop: logo + cotação ao vivo, 4 abas, seletor de rede, conversor, PIX/Boleto, chave, cupom, CTA. ✓
- Fluxo ponta a ponta desktop: 20 USDT → R$ 114,05, pedido criado (PIX-D55D-D90C), endereço de depósito + QR renderizado, código de resgate, progressão de status. ✓
- Aba Swap: cotação real via KyberSwap (1 USDC → ≈ 1,001203 USDT, gás ~US$ 0,06). ✓
- Mobile (390x844): layout empilha, conversor ao vivo 20 USDT → 114,05, CTA habilita após chave válida. ✓
- QR: biblioteca vendorizada em /assets/qrcode.min.js (bundle esbuild do pacote qrcode@1.5.3) — sem dependência de CDN. No dark o QR fica em tile claro (escaneável). ✓

## O que não foi checado / limites conhecidos
- Gate animado (film.mjs --gate) não se aplica: app de produção, não demo ilustrativa.
- Pagamento PIX real depende do WOOVI_APP_ID (conta em criação pelo agente irmão); até lá, api/order.js roda em modo demonstração (declarado no rodapé do app).
- Transação on-chain real das abas Web3/Privado/Swap depende do parceiro de liquidez.
