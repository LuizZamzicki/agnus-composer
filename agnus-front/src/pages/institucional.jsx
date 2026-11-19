import { Link } from "react-router-dom";
import FaleConosco from "../components/faleConosco";
import { EMAIL, PARCELAS_MAX, PARCELAS_SEM_JUROS } from "../conteudo/loja";
import "../css/cliente/institucional.css";
import { useTituloPagina } from "../utils/tituloPagina";

// Páginas do rodapé. Os textos seguem as regras que o sistema aplica hoje (prazos de devolução,
// parcelas, dados usados no pedido). Política de privacidade: revisar com o jurídico antes de publicar.

function Pagina({ sobretitulo, titulo, lede, cy, children }) {
    useTituloPagina(titulo);
    return (
        <main className="institucional" data-cy={cy}>
            <header className="institucional-topo">
                <p className="institucional-sobretitulo">{sobretitulo}</p>
                <h1>{titulo}</h1>
                {lede && <p className="institucional-lede">{lede}</p>}
            </header>
            <article className="institucional-texto">{children}</article>
            <FaleConosco titulo="Ficou alguma dúvida?" />
        </main>
    );
}

export function TrocasDevolucoes() {
    return (
        <Pagina cy="pagina-trocas" sobretitulo="Atendimento" titulo="Trocas e devoluções" lede="Tudo é feito pelo site, em “Meus pedidos”, sem precisar mandar e-mail.">
            <h2>Prazos</h2>
            <ul>
                <li><strong>7 dias</strong> depois da entrega para desistir da compra ou quando o tamanho não serviu.</li>
                <li><strong>90 dias</strong> depois da entrega para peça com defeito ou peça errada.</li>
            </ul>

            <h2>Como pedir</h2>
            <ol>
                <li>Entre em <Link to="/cliente/pedidos">Minha conta &gt; Meus pedidos</Link> e clique em “Devolver peças” no pedido.</li>
                <li>Escolha as peças, a quantidade e o motivo, conte o que aconteceu e mande fotos da peça.</li>
                <li>Analisamos e, se aprovado, você recebe o código de postagem para enviar a peça.</li>
                <li>Quando a peça chega e é conferida, devolvemos o valor das peças devolvidas.</li>
            </ol>
            <p>Você acompanha cada etapa no próprio pedido e também recebe avisos por e-mail.</p>

            <h2>Frete da devolução</h2>
            <ul>
                <li><strong>Defeito ou peça errada:</strong> o frete é por nossa conta.</li>
                <li><strong>Troca de tamanho:</strong> o frete é por conta do cliente. Devolva a peça com o motivo “O tamanho não serviu” e faça um novo pedido no tamanho certo.</li>
                <li><strong>Desistência da compra:</strong> seguimos o direito de arrependimento do Código de Defesa do Consumidor (art. 49).</li>
            </ul>

            <h2>Dica para acertar o tamanho</h2>
            <p>Antes de pedir, confira as medidas em “Ver medidas”, na página de cada produto: ajuda a acertar o tamanho de primeira.</p>
        </Pagina>
    );
}

export function Entrega() {
    return (
        <Pagina cy="pagina-entrega" sobretitulo="Atendimento" titulo="Entrega e prazos" lede="Cada peça é feita sob encomenda: o prazo soma a produção e o transporte.">
            <h2>Produção</h2>
            <p>A produção começa quando o pagamento é confirmado. Pelo Pix a confirmação é na hora; no cartão, assim que o Mercado Pago aprova.</p>

            <h2>Envio e rastreio</h2>
            <p>
                Enviamos para todo o Brasil. Quando a peça sai, você recebe um e-mail e o código de rastreio aparece em{" "}
                <Link to="/cliente/pedidos">Meus pedidos</Link>, com o acompanhamento da entrega dentro do próprio site.
            </p>

            <h2>Nota fiscal</h2>
            <p>
                A nota fiscal eletrônica (NF-e) de cada compra fica em <Link to="/cliente/pedidos">Meus pedidos</Link>: você abre o
                DANFE em PDF, baixa o XML e vê a chave de acesso. Avisamos por e-mail quando ela estiver disponível.
            </p>

            <h2>Pagamento</h2>
            <p>Pix ou cartão de crédito em até {PARCELAS_MAX}x. Em até {PARCELAS_SEM_JUROS}x não há juros; de 3x em diante entram os juros do cartão, mostrados antes de você confirmar.</p>
        </Pagina>
    );
}

export function Privacidade() {
    return (
        <Pagina cy="pagina-privacidade" sobretitulo="Institucional" titulo="Política de privacidade" lede="Como usamos os seus dados, de acordo com a Lei Geral de Proteção de Dados (LGPD).">
            <h2>Quais dados usamos</h2>
            <ul>
                <li><strong>Cadastro:</strong> nome, CPF, e-mail, telefone e senha (guardada de forma protegida, nunca em texto puro).</li>
                <li><strong>Pedido:</strong> endereço de entrega, peças compradas e situação do pagamento.</li>
                <li><strong>Pagamento:</strong> feito no formulário do Mercado Pago. Os dados do cartão não passam pelo nosso servidor.</li>
                <li><strong>Afiliados:</strong> quando você chega por um link de afiliado, guardamos um cookie por 7 dias para saber de quem foi a indicação.</li>
            </ul>

            <h2>Para que usamos</h2>
            <ul>
                <li>Produzir, enviar e entregar o seu pedido, e avisar você de cada etapa por e-mail e no site.</li>
                <li>Atender devoluções e dúvidas.</li>
                <li>Cumprir obrigações legais e fiscais e evitar fraudes.</li>
            </ul>

            <h2>Com quem compartilhamos</h2>
            <p>Só com quem precisa para o pedido acontecer: o Mercado Pago (pagamento), o nosso parceiro de produção (que confecciona e envia a peça) e a transportadora (entrega). Não vendemos os seus dados.</p>

            <h2>Seus direitos</h2>
            <p>Você pode pedir para ver, corrigir ou apagar os seus dados, e saber com quem foram compartilhados. É só escrever para <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. Parte dos dados de pedidos precisa ser guardada pelo prazo que a lei exige.</p>
        </Pagina>
    );
}

export function Sobre() {
    return (
        <Pagina cy="pagina-sobre" sobretitulo="Institucional" titulo="Sobre a Agnus" lede="Vestir o corpo como quem reza.">
            <p>
                A Agnus nasceu do encontro entre o treino e a fé. Cuidar do corpo também é oração: “Não sabeis que o vosso corpo é
                templo do Espírito Santo?” (1 Coríntios 6,19). Fazemos roupas de treino com identidade católica, para quem leva os dois a sério.
            </p>
            <h2>Feita sob encomenda</h2>
            <p>
                Nenhuma peça espera na prateleira. A sua começa a ser feita quando você a escolhe: sem estoque parado, sem desperdício,
                com o cuidado de quem trabalha para a glória de Deus. <em>Ora et labora</em>: reza e trabalha.
            </p>
            <h2>Ecce Agnus Dei</h2>
            <p>
                O nome vem do Cordeiro de Deus, anunciado por João Batista. É ele que está na nossa marca e é para ele que apontamos
                cada peça.
            </p>
            <p><Link className="btn-agnus" to="/catalogo">Ver a coleção</Link></p>
        </Pagina>
    );
}
