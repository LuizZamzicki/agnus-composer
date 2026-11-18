#!/usr/bin/env node
// Gera o par de chaves ES256 dos tokens de sessão e grava no .env indicado, sem mostrar as chaves.
// Uso: node services/scripts/gerar-chaves-jwt.cjs services/.env
//
// JWT_PRIVATE_KEY fica só no container da identidade (o docker-compose apaga dos outros);
// JWT_PUBLIC_KEY vai para todos. Se as chaves já existirem, nada muda. Trocar as chaves
// encerra todas as sessões abertas.
const { generateKeyPairSync } = require("crypto");
const fs = require("fs");

const arquivo = process.argv[2];

if (!arquivo || !fs.existsSync(arquivo)) {
  console.error("Informe o caminho de um .env existente. Ex.: node services/scripts/gerar-chaves-jwt.cjs services/.env");
  process.exit(1);
}

const conteudo = fs.readFileSync(arquivo, "utf8");

if (/^JWT_PRIVATE_KEY=.+/m.test(conteudo) && /^JWT_PUBLIC_KEY=.+/m.test(conteudo)) {
  console.log(`As chaves já existem em ${arquivo}; nada foi alterado.`);
  process.exit(0);
}

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const base64 = (pem) => Buffer.from(pem).toString("base64");
const quebra = conteudo.includes("\r\n") ? "\r\n" : "\n";
const semAntigas = conteudo
  .split(/\r?\n/)
  .filter((linha) => !/^JWT_(PRIVATE|PUBLIC)_KEY=/.test(linha))
  .join(quebra)
  .replace(/\s*$/, "");

fs.writeFileSync(
  arquivo,
  [
    semAntigas,
    "",
    "# Tokens de sessão ES256 (gerado por services/scripts/gerar-chaves-jwt.cjs).",
    `JWT_PRIVATE_KEY=${base64(privateKey)}`,
    `JWT_PUBLIC_KEY=${base64(publicKey)}`,
    "",
  ].join(quebra),
  { mode: 0o600 },
);

console.log(`Chaves geradas e gravadas em ${arquivo}. Todos precisarão entrar de novo.`);
