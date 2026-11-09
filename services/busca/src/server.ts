import "dotenv/config";
import { iniciarServico } from "@agnus/comum/utils/servico";
import { iniciarIndexacao } from "./eventos";
import app from "./app";

void iniciarServico({ app, aoIniciar: iniciarIndexacao });
