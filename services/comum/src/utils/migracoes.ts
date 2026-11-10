import { QueryTypes, type Sequelize, type Transaction } from "sequelize";
import logger from "./logger";

export type Migracao = {
  nome: string;
  up: (banco: Sequelize) => Promise<void>;
};

const TABELA = "agnus_migracoes";
const TRAVA = "agnus_migracoes";
const ESPERA_TRAVA_S = 60;

// Roda as migrations ainda não aplicadas, na ordem da lista. A trava do MySQL impede que duas réplicas
// do mesmo serviço migrem ao mesmo tempo; a transação só serve para fixar a mesma conexão, porque
// GET_LOCK pertence à conexão (DDL no MySQL não volta atrás com rollback).
export const executarMigracoes = async (banco: Sequelize, migracoes: Migracao[]) => {
  await banco.query(
    `CREATE TABLE IF NOT EXISTS ${TABELA} (nome VARCHAR(150) PRIMARY KEY, executada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  );

  return banco.transaction(async (transaction: Transaction) => {
    const [trava] = await banco.query<{ ok: number | null }>(`SELECT GET_LOCK('${TRAVA}', ${ESPERA_TRAVA_S}) AS ok`, {
      type: QueryTypes.SELECT,
      transaction,
    });

    if (Number(trava?.ok) !== 1) {
      throw new Error("Não foi possível obter a trava das migrations.");
    }

    try {
      const feitas = await banco.query<{ nome: string }>(`SELECT nome FROM ${TABELA}`, { type: QueryTypes.SELECT, transaction });
      const aplicadas = new Set(feitas.map((linha) => linha.nome));
      const novas = migracoes.filter((migracao) => !aplicadas.has(migracao.nome));

      for (const migracao of novas) {
        logger.info("migracao.iniciada", { nome: migracao.nome });
        await migracao.up(banco);
        await banco.query(`INSERT INTO ${TABELA} (nome) VALUES (:nome)`, { replacements: { nome: migracao.nome }, transaction });
        logger.info("migracao.aplicada", { nome: migracao.nome });
      }

      return novas.map((migracao) => migracao.nome);
    } finally {
      await banco.query(`SELECT RELEASE_LOCK('${TRAVA}')`, { transaction });
    }
  });
};
