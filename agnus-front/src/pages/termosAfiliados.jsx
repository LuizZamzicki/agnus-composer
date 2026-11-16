import { Link } from "react-router-dom";
import "../css/cliente/afiliados.css";

// Rascunho dos termos do programa de afiliados. Reflete as regras que o sistema aplica
// (janela de 7 dias, último clique, comissão sobre as peças, aprovação após o prazo de
// arrependimento, pagamento por PIX). Revisar com a equipe/jurídico antes de publicar.
export default function TermosAfiliados() {
    return (
        <main className="termos-afiliados">
            <article className="afi">
                <h1>Termos do Programa de Afiliados Agnus</h1>
                <p className="afi-ajuda">Versão de 14/11/2026.</p>

                <h2>1. O programa</h2>
                <p>
                    O afiliado divulga produtos da Agnus com links próprios e recebe comissão sobre as compras feitas a partir deles.
                    A participação é gratuita e depende de aprovação da Agnus, que pode recusar ou encerrar cadastros a qualquer momento.
                </p>

                <h2>2. Como a venda é atribuída</h2>
                <ul>
                    <li>Cada clique em um link de afiliado vale por <strong>7 dias</strong>.</li>
                    <li>Se a pessoa clicar em links de afiliados diferentes, a venda é de quem teve o <strong>último clique</strong>.</li>
                    <li>Compras feitas pelo próprio afiliado não geram comissão.</li>
                    <li>A atribuição depende do navegador do comprador guardar o cookie do clique; bloqueadores e navegação anônima podem impedir o registro.</li>
                </ul>

                <h2>3. Comissão</h2>
                <ul>
                    <li>A comissão é um percentual sobre o valor das peças, <strong>sem o frete</strong>, e aparece no painel antes de você divulgar.</li>
                    <li>A taxa pode variar por produto ou categoria, e a Agnus pode alterá-la; a mudança vale para compras feitas depois dela.</li>
                    <li>
                        A comissão fica <strong>pendente</strong> até o pedido ser entregue e passar o prazo de arrependimento de 7 dias
                        (Código de Defesa do Consumidor, art. 49). Depois disso, é <strong>aprovada</strong>.
                    </li>
                    <li>Pedidos cancelados não geram comissão. Peças devolvidas e reembolsadas têm a comissão descontada.</li>
                </ul>

                <h2>4. Pagamento</h2>
                <ul>
                    <li>As comissões aprovadas são pagas por <strong>PIX</strong>, na chave cadastrada no painel.</li>
                    <li>Você acompanha cada pagamento recebido no painel.</li>
                    <li>O afiliado é responsável pelos tributos sobre os valores recebidos.</li>
                </ul>

                <h2>5. Divulgação permitida</h2>
                <ul>
                    <li>Não é permitido spam, compra de palavras-chave com a marca Agnus, anúncios que se passem pela loja oficial ou promessas de preço e prazo que a loja não oferece.</li>
                    <li>Não é permitido gerar cliques ou compras artificiais. Fraude leva à suspensão e ao cancelamento das comissões envolvidas.</li>
                    <li>Use a marca e as imagens da Agnus apenas para divulgar os produtos.</li>
                </ul>

                <h2>6. Dados pessoais</h2>
                <p>
                    Registramos cada clique (data, navegador e um código irreversível do endereço IP, nunca o IP em si) para atribuir as vendas e evitar fraude.
                    O afiliado não recebe dados pessoais dos compradores, apenas os produtos e valores de cada venda.
                </p>

                <h2>7. Encerramento</h2>
                <p>
                    Qualquer das partes pode encerrar a participação. Comissões já aprovadas antes do encerramento são pagas, salvo em caso de fraude.
                    Dúvidas: <a href="mailto:contato@agnusfit.com">contato@agnusfit.com</a>.
                </p>

                <p><Link to="/cliente/afiliados" className="btn-agnus">Voltar para o programa</Link></p>
            </article>
        </main>
    );
}
