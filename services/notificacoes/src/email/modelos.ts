import type { Email } from "./email.service";

export type PedidoStatus =
  | "aguardando_calculo_frete"
  | "aguardando_pagamento"
  | "pago"
  | "enviado"
  | "entregue"
  | "cancelado";

type Destinatario = { nome?: string | null; email: string };

const ENTIDADES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

const escapar = (valor: string) => valor.replace(/[&<>"']/g, (c) => ENTIDADES[c]);

const urlDoSite = () => (process.env.FRONTEND_URL || "https://localhost").replace(/\/+$/, "");

const primeiroNome = (nome?: string | null) => (nome ?? "").trim().split(/\s+/)[0] || "";

const reais = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Cores do site (index.css, tema claro): --stone, --paper, --ink, --muted, --line e --lit (Tempo Comum).
const COR = {
  fundo: "#ecebe7",
  cartao: "#f7f6f3",
  tinta: "#1d1c1a",
  suave: "#5e5a54",
  linha: "#cfccc5",
  destaque: "#2f6a46",
};

type Etapa = "pedido" | "pagamento" | "envio" | "entrega";

type Conteudo = {
  assunto: string;
  titulo: string;
  paragrafos: string[];
  botao?: { texto: string; url: string };
  // Etapa atual na linha do tempo do pedido (sem ela, a linha não aparece).
  etapa?: Etapa;
  valorTotal?: number | null;
  // Bloco pronto (já escapado) entre os parágrafos e o botão, com a versão em texto puro.
  bloco?: { html: string; texto: string[] };
  // Rodapé próprio (ex.: ofertas, com link para cancelar a inscrição).
  rodape?: { html: string; texto: string };
};

const ETAPAS: { chave: Etapa; rotulo: string }[] = [
  { chave: "pedido", rotulo: "Pedido" },
  { chave: "pagamento", rotulo: "Pagamento" },
  { chave: "envio", rotulo: "Envio" },
  { chave: "entrega", rotulo: "Entrega" },
];

const linhaDoTempo = (etapa: Etapa) => {
  const atual = ETAPAS.findIndex((e) => e.chave === etapa);
  const celulas = ETAPAS.map((e, i) => {
    const feita = i <= atual;
    const bolinha = `<div style="width:22px;height:22px;line-height:22px;margin:0 auto 6px;border-radius:50%;font-size:12px;text-align:center;${
      feita ? `background:${COR.destaque};color:#ffffff` : `background:${COR.cartao};color:${COR.suave};border:1px solid ${COR.linha}`
    }">${feita ? "&#10003;" : i + 1}</div>`;
    return `<td width="25%" align="center" style="font-size:12px;color:${feita ? COR.tinta : COR.suave};${i === atual ? "font-weight:bold;" : ""}">${bolinha}${e.rotulo}</td>`;
  }).join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px">${`<tr>${celulas}</tr>`}</table>`;
};

// Layout único, em tabela e com estilo inline: é o que os clientes de e-mail (Gmail, Outlook) respeitam.
const montar = (para: string, saudacao: string, conteudo: Conteudo): Email => {
  const paragrafosHtml = conteudo.paragrafos
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COR.tinta}">${escapar(p)}</p>`)
    .join("");
  const valorHtml =
    conteudo.valorTotal != null && !Number.isNaN(conteudo.valorTotal)
      ? `<p style="margin:0 0 16px;font-size:15px;color:${COR.tinta}">Total do pedido: <strong>${escapar(reais(conteudo.valorTotal))}</strong></p>`
      : "";
  const botaoHtml = conteudo.botao
    ? `<p style="margin:24px 0 8px"><a href="${escapar(conteudo.botao.url)}" style="display:inline-block;padding:12px 24px;background:${COR.tinta};color:${COR.fundo};text-decoration:none;font-size:14px;letter-spacing:.08em;text-transform:uppercase">${escapar(conteudo.botao.texto)}</a></p>`
    : "";

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${escapar(conteudo.assunto)}</title></head>
<body style="margin:0;padding:0;background:${COR.fundo};font-family:Georgia,'Times New Roman',serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.fundo};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${COR.cartao};border:1px solid ${COR.linha}">
<tr><td style="padding:24px 32px;border-bottom:1px solid ${COR.linha};font-size:20px;letter-spacing:.3em;color:${COR.tinta}">AGNUS</td></tr>
<tr><td style="padding:32px">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:normal;color:${COR.tinta}">${escapar(conteudo.titulo)}</h1>
${conteudo.etapa ? linhaDoTempo(conteudo.etapa) : ""}
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COR.tinta}">${escapar(saudacao)}</p>
${paragrafosHtml}${valorHtml}${conteudo.bloco?.html ?? ""}${botaoHtml}
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid ${COR.linha};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${COR.suave}">${conteudo.rodape?.html ?? "Você recebeu este e-mail por causa de um pedido na Agnus. Dúvidas? É só responder esta mensagem."}</td></tr>
</table></td></tr></table></body></html>`;

  const texto = [
    conteudo.titulo,
    "",
    saudacao,
    "",
    ...conteudo.paragrafos.flatMap((p) => [p, ""]),
    ...(conteudo.valorTotal != null && !Number.isNaN(conteudo.valorTotal) ? [`Total do pedido: ${reais(conteudo.valorTotal)}`, ""] : []),
    ...(conteudo.bloco ? [...conteudo.bloco.texto, ""] : []),
    ...(conteudo.botao ? [`${conteudo.botao.texto}: ${conteudo.botao.url}`] : []),
    ...(conteudo.rodape ? ["", "--", conteudo.rodape.texto] : []),
  ].join("\n");

  return { para, assunto: conteudo.assunto, html, texto };
};

const linkDoPedido = (pedido: number) => `${urlDoSite()}/cliente/pedidos?pedido=${pedido}`;

const CONTEUDO_POR_STATUS: Partial<Record<PedidoStatus, (pedido: number) => Conteudo>> = {
  aguardando_pagamento: (pedido) => ({
    assunto: `Recebemos seu pedido #${pedido}`,
    titulo: "Recebemos seu pedido",
    etapa: "pedido",
    paragrafos: [
      `Seu pedido #${pedido} foi registrado e está aguardando o pagamento.`,
      "Você pode pagar com PIX ou cartão de crédito em até 12x, direto no site. Assim que o pagamento for confirmado, suas peças entram em produção.",
    ],
    botao: { texto: "Pagar pedido", url: `${urlDoSite()}/pagamento/${pedido}` },
  }),
  pago: (pedido) => ({
    assunto: `Recebemos seu pagamento - pedido #${pedido}`,
    titulo: "Recebemos seu pagamento",
    etapa: "pagamento",
    paragrafos: [
      `O pagamento do pedido #${pedido} foi confirmado.`,
      "Suas peças já entraram em produção. Avisaremos por e-mail assim que o pedido sair para entrega.",
    ],
    botao: { texto: "Acompanhar pedido", url: linkDoPedido(pedido) },
  }),
  enviado: (pedido) => ({
    assunto: `Seu pedido #${pedido} saiu para entrega`,
    titulo: "Seu pedido saiu para entrega",
    etapa: "envio",
    paragrafos: [
      `Boa notícia: o pedido #${pedido} já está a caminho.`,
      "Você acompanha cada etapa da entrega em Meus pedidos, no nosso site.",
    ],
    botao: { texto: "Acompanhar entrega", url: linkDoPedido(pedido) },
  }),
  entregue: (pedido) => ({
    assunto: `Seu pedido #${pedido} foi entregue`,
    titulo: "Seu pedido foi entregue",
    etapa: "entrega",
    paragrafos: [
      `O pedido #${pedido} foi entregue. Esperamos que você goste das peças!`,
      "Conta pra gente como ficaram: sua avaliação ajuda muito quem está escolhendo.",
    ],
    botao: { texto: "Avaliar peças", url: linkDoPedido(pedido) },
  }),
  cancelado: (pedido) => ({
    assunto: `Seu pedido #${pedido} foi cancelado`,
    titulo: "Pedido cancelado",
    paragrafos: [
      `O pedido #${pedido} foi cancelado.`,
      "Se o pagamento já tinha sido feito, o estorno segue o prazo do Mercado Pago e do seu banco. Qualquer dúvida, é só responder este e-mail.",
    ],
    botao: { texto: "Ver meus pedidos", url: linkDoPedido(pedido) },
  }),
};

