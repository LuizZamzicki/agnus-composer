import { useState } from "react";
import "../css/contato.css";

function Contato() {
    const [nome, setNome] = useState("");
    const [email, setEmail] = useState("");
    const [mensagem, setMensagem] = useState("");
    const [envSuccess, setenvSuccess] = useState(false);

    //Criar uma função para lidar com o envio de formulário
    function handleSubmit(event) {
        event.preventDefault();
        console.log("Nome enviado no forms:", nome)
        console.log("Email enviado no forms:", email)
        console.log("Mensagem enviado no forms:", mensagem)

        //Marcando como os campos serão enviados e limpa os campos do formulário
        setenvSuccess(true);
        setNome("");
        setEmail("");
        setMensagem("");
    }

    return (
        <main className="pagina-contato">
            <h1>Fale Conosco</h1>
            <p className="subtitulo">Envie sua Dúvida e Responderemos em Breve</p>
            <form className="form-contato" onSubmit={handleSubmit}>
                <label htmlFor="label-nome">Nome: </label>
                <input id="nome" type="text" placeholder="Digite seu nome completo"
                    value={nome} onChange={(event) => setNome(event.target.value)} ></input>

                <label htmlFor="label-email">Email: </label>
                <input id="email" type="email" placeholder="Digite seu email"
                    value={email} onChange={(event) => setEmail(event.target.value)} ></input>

                <label htmlFor="label-msg">Mensagem: </label>
                <input id="msg" type="textarea" placeholder="Digite sua mensagem"
                    value={mensagem} onChange={(event) => setMensagem(event.target.value)} ></input>

                <button type="submit" className="botao-enviar">Enviar Mensagem</button>
                {envSuccess && <p className="mensagem-sucesso">Mensagem enviada com sucesso!</p>}
                {/*Limpando a mensagem de sucesso/*/}
                {envSuccess && setTimeout(() => setenvSuccess(false), 3000)}

            </form>
        </main>

    )
}

export default Contato;
