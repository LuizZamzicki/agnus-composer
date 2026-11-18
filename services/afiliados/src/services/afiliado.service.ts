import { HttpError } from "@agnus/comum/types/http_error";
import { Afiliados } from "../models";
import { cifrar, gerarCodigo, novoAppId, novoSegredo } from "../utils/seguranca";

const texto = (valor: unknown, max: number) => (typeof valor === "string" ? valor.trim().slice(0, max) : "");

export const serializarAfiliado = (afiliado: Afiliados) => ({
  id_afiliado: afiliado.id_afiliado,
  id_usuario: afiliado.id_usuario,
  codigo: afiliado.codigo,
  nome_publico: afiliado.nome_publico,
  canal: afiliado.canal,
  chave_pix: afiliado.chave_pix,
  status: afiliado.status,
  taxa_personalizada: afiliado.taxa_personalizada == null ? null : Number(afiliado.taxa_personalizada),
  app_id: afiliado.app_id,
  tem_credencial_api: Boolean(afiliado.segredo_cifrado),
  data_criacao: afiliado.data_criacao,
});

class AfiliadoService {
  static porUsuario(idUsuario: number) {
    return Afiliados.findOne({ where: { id_usuario: idUsuario } });
  }

  // Cadastro no programa: entra como "pendente" e a equipe aprova (como na Shopee Afiliados).
  static async inscrever(idUsuario: number, corpo: Record<string, unknown>) {
    if (await AfiliadoService.porUsuario(idUsuario)) {
      throw new HttpError(409, "Você já tem cadastro no programa de afiliados.");
    }

    if (corpo.aceite_termos !== true) {
      throw new HttpError(400, "É preciso aceitar os termos do programa de afiliados (aceite_termos: true).");
    }

    const nomePublico = texto(corpo.nome_publico, 80);
    if (nomePublico.length < 2) {
      throw new HttpError(400, "Informe o nome público (como você aparece para a loja).");
    }

    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      const codigo = gerarCodigo(6);
      if (await Afiliados.findOne({ where: { codigo } })) continue;

      return Afiliados.create({
        id_usuario: idUsuario,
        codigo,
        nome_publico: nomePublico,
        canal: texto(corpo.canal, 255) || null,
        chave_pix: texto(corpo.chave_pix, 120) || null,
        status: "pendente",
      });
    }

    throw new HttpError(503, "Não foi possível concluir o cadastro agora. Tente de novo.");
  }

  static async atualizar(afiliado: Afiliados, corpo: Record<string, unknown>) {
    const alteracoes: Partial<Afiliados> = {};

    if (corpo.nome_publico !== undefined) {
      const nome = texto(corpo.nome_publico, 80);
      if (nome.length < 2) throw new HttpError(400, "Nome público inválido.");
      alteracoes.nome_publico = nome;
    }

    if (corpo.canal !== undefined) alteracoes.canal = texto(corpo.canal, 255) || null;
    if (corpo.chave_pix !== undefined) alteracoes.chave_pix = texto(corpo.chave_pix, 120) || null;

    return afiliado.update(alteracoes);
  }

  // AppID + segredo da API aberta. O segredo aparece só nesta resposta; gerar de novo invalida o anterior.
  static async gerarCredenciais(afiliado: Afiliados) {
    if (afiliado.status !== "ativo") {
      throw new HttpError(403, "As credenciais da API ficam disponíveis depois que o cadastro é aprovado.");
    }

    const segredo = novoSegredo();
    // O AppID é fixo depois de criado; só o segredo muda a cada nova geração.
    let appId = afiliado.app_id;

    while (!appId) {
      const candidato = novoAppId();
      if (!(await Afiliados.findOne({ where: { app_id: candidato } }))) appId = candidato;
    }

    await afiliado.update({ app_id: appId, segredo_cifrado: cifrar(segredo) });
    return { app_id: appId, segredo };
  }
}

export default AfiliadoService;