export const emailDeStatus = (
  destinatario: Destinatario,
  pedido: number,
  status: PedidoStatus,
  valorTotal?: number | null,
): Email | null => {
  const conteudo = CONTEUDO_POR_STATUS[status]?.(pedido);

  if (!conteudo) {
    return null;
  }

  const nome = primeiroNome(destinatario.nome);
  return montar(destinatario.email, nome ? `Olá, ${nome}!` : "Olá!", { ...conteudo, valorTotal: valorTotal ?? null });
};

// ---------------- Devolução ----------------
export type StatusDevolucao = "solicitada" | "aprovada" | "recusada" | "recebida" | "reembolsada" | "cancelada";
export type AvisoDevolucao = {
  id_pedido: number;
  id_devolucao: number;
  status: StatusDevolucao;
  valor_reembolso?: number | null;
  resposta_loja?: string | null;
  codigo_postagem?: string | null;
};

// Título e mensagem curta (aviso no site, até 255 caracteres) e o conteúdo do e-mail de cada etapa.
export const conteudoDaDevolucao = (aviso: AvisoDevolucao) => {
  const pedido = aviso.id_pedido;
  const valor = aviso.valor_reembolso != null && !Number.isNaN(Number(aviso.valor_reembolso)) ? reais(Number(aviso.valor_reembolso)) : null;
  const resposta = aviso.resposta_loja?.trim() || null;
  const botao = { texto: "Ver devolução", url: linkDoPedido(pedido) };

  const porStatus: Record<StatusDevolucao, { titulo: string; mensagem: string; email: Conteudo }> = {
    solicitada: {
      titulo: "Pedido de devolução recebido",
      mensagem: `Recebemos seu pedido de devolução do pedido #${pedido}. Vamos analisar e responder em breve.`,
      email: {
        assunto: `Recebemos seu pedido de devolução - pedido #${pedido}`,
        titulo: "Recebemos seu pedido de devolução",
        paragrafos: [
          `Seu pedido de devolução das peças do pedido #${pedido} foi registrado${valor ? ` (reembolso previsto de ${valor})` : ""}.`,
          "Vamos analisar e responder por aqui com as instruções para o envio. Não envie a peça antes da nossa resposta.",
        ],
        botao,
      },
    },
    aprovada: {
      titulo: "Devolução aprovada",
      mensagem: `Sua devolução do pedido #${pedido} foi aprovada. Veja como enviar a peça.`,
      email: {
        assunto: `Devolução aprovada - pedido #${pedido}`,
        titulo: "Sua devolução foi aprovada",
        paragrafos: [
          `Aprovamos a devolução das peças do pedido #${pedido}.`,
          ...(resposta ? [`Como enviar: ${resposta}`] : []),
          ...(aviso.codigo_postagem ? [`Código de postagem: ${aviso.codigo_postagem}`] : []),
          "Assim que a peça chegar e for conferida, fazemos o reembolso.",
        ],
        botao,
      },
    },
    recusada: {
      titulo: "Devolução não aprovada",
      mensagem: `Não pudemos aprovar a devolução do pedido #${pedido}. Veja o motivo no pedido.`,
      email: {
        assunto: `Sobre a sua devolução - pedido #${pedido}`,
        titulo: "Não pudemos aprovar a devolução",
        paragrafos: [
          `Analisamos o pedido de devolução do pedido #${pedido} e não foi possível aprová-lo.`,
          ...(resposta ? [`Motivo: ${resposta}`] : []),
          "Se tiver dúvidas, é só responder este e-mail.",
        ],
        botao,
      },
    },
    recebida: {
      titulo: "Recebemos a peça devolvida",
      mensagem: `A peça devolvida do pedido #${pedido} chegou. O reembolso está em andamento.`,
      email: {
        assunto: `Recebemos a peça devolvida - pedido #${pedido}`,
        titulo: "A peça devolvida chegou",
        paragrafos: [`Recebemos a peça devolvida do pedido #${pedido}.`, `O reembolso${valor ? ` de ${valor}` : ""} já está em andamento.`],
        botao,
      },
    },
    reembolsada: {
      titulo: "Reembolso feito",
      mensagem: `O reembolso${valor ? ` de ${valor}` : ""} da devolução do pedido #${pedido} foi feito.`,
      email: {
        assunto: `Reembolso feito - pedido #${pedido}`,
        titulo: "Seu reembolso foi feito",
        paragrafos: [
          `Fizemos o reembolso${valor ? ` de ${valor}` : ""} referente à devolução do pedido #${pedido}.`,
          "No PIX, o valor costuma voltar na hora; no cartão de crédito, aparece em até duas faturas, conforme o seu banco.",
        ],
        botao,
      },
    },
    cancelada: {
      titulo: "Devolução cancelada",
      mensagem: `Você cancelou a devolução do pedido #${pedido}.`,
      email: {
        assunto: `Devolução cancelada - pedido #${pedido}`,
        titulo: "Devolução cancelada",
        paragrafos: [`A devolução do pedido #${pedido} foi cancelada a seu pedido.`, "Se mudar de ideia, ainda pode pedir de novo dentro do prazo."],
        botao,
      },
    },
  };

  return porStatus[aviso.status] ?? null;
};

