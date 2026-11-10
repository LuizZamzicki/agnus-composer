import rateLimit from "express-rate-limit";

const JANELA_MS = 60 * 1000;

// Fica na API, e nao so no Nginx, para valer tambem no tunel ngrok e em qualquer grafia da rota.
const limitarPorIp = (limit: number) =>
  rateLimit({
    windowMs: JANELA_MS,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Muitas tentativas. Aguarde um minuto e tente novamente." },
  });

export const limitarLogin = limitarPorIp(10);
export const limitarCadastro = limitarPorIp(5);
