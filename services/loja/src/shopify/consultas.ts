// Consultas da Storefront API. Toda operação recebe $pais/$idioma para preço e textos do mercado brasileiro.
const CONTEXTO = "@inContext(country: $pais, language: $idioma)";
const VARIAVEIS_CONTEXTO = "$pais: CountryCode, $idioma: LanguageCode";

const DINHEIRO = "amount currencyCode";

export const FRAGMENTO_CARTAO = `
fragment CartaoProduto on Product {
  id
  handle
  title
  availableForSale
  priceRange { minVariantPrice { ${DINHEIRO} } }
  compareAtPriceRange { minVariantPrice { ${DINHEIRO} } }
  images(first: 2) { nodes { url altText } }
}`;

const PAGINACAO = "pageInfo { hasNextPage hasPreviousPage startCursor endCursor }";

export const LISTAR_PRODUTOS = `
query ListarProdutos(${VARIAVEIS_CONTEXTO}, $first: Int, $last: Int, $after: String, $before: String,
  $query: String, $sortKey: ProductSortKeys, $reverse: Boolean) ${CONTEXTO} {
  products(first: $first, last: $last, after: $after, before: $before, query: $query, sortKey: $sortKey, reverse: $reverse) {
    nodes { ...CartaoProduto }
    ${PAGINACAO}
  }
}
${FRAGMENTO_CARTAO}`;

export const LISTAR_PRODUTOS_DA_COLECAO = `
query ListarProdutosDaColecao(${VARIAVEIS_CONTEXTO}, $handle: String!, $first: Int, $last: Int, $after: String,
  $before: String, $sortKey: ProductCollectionSortKeys, $reverse: Boolean) ${CONTEXTO} {
  collection(handle: $handle) {
    products(first: $first, last: $last, after: $after, before: $before, sortKey: $sortKey, reverse: $reverse) {
      nodes { ...CartaoProduto }
      ${PAGINACAO}
    }
  }
}
${FRAGMENTO_CARTAO}`;

export const LISTAR_COLECOES = `
query ListarColecoes(${VARIAVEIS_CONTEXTO}) ${CONTEXTO} {
  collections(first: 50, sortKey: TITLE) {
    nodes { id handle title }
  }
}`;

export const BUSCAR_PRODUTO = `
query BuscarProduto(${VARIAVEIS_CONTEXTO}, $handle: String!) ${CONTEXTO} {
  product(handle: $handle) {
    id
    handle
    title
    description
    availableForSale
    options {
      name
      optionValues { name swatch { color } }
    }
    images(first: 20) { nodes { url altText } }
    variants(first: 100) {
      nodes {
        id
        title
        availableForSale
        price { ${DINHEIRO} }
        compareAtPrice { ${DINHEIRO} }
        selectedOptions { name value }
        image { url altText }
      }
    }
  }
}`;

export const PRODUTOS_RELACIONADOS = `
query ProdutosRelacionados(${VARIAVEIS_CONTEXTO}, $productId: ID!) ${CONTEXTO} {
  productRecommendations(productId: $productId, intent: RELATED) { ...CartaoProduto }
}
${FRAGMENTO_CARTAO}`;

const FRAGMENTO_SACOLA = `
fragment Sacola on Cart {
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount { ${DINHEIRO} }
    totalAmount { ${DINHEIRO} }
  }
  lines(first: 100) {
    nodes {
      id
      quantity
      cost {
        amountPerQuantity { ${DINHEIRO} }
        totalAmount { ${DINHEIRO} }
      }
      merchandise {
        ... on ProductVariant {
          id
          title
          availableForSale
          selectedOptions { name value }
          image { url altText }
          product { handle title featuredImage { url altText } }
        }
      }
    }
  }
}`;

const RESULTADO_MUTACAO = `
  cart { ...Sacola }
  userErrors { field message code }
`;

export const BUSCAR_SACOLA = `
query BuscarSacola(${VARIAVEIS_CONTEXTO}, $id: ID!) ${CONTEXTO} {
  cart(id: $id) { ...Sacola }
}
${FRAGMENTO_SACOLA}`;

export const CRIAR_SACOLA = `
mutation CriarSacola(${VARIAVEIS_CONTEXTO}, $input: CartInput!) ${CONTEXTO} {
  cartCreate(input: $input) { ${RESULTADO_MUTACAO} }
}
${FRAGMENTO_SACOLA}`;

export const ADICIONAR_LINHAS = `
mutation AdicionarLinhas(${VARIAVEIS_CONTEXTO}, $cartId: ID!, $lines: [CartLineInput!]!) ${CONTEXTO} {
  cartLinesAdd(cartId: $cartId, lines: $lines) { ${RESULTADO_MUTACAO} }
}
${FRAGMENTO_SACOLA}`;

export const ATUALIZAR_LINHAS = `
mutation AtualizarLinhas(${VARIAVEIS_CONTEXTO}, $cartId: ID!, $lines: [CartLineUpdateInput!]!) ${CONTEXTO} {
  cartLinesUpdate(cartId: $cartId, lines: $lines) { ${RESULTADO_MUTACAO} }
}
${FRAGMENTO_SACOLA}`;

export const REMOVER_LINHAS = `
mutation RemoverLinhas(${VARIAVEIS_CONTEXTO}, $cartId: ID!, $lineIds: [ID!]!) ${CONTEXTO} {
  cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { ${RESULTADO_MUTACAO} }
}
${FRAGMENTO_SACOLA}`;

export const IDENTIFICAR_COMPRADOR = `
mutation IdentificarComprador(${VARIAVEIS_CONTEXTO}, $cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) ${CONTEXTO} {
  cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) { ${RESULTADO_MUTACAO} }
}
${FRAGMENTO_SACOLA}`;

// Marca a sacola com o id da conta Agnus; o atributo vai para o pedido e liga a compra à conta.
export const ATRIBUIR_SACOLA = `
mutation AtribuirSacola(${VARIAVEIS_CONTEXTO}, $cartId: ID!, $attributes: [AttributeInput!]!) ${CONTEXTO} {
  cartAttributesUpdate(cartId: $cartId, attributes: $attributes) { ${RESULTADO_MUTACAO} }
}
${FRAGMENTO_SACOLA}`;
