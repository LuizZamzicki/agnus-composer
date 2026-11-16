import type { Migracao } from "@agnus/comum/utils/migracoes";
import esquemaInicial from "./0001-esquema-inicial";

// Ordem de execução. Migração nova entra no fim da lista e nunca é editada depois de publicada.
const migracoes: Migracao[] = [esquemaInicial];

export default migracoes;
