import type { Migracao } from "@agnus/comum/utils/migracoes";
import esquemaInicial from "./0001-esquema-inicial";
import registroEventos from "./0002-registro-eventos";
import registroFornecedor from "./0003-registro-fornecedor";

// Ordem de execução. Migração nova entra no fim da lista e nunca é editada depois de publicada.
const migracoes: Migracao[] = [esquemaInicial, registroEventos, registroFornecedor];

export default migracoes;
