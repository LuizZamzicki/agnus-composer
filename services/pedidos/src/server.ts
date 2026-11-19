import "dotenv/config";
import sequelize from "@agnus/comum/config/database";
import { iniciarServico } from "@agnus/comum/utils/servico";
import app from "./app";
import migracoes from "./migracoes";
import { iniciarSincronizacaoYouDraw } from "./fornecedor/youdraw.service";
import { iniciarPedidosDeAvaliacao } from "./services/pedirAvaliacao.service";

void iniciarServico({
  app,
  banco: sequelize,
  migracoes,
  aoIniciar: () => {
    iniciarSincronizacaoYouDraw();
    iniciarPedidosDeAvaliacao();
  },
});
