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

// Por conta, não por IP: senão um token roubado testaria senhas atuais trocando de IP.
export const limitarTrocaSenha = rateLimit({
  windowMs: 15 * JANELA_MS,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `troca-senha:${req.params.id}`,
  message: { message: "Muitas tentativas de troca de senha. Aguarde 15 minutos." },
});
