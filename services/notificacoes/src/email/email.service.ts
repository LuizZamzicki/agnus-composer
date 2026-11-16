import nodemailer, { type Transporter } from "nodemailer";
import logger from "@agnus/comum/utils/logger";
import RegistroService, { mascararEmail } from "../registro/registro.service";

export type Email = { para: string; assunto: string; html: string; texto: string };

// A que o e-mail se refere (vai para o registro de eventos).
export type ContextoEmail = { id_pedido?: number | null; id_usuario?: number | null; id_devolucao?: number | null; destinatario?: "cliente" | "equipe" };

type ConfigSmtp = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  remetente: string;
};

// Sem SMTP_HOST o envio fica desligado (só registra no log): o aviso no site continua funcionando.
export const configuracaoSmtp = (): ConfigSmtp | null => {
  const host = process.env.SMTP_HOST?.trim();

  if (!host) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim() || undefined;

  return {
    host,
    port,
    // 465 é SMTP com TLS direto; 587/25 começam sem TLS e sobem com STARTTLS.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    user,
    pass: process.env.SMTP_PASS || undefined,
    remetente: process.env.EMAIL_FROM?.trim() || (user ? `Agnus <${user}>` : "Agnus <nao-responda@agnus.local>"),
  };
};

let transporte: Transporter | null = null;
let chaveDoTransporte = "";

const obterTransporte = (config: ConfigSmtp) => {
  const chave = `${config.host}:${config.port}:${config.secure}:${config.user ?? ""}`;

  if (!transporte || chave !== chaveDoTransporte) {
    transporte = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    chaveDoTransporte = chave;
  }

  return transporte;
};

export const reiniciarTransporte = () => {
  transporte = null;
  chaveDoTransporte = "";
};

class EmailService {
  // Nunca lança: e-mail é um aviso a mais, não pode derrubar quem chamou.
  static async enviar(email: Email, contexto: ContextoEmail = {}): Promise<boolean> {
    const config = configuracaoSmtp();
    const base = {
      categoria: "email" as const,
      id_pedido: contexto.id_pedido ?? null,
      id_usuario: contexto.id_usuario ?? null,
      id_devolucao: contexto.id_devolucao ?? null,
    };
    const para = mascararEmail(email.para);
    const quem = contexto.destinatario === "equipe" ? "equipe" : "cliente";
    const aoQuem = quem === "equipe" ? "à equipe" : "ao cliente";

    if (!config) {
      logger.info("email.desativado", { assunto: email.assunto, motivo: "SMTP_HOST não configurado" });
      await RegistroService.registrar({
        ...base,
        tipo: "email.desativado",
        resultado: "ignorado",
        descricao: `E-mail não enviado (envio desligado): "${email.assunto}" para ${para}`,
        dados: { assunto: email.assunto, para, destinatario: quem, motivo: "SMTP_HOST não configurado" },
      });
      return false;
    }

    try {
      const info = await obterTransporte(config).sendMail({
        from: config.remetente,
        to: email.para,
        subject: email.assunto,
        html: email.html,
        text: email.texto,
      });

      // O destinatário é dado pessoal: o log guarda só o id da mensagem; o registro, o e-mail mascarado.
      logger.info("email.enviado", { assunto: email.assunto, messageId: info.messageId });
      await RegistroService.registrar({
        ...base,
        tipo: "email.enviado",
        descricao: `E-mail enviado ${aoQuem} (${para}): "${email.assunto}"`,
        dados: { assunto: email.assunto, para, destinatario: quem, messageId: info.messageId, servidor: config.host },
      });
      return true;
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error);
      logger.error("email.falha_envio", { assunto: email.assunto, error: motivo });
      await RegistroService.registrar({
        ...base,
        tipo: "email.falhou",
        resultado: "falha",
        descricao: `Falha ao enviar e-mail ${aoQuem} (${para}): "${email.assunto}"`,
        dados: { assunto: email.assunto, para, destinatario: quem, erro: motivo.slice(0, 300), servidor: config.host },
      });
      return false;
    }
  }
}

export default EmailService;
