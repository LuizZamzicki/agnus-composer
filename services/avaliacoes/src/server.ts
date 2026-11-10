import "dotenv/config";
import sequelize from "@agnus/comum/config/database";
import { iniciarServico } from "@agnus/comum/utils/servico";
import { assinarEventos } from "./eventos";
import app from "./app";
import migracoes from "./migracoes";

void iniciarServico({ app, banco: sequelize, migracoes, aoIniciar: assinarEventos });
