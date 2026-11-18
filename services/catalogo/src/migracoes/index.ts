import type { Migracao } from "@agnus/comum/utils/migracoes";
import esquemaInicial from "./0001-esquema-inicial";
import precoOriginal from "./0002-preco-original";
import tabelaMedidas from "./0003-tabela-medidas";
import produtoSkus from "./0004-produto-skus";

// Ordem de execução. Migração nova entra no fim da lista e nunca é editada depois de publicada.
const migracoes: Migracao[] = [esquemaInicial, precoOriginal, tabelaMedidas, produtoSkus];

export default migracoes;