export const emailDeDevolucao = (destinatario: Destinatario, aviso: AvisoDevolucao): Email | null => {
  const conteudo = conteudoDaDevolucao(aviso);
  if (!conteudo) return null;
  const nome = primeiroNome(destinatario.nome);
  return montar(destinatario.email, nome ? `Olá, ${nome}!` : "Olá!", conteudo.email);
};

export const emailDevolucaoParaEquipe = (para: string, aviso: AvisoDevolucao): Email =>
  montar(para, "Olá, equipe!", {
    assunto: `Novo pedido de devolução - pedido #${aviso.id_pedido}`,
    titulo: `Pedido de devolução #${aviso.id_devolucao}`,
    paragrafos: [
      `Um cliente pediu devolução de peças do pedido #${aviso.id_pedido}.`,
      "Analise no painel e responda com as instruções de envio ou o motivo da recusa.",
    ],
    botao: { texto: "Abrir devoluções", url: `${urlDoSite()}/admin/devolucoes` },
  });

export const emailNovoPedidoParaEquipe = (para: string, pedido: number, valorTotal: number | null): Email =>
  montar(para, "Olá, equipe!", {
    assunto: `Novo pedido #${pedido}`,
    titulo: `Novo pedido #${pedido}`,
    paragrafos: [
      `Chegou o pedido #${pedido}${valorTotal != null && !Number.isNaN(valorTotal) ? ` no valor de ${reais(valorTotal)}` : ""}.`,
      "Ele está aguardando o pagamento. A produção começa quando o pagamento for confirmado.",
    ],
    botao: { texto: "Abrir painel", url: `${urlDoSite()}/admin` },
  });

