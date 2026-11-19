// Textos e regras da loja num lugar só: faixa de avisos, perguntas frequentes, contatos e parcelas.
// Para mudar um aviso ou uma resposta, edite aqui; as telas leem deste arquivo.

export const PARCELAS_SEM_JUROS = 2; // de 3x em diante o cartão cobra juros (Mercado Pago)
export const PARCELAS_MAX = 12;
export const DESCONTO_PIX = 5; // % a menos no Pix (o mesmo de services/pedidos/src/services/ofertas.regras.ts)
export const DESCONTO_PRIMEIRA_COMPRA = 10; // % do cupom de quem se inscreve nas ofertas (vale na 1ª compra)
export const DIAS_NOVIDADE = 30; // peça cadastrada há menos que isso ganha a etiqueta "Novidade"
export const EMAIL = "contato@agnusfit.com";
export const INSTAGRAM = { usuario: "@agnus.fit", url: "https://www.instagram.com/agnus.fit/" };

export const WHATSAPP = [
    { rotulo: "44 99138-9614", numero: "5544991389614" },
    { rotulo: "44 99733-6744", numero: "5544997336744" },
];

export const linkWhatsApp = (numero, texto = "Olá! Vim pelo site da Agnus e tenho uma dúvida.") =>
    `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;

// Faixa fina no topo (ao lado do tempo litúrgico). Alterna sozinha a cada poucos segundos.
export const AVISOS = [
    "Black Friday: peças com até 30% off",
    `${DESCONTO_PIX}% off no Pix · ${PARCELAS_SEM_JUROS}x sem juros no cartão`,
    `${DESCONTO_PRIMEIRA_COMPRA}% na primeira compra: cadastre seu e-mail`,
    "Feita sob encomenda, peça por peça",
];

// Perguntas frequentes, por assunto. `home: true` entra também na versão curta da página inicial.
// As respostas seguem as regras que o sistema aplica (prazos de devolução, parcelas, rastreio).
export const DUVIDAS = [
    {
        assunto: "Pedido e produção",
        perguntas: [
            {
                pergunta: "Por que as peças são feitas sob encomenda?",
                resposta:
                    "Nenhuma peça fica parada em estoque: a sua começa a ser produzida quando o pagamento é confirmado. Assim não há desperdício e cada estampa sai nova, feita para você.",
            },
            {
                home: true,
                pergunta: "Quanto tempo leva para o meu pedido chegar?",
                resposta:
                    "O prazo soma a produção da peça e o transporte até o seu endereço. A produção começa quando o pagamento é confirmado; quando a peça é enviada, você recebe um e-mail e o código de rastreio aparece em \"Meus pedidos\".",
            },
            {
                home: true,
                pergunta: "Como acompanho o meu pedido?",
                resposta:
                    "Entre em \"Minha conta\" > \"Meus pedidos\". Cada etapa (pagamento, produção, envio e entrega) aparece ali, com o rastreio da entrega dentro do próprio site. Também avisamos por e-mail a cada mudança.",
            },
            {
                pergunta: "Posso alterar ou cancelar um pedido?",
                resposta:
                    "Fale com a gente pelo WhatsApp o quanto antes, com o número do pedido. Se ele ainda não foi pago, cancelamos sem custo; depois do pagamento a peça entra em produção e vemos juntos o que ainda é possível.",
            },
        ],
    },
    {
        assunto: "Tamanhos",
        perguntas: [
            {
                home: true,
                pergunta: "Como escolho o tamanho certo?",
                resposta:
                    "Na página de cada peça, clique em \"Ver medidas\": lá estão as medidas de cada tamanho em centímetros, como medir uma camiseta sua e uma sugestão de tamanho. As medidas são da peça estendida, não do corpo.",
            },
            {
                pergunta: "E se o tamanho não servir?",
                resposta:
                    "Você tem 7 dias depois da entrega para devolver pelo site, com o motivo \"O tamanho não serviu\". Depois é só fazer um novo pedido no tamanho certo. Nesse caso o frete fica por sua conta.",
            },
        ],
    },
    {
        assunto: "Pagamento",
        perguntas: [
            {
                home: true,
                pergunta: "Quais são as formas de pagamento?",
                resposta: `Pix (aprovação na hora e ${DESCONTO_PIX}% de desconto) ou cartão de crédito em até ${PARCELAS_MAX}x, pelo Mercado Pago. Em até ${PARCELAS_SEM_JUROS}x não há juros; de 3x em diante entram os juros do cartão, mostrados antes de você confirmar. O desconto do Pix soma com o cupom de primeira compra.`,
            },
            {
                pergunta: "É seguro comprar na Agnus?",
                resposta:
                    "Sim. O pagamento acontece no formulário seguro do Mercado Pago: os dados do seu cartão não passam pelo nosso servidor. O site usa conexão criptografada (HTTPS) e seus dados são usados só para o seu pedido.",
            },
            {
                pergunta: "Paguei com Pix e o pedido não mudou. E agora?",
                resposta:
                    "A confirmação do Pix costuma levar poucos segundos. Se o pedido continuar \"aguardando pagamento\" depois de alguns minutos, fale com a gente pelo WhatsApp com o número do pedido.",
            },
        ],
    },
    {
        assunto: "Entrega e nota fiscal",
        perguntas: [
            {
                pergunta: "Vocês entregam em todo o Brasil?",
                resposta: "Sim, enviamos para todo o Brasil. Quando a peça sai, o código de rastreio aparece em Meus pedidos.",
            },
            {
                pergunta: "Onde vejo a nota fiscal da compra?",
                resposta: "Em Meus pedidos, no pedido: lá você abre a NF-e (DANFE em PDF), baixa o XML e copia a chave de acesso. Avisamos por e-mail assim que ela estiver disponível.",
            },
        ],
    },
    {
        assunto: "Trocas e devoluções",
        perguntas: [
            {
                home: true,
                pergunta: "Como funciona a devolução?",
                resposta:
                    "Tudo pelo site, em \"Meus pedidos\" > \"Devolver peças\": você escolhe as peças, o motivo e manda fotos. Depois que aprovamos, enviamos o código de postagem; quando a peça chega, devolvemos o valor das peças.",
            },
            {
                pergunta: "Qual é o prazo para devolver?",
                resposta:
                    "7 dias depois da entrega para desistência ou tamanho que não serviu, e 90 dias para peça com defeito ou peça errada.",
            },
            {
                pergunta: "Quem paga o frete da devolução?",
                resposta:
                    "Se a peça veio com defeito ou errada, o frete é por nossa conta. Para trocar de tamanho, o frete é por conta do cliente. Na desistência da compra, seguimos o Código de Defesa do Consumidor.",
            },
        ],
    },
    {
        assunto: "Afiliados",
        perguntas: [
            {
                pergunta: "Como viro afiliado da Agnus?",
                resposta:
                    "Entre em \"Minha conta\" > \"Seja afiliado\" e faça o cadastro. Depois da aprovação você recebe seus links e ganha comissão sobre as compras feitas por eles.",
            },
        ],
    },
];

export const DUVIDAS_DA_HOME = DUVIDAS.flatMap((g) => g.perguntas.filter((p) => p.home));
