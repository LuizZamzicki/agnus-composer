import "dotenv/config";
import sequelize from "@agnus/comum/config/database";
import { iniciarServico } from "@agnus/comum/utils/servico";
import { iniciarProjecaoDeVendas } from "./services/vendas.service";
import app from "./app";

void iniciarServico({ app, banco: sequelize, aoIniciar: iniciarProjecaoDeVendas });