export const emailPagamentoParaEquipe = (para: string, pedido: number): Email =>
  montar(para, "Olá, equipe!", {
    assunto: `Pedido #${pedido} pago: iniciar produção`,
    titulo: `Pedido #${pedido} pago`,
    paragrafos: [`O pagamento do pedido #${pedido} foi confirmado. Pode iniciar a produção.`],
    botao: { texto: "Abrir painel", url: `${urlDoSite()}/admin` },
  });

// Boas-vindas das ofertas por e-mail, com o cupom de primeira compra e o link para cancelar.
export const emailBoasVindasOfertas = (para: string, cupom: string, token: string, percentual: number): Email => {
  const cancelar = `${urlDoSite()}/ofertas/cancelar?token=${encodeURIComponent(token)}`;
  const cupomHtml = `<p style="margin:8px 0 24px;padding:18px;text-align:center;border:1px dashed ${COR.destaque};font-family:'Courier New',monospace;font-size:22px;letter-spacing:.12em;color:${COR.destaque}">${escapar(cupom)}</p>`;

  return montar(para, "Olá!", {
    assunto: `Seu cupom de ${percentual}% na primeira compra`,
    titulo: `${percentual}% na sua primeira compra`,
    paragrafos: [
      "Que bom ter você por perto. A partir de agora você recebe primeiro as campanhas, os lançamentos e as ofertas da Agnus.",
      `Para começar, use o cupom abaixo ao finalizar a sua primeira compra e ganhe ${percentual}% de desconto nas peças.`,
    ],
    bloco: { html: cupomHtml, texto: [`Seu cupom: ${cupom}`] },
    botao: { texto: "Ver a coleção", url: `${urlDoSite()}/catalogo` },
    rodape: {
      html: `Você recebeu este e-mail porque se inscreveu para receber ofertas da Agnus. <a href="${escapar(cancelar)}" style="color:${COR.suave}">Não quero mais receber</a>.`,
      texto: `Você se inscreveu para receber ofertas da Agnus. Para cancelar: ${cancelar}`,
    },
  });
};

