import type { Migracao } from "@agnus/comum/utils/migracoes";

// Banners da vitrine (fotos grandes da página inicial), cadastrados pela equipe no admin.
// inicio/fim agendam campanhas (ex.: Black Friday) sem precisar lembrar de tirar do ar.
const migracao: Migracao = {
  nome: "0005-vitrine-banners",
  up: async (banco) => {
    await banco.query(`CREATE TABLE IF NOT EXISTS \`vitrine_banners\` (
  \`id_banner\` int NOT NULL AUTO_INCREMENT,
  \`titulo\` varchar(80) NOT NULL,
  \`subtitulo\` varchar(180) DEFAULT NULL,
  \`sobretitulo\` varchar(40) DEFAULT NULL,
  \`texto_botao\` varchar(40) DEFAULT NULL,
  \`link\` varchar(255) DEFAULT NULL,
  \`imagem_url\` varchar(255) NOT NULL,
  \`imagem_mobile_url\` varchar(255) DEFAULT NULL,
  \`alinhamento\` enum('esquerda','centro','direita') NOT NULL DEFAULT 'esquerda',
  \`foco\` enum('topo','centro','base') NOT NULL DEFAULT 'centro',
  \`ordem\` int NOT NULL DEFAULT 0,
  \`ativo\` tinyint(1) NOT NULL DEFAULT 1,
  \`inicio\` datetime DEFAULT NULL,
  \`fim\` datetime DEFAULT NULL,
  \`data_criacao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`data_alteracao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id_banner\`),
  KEY \`IDX_VITRINE_BANNERS_ATIVO\` (\`ativo\`, \`ordem\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  },
};

export default migracao;
