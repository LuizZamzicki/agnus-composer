import "dotenv/config";
import { iniciarServico } from "@agnus/comum/utils/servico";
import app from "./app";

void iniciarServico({ app });
