import { HttpError } from "@agnus/comum/types/http_error";
import logger from "@agnus/comum/utils/logger";
import { VINCULO_SACOLA_TTL } from "../config";
import { configuracaoAtual, consultarShopify } from "../shopify/cliente";
import {
  ADICIONAR_LINHAS,
  ATRIBUIR_SACOLA,
  ATUALIZAR_LINHAS,
  BUSCAR_SACOLA,
  CRIAR_SACOLA,
  IDENTIFICAR_COMPRADOR,
  REMOVER_LINHAS,
} from "../shopify/consultas";
import { decodificarId } from "../shopify/ids";
import { normalizarSacola, type SacolaShopify } from "../shopify/normalizar";
import { ATRIBUTO_CLIENTE } from "../shopify/pedidos";
import { apagarCache, gravarCache, lerCache } from "./cache";

export type Comprador = { id_usuario: number; email: string };
export type LinhaNova = { variante: unknown; quantidade?: unknown };

const QUANTIDADE_MAXIMA = 99;

type ErroUsuario = { field: string[] | null; message: string; code: string | null };
type ResultadoMutacao = { cart: SacolaShopify | null; userErrors: ErroUsuario[] };

const MENSAGENS: Record<string, string> = {
  MERCHANDISE_OUT_OF_STOCK: "Esta opção da peça esgotou.",
  MERCHANDISE_NOT_ENOUGH_STOCK: "Não há peças suficientes nesta opção.",
  INVALID_MERCHANDISE_LINE: "Esta opção da peça não está mais à venda.",
  MAXIMUM_EXCEEDED: "A quantidade passou do limite por pedido.",
  LESS_THAN: "Quantidade inválida.",
  INVALID: "Os dados enviados são inválidos.",
};

const chaveDoVinculo = (idUsuario: number) => `sacola:usuario:${idUsuario}`;

const quantidadeValida = (valor: unknown, minimo: number) => {
  const numero = valor === undefined ? 1 : Number(valor);

  if (!Number.isInteger(numero) || numero < minimo || numero > QUANTIDADE_MAXIMA) {
    throw new HttpError(400, `A quantidade deve ser um número entre ${minimo} e ${QUANTIDADE_MAXIMA}.`);
  }

  return numero;
};

export const linhasValidas = (linhas: unknown) => {
  if (!Array.isArray(linhas) || linhas.length === 0 || linhas.length > 50) {
    throw new HttpError(400, "Informe as peças a adicionar.");
  }

  return (linhas as LinhaNova[]).map((linha) => ({
    merchandiseId: decodificarId(linha?.variante, "ProductVariant"),
    quantity: quantidadeValida(linha?.quantidade, 1),
  }));
};

// Erros de regra (estoque, quantidade) voltam ao cliente; a sacola sem eles segue adiante.
const conferirCrua = (resultado: ResultadoMutacao | undefined, operacao: string) => {
  const erros = resultado?.userErrors ?? [];

  if (erros.length) {
    logger.warn("shopify.erro_sacola", { operacao, codigos: erros.map((e) => e.code) });
    const codigo = erros[0].code ?? "";
    throw new HttpError(422, MENSAGENS[codigo] ?? "Não foi possível atualizar a sacola.");
  }

  if (!resultado?.cart) {
    throw new HttpError(404, "Sacola não encontrada.");
  }

  return resultado.cart;
};

const conferir = (resultado: ResultadoMutacao | undefined, operacao: string) =>
  normalizarSacola(conferirCrua(resultado, operacao));

const identidadeDo = (comprador: Comprador) => ({
  email: comprador.email,
  countryCode: configuracaoAtual()?.pais ?? "BR",
});

const buscarCrua = async (cartId: string, ip?: string) => {
  const dados = await consultarShopify<{ cart: SacolaShopify | null }>(BUSCAR_SACOLA, { id: cartId }, { ipComprador: ip });
  return dados.cart;
};

const identificarCrua = async (cartId: string, comprador: Comprador, ip?: string) => {
  const dados = await consultarShopify<{ cartBuyerIdentityUpdate: ResultadoMutacao }>(
    IDENTIFICAR_COMPRADOR, { cartId, buyerIdentity: identidadeDo(comprador) }, { ipComprador: ip },
  );
  return conferirCrua(dados.cartBuyerIdentityUpdate, "identificar");
};

const identificar = async (cartId: string, comprador: Comprador, ip?: string) =>
  normalizarSacola(await identificarCrua(cartId, comprador, ip));

export const buscarSacola = async (id: string, ip?: string) => {
  const sacola = await buscarCrua(decodificarId(id, "Cart"), ip);

  // Sacola paga ou expirada some no Shopify: o front começa outra.
  if (!sacola) {
    throw new HttpError(404, "Sacola não encontrada.");
  }

  return normalizarSacola(sacola);
};