export type ProdutoParaAvaliar = { id_produto: number; nome: string; foto?: string | null };

// Pedido de avaliação alguns dias depois da entrega: um link para cada peça, já abrindo o formulário.
export const emailPedirAvaliacao = (destinatario: Destinatario, idPedido: number, produtos: ProdutoParaAvaliar[]): Email | null => {
  if (!produtos.length) return null;

  const nome = primeiroNome(destinatario.nome);
  const link = (p: ProdutoParaAvaliar) => `${urlDoSite()}/produto/${p.id_produto}?avaliar=1#avaliacoes`;
  const linhas = produtos
    .map(
      (p) =>
        `<tr><td style="padding:12px 0;border-top:1px solid ${COR.linha};font-size:15px;color:${COR.tinta}">${escapar(p.nome)}</td>` +
        `<td align="right" style="padding:12px 0;border-top:1px solid ${COR.linha}"><a href="${escapar(link(p))}" style="color:${COR.destaque};font-size:14px">Avaliar &#9733;</a></td></tr>`,
    )
    .join("");

  return montar(destinatario.email, nome ? `Olá, ${nome}!` : "Olá!", {
    assunto: "Como ficaram as suas peças?",
    titulo: "Conte como ficou",
    paragrafos: [
      `O seu pedido #${idPedido} chegou há alguns dias. Queremos saber: o caimento, o tecido, o tamanho, tudo ficou como você esperava?`,
      "Sua avaliação leva um minuto e ajuda quem está escolhendo a peça certa.",
    ],
    bloco: {
      html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px">${linhas}</table>`,
      texto: produtos.map((p) => `${p.nome}: ${link(p)}`),
    },
  });
};

// A loja anexou a NF-e: o cliente vê e baixa em "Meus pedidos".
export const emailNotaFiscal = (destinatario: Destinatario, idPedido: number): Email => {
  const nome = primeiroNome(destinatario.nome);
  return montar(destinatario.email, nome ? `Olá, ${nome}!` : "Olá!", {
    assunto: `Nota fiscal do pedido #${idPedido}`,
    titulo: "Sua nota fiscal está disponível",
    paragrafos: [
      `A nota fiscal eletrônica (NF-e) do seu pedido #${idPedido} já foi emitida.`,
      "Em Meus pedidos você abre o DANFE em PDF, baixa o XML e vê a chave de acesso para consultar na Receita.",
    ],
    botao: { texto: "Ver nota fiscal", url: `${urlDoSite()}/cliente/pedidos` },
  });
};
