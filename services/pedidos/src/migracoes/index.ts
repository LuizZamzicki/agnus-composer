import type { Migracao } from "@agnus/comum/utils/migracoes";
import esquemaInicial from "./0001-esquema-inicial";
import pagamentos from "./0002-pagamentos";
import codigoRastreio from "./0003-codigo-rastreio";
import refAfiliado from "./0004-ref-afiliado";
import devolucoes from "./0005-devolucoes";
import devolucaoFotos from "./0006-devolucao-fotos";
import pedidosFornecedor from "./0007-pedidos-fornecedor";
import ofertasCupons from "./0008-ofertas-cupons";
import freteCep from "./0009-frete-cep";

// Ordem de execução. Migração nova entra no fim da lista e nunca é editada depois de publicada.
const migracoes: Migracao[] = [esquemaInicial, pagamentos, codigoRastreio, refAfiliado, devolucoes, devolucaoFotos, pedidosFornecedor, ofertasCupons, freteCep];

export default migracoes;