export const criarSacola = async (linhas: unknown, comprador?: Comprador, ip?: string) => {
  const input: Record<string, unknown> = { lines: linhas === undefined ? [] : linhasValidas(linhas) };

  if (comprador) {
    input.buyerIdentity = identidadeDo(comprador);
  }

  const dados = await consultarShopify<{ cartCreate: ResultadoMutacao }>(CRIAR_SACOLA, { input }, { ipComprador: ip });
  const sacola = conferir(dados.cartCreate, "criar");

  if (comprador) {
    await gravarCache(chaveDoVinculo(comprador.id_usuario), decodificarId(sacola.id, "Cart"), VINCULO_SACOLA_TTL);
  }

  return sacola;
};

export const adicionarLinhas = async (id: string, linhas: unknown, ip?: string) => {
  const dados = await consultarShopify<{ cartLinesAdd: ResultadoMutacao }>(
    ADICIONAR_LINHAS, { cartId: decodificarId(id, "Cart"), lines: linhasValidas(linhas) }, { ipComprador: ip },
  );
  return conferir(dados.cartLinesAdd, "adicionar");
};

export const atualizarLinha = async (id: string, linha: string, quantidade: unknown, ip?: string) => {
  const qtd = quantidadeValida(quantidade, 0);

  if (qtd === 0) {
    return removerLinha(id, linha, ip);
  }

  const dados = await consultarShopify<{ cartLinesUpdate: ResultadoMutacao }>(
    ATUALIZAR_LINHAS,
    { cartId: decodificarId(id, "Cart"), lines: [{ id: decodificarId(linha, "CartLine"), quantity: qtd }] },
    { ipComprador: ip },
  );
  return conferir(dados.cartLinesUpdate, "atualizar");
};

export const removerLinha = async (id: string, linha: string, ip?: string) => {
  const dados = await consultarShopify<{ cartLinesRemove: ResultadoMutacao }>(
    REMOVER_LINHAS,
    { cartId: decodificarId(id, "Cart"), lineIds: [decodificarId(linha, "CartLine")] },
    { ipComprador: ip },
  );
  return conferir(dados.cartLinesRemove, "remover");
};

// Sacola guardada na conta: o cliente que entra em outro aparelho encontra as mesmas peças.
export const sacolaDoComprador = async (comprador: Comprador, ip?: string) => {
  const chave = chaveDoVinculo(comprador.id_usuario);
  const cartId = await lerCache<string>(chave);
  const sacola = cartId ? await buscarCrua(cartId, ip) : null;

  if (!sacola) {
    if (cartId) await apagarCache(chave);
    throw new HttpError(404, "Nenhuma sacola guardada.");
  }

  return normalizarSacola(sacola);
};

// Ao entrar na conta, a sacola de visitante passa para ela. Se a conta já tinha outra, as peças
// do visitante somam-se a ela; a de visitante fica abandonada no Shopify e expira sozinha.
export const vincularSacola = async (id: string, comprador: Comprador, ip?: string) => {
  const cartId = decodificarId(id, "Cart");
  const chave = chaveDoVinculo(comprador.id_usuario);
  const guardadaId = await lerCache<string>(chave);
  const guardada = guardadaId && guardadaId !== cartId ? await buscarCrua(guardadaId, ip) : null;

  if (guardada) {
    const visitante = await buscarCrua(cartId, ip);
    const linhas = (visitante?.lines.nodes ?? [])
      .filter((linha) => linha.merchandise?.id)
      .map((linha) => ({ merchandiseId: linha.merchandise.id, quantity: linha.quantity }));

    if (linhas.length) {
      const dados = await consultarShopify<{ cartLinesAdd: ResultadoMutacao }>(
        ADICIONAR_LINHAS, { cartId: guardada.id, lines: linhas }, { ipComprador: ip },
      );
      // Peça esgotada no caminho não impede o login: fica a sacola da conta como estava.
      if (dados.cartLinesAdd.userErrors.length) {
        logger.warn("shopify.erro_sacola", { operacao: "juntar", codigos: dados.cartLinesAdd.userErrors.map((e) => e.code) });
      }
    }

    await gravarCache(chave, guardada.id, VINCULO_SACOLA_TTL);
    return identificar(guardada.id, comprador, ip);
  }

  const sacola = await identificar(cartId, comprador, ip);
  await gravarCache(chave, cartId, VINCULO_SACOLA_TTL);
  return sacola;
};

// Só cliente com conta paga: o pedido chega ao checkout com o e-mail da conta já preenchido.
export const enderecoDoCheckout = async (id: string, comprador: Comprador, ip?: string) => {
  const cartId = decodificarId(id, "Cart");

  // O id da conta vai no pedido: é o que faz a compra aparecer em "Meus pedidos".
  const atribuicao = await consultarShopify<{ cartAttributesUpdate: ResultadoMutacao }>(
    ATRIBUIR_SACOLA,
    { cartId, attributes: [{ key: ATRIBUTO_CLIENTE, value: String(comprador.id_usuario) }] },
    { ipComprador: ip },
  );
  conferirCrua(atribuicao.cartAttributesUpdate, "atribuir");

  const sacola = await identificarCrua(cartId, comprador, ip);
  // A compra vai acontecer agora: a lista de pedidos em cache já não vale.
  await apagarCache(`pedidos:usuario:${comprador.id_usuario}`);

  if (!sacola.totalQuantity) {
    throw new HttpError(409, "A sacola está vazia.");
  }

  return { checkoutUrl: sacola.checkoutUrl };
};
