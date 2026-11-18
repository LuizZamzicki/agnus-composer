# ADR 0009 — Shopify headless (Storefront API) para vitrine, sacola e checkout

- **Status:** Substituído pelo [ADR 0011](0011-checkout-proprio-mercado-pago.md)
- **Data:** 2026-11-11

## Contexto

O pagamento precisa acontecer no checkout do Shopify. Esse checkout só aceita a sacola do próprio Shopify (o objeto `Cart` da Storefront API), e uma sacola do Shopify só aceita variantes do Shopify. Por isso, além do checkout, as peças e a sacola também precisam vir de lá. A loja continua com o visual, o tempo litúrgico e a conta do cliente da Agnus.

## Decisão

Criar o serviço **`loja`**, um BFF da Storefront API do Shopify, e fazer a loja (SPA) usar esse serviço para a vitrine, a página da peça, a sacola e o checkout.

1. **O token fica no servidor.** O navegador fala só com `/api/loja/*`. O serviço usa o token privado da Storefront API (`Shopify-Storefront-Private-Token`) e repassa o IP de quem compra (`Shopify-Storefront-Buyer-IP`), como o Shopify recomenda para chamadas de servidor. A CSP da loja continua `connect-src 'self'`.
2. **Vitrine em cache** no Redis (cache-aside, [ADR 0003](0003-cache-redis-cache-aside.md)) com TTL curto, de 60 a 600 s, porque preço e estoque mudam no painel do Shopify.
3. **Sacola do Shopify ligada à conta.** O visitante compra sem conta: o id da sacola fica no navegador. Ao entrar, a sacola passa para a conta; se a conta já tinha outra, as peças se juntam. O vínculo `id_usuario → sacola` fica no Redis por 30 dias, para o cliente encontrar a mesma sacola em outro aparelho.
4. **Checkout hospedado do Shopify.** A sacola pede ao serviço o `checkoutUrl`. Com o cliente logado, o serviço preenche antes o e-mail e o país (`buyerIdentity`).
5. **Coleções do Shopify** substituem as categorias da vitrine. **Opções e variantes** (tamanho, cor, etc.) substituem `cor + grade`.
6. Os ids do Shopify trafegam em **base64url**, porque o id da sacola tem `/` e `?key=`, que o gateway quebraria.

## Alternativas consideradas

| Alternativa | Por que foi descartada |
| --- | --- |
| Front chamando a Storefront API direto com o token público | Funciona, mas espalha o contrato do Shopify pelas telas, abre a CSP para o domínio da loja, fica sem cache compartilhado e sem o vínculo da sacola com a conta |
| Manter o catálogo próprio e só criar a sacola no Shopify no checkout | Exige sincronizar produtos, variantes e preços entre os dois catálogos e conferir divergências a cada compra |
| Shopify Buy Button / tema Liquid | Perde o front próprio (tempo litúrgico, design, conta do cliente) |
| Hydrogen/Oxygen | Exige reescrever a loja em outro framework e outra hospedagem |

## Consequências

- ✅ Preço, estoque, frete, impostos e pagamento ficam no Shopify, que é a fonte única. O Mercado Pago entra pelo próprio Shopify, se for o meio escolhido.
- ✅ Com o Shopify fora do ar, a vitrine responde 503 com uma mensagem clara. Login, área do cliente e avaliações continuam funcionando.
- ⚠️ Os serviços `catalogo`, `carrinho` e `pedidos`, e o cadastro de produtos no painel `/admin`, deixam de alimentar a loja. Os produtos passam a ser cadastrados no admin do Shopify.
- ⚠️ "Meus pedidos" e a regra "só avalia quem recebeu" dependem do serviço `pedidos`, que não recebe as compras feitas no Shopify. O próximo passo é assinar os webhooks `orders/create` e `orders/fulfilled` do Shopify e publicar `pedido.*` no barramento de eventos.
- ⚠️ As avaliações usam o id numérico do produto no Shopify (ex.: `8907384062234`). Para gravar avaliações dessas peças, a coluna `avaliacao_produtos.id_produto` precisa virar `BIGINT`. Isso entra junto com a importação dos pedidos.
- ⚠️ O cache da vitrine pode mostrar um preço desatualizado por até 1 minuto. O checkout sempre usa o preço atual do Shopify.
