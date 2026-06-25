import { useState, useEffect } from "react";
import "../../css/cliente/contato.css";

function Contato() {
    const [nome, setNome] = useState("");
    const [email, setEmail] = useState("");
    const [mensagem, setMensagem] = useState("");
    const [envSuccess, setEnvSuccess] = useState(false);

    function handleSubmit(event) {
        event.preventDefault();

        console.log("Nome:", nome);
        console.log("Email:", email);
        console.log("Mensagem:", mensagem);

        setEnvSuccess(true);
        setNome("");
        setEmail("");
        setMensagem("");
    }

    useEffect(() => {
        if (envSuccess) {
            const timer = setTimeout(() => {
                setEnvSuccess(false);
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [envSuccess]);

    return (
        <main className="pagina-contato">
            <h1>Fale Conosco</h1>
            <p className="subtitulo">
                Envie sua dúvida e responderemos em breve
            </p>

            <form className="form-contato" onSubmit={handleSubmit}>
                <label>Nome:</label>
                <input
                    data-cy="nome-contato"
                    type="text"
                    placeholder="Digite seu nome completo"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                />

                <label>Email:</label>
                <input
                    data-cy="email-contato"
                    type="email"
                    placeholder="Digite seu email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />

                <label>Mensagem:</label>
                <textarea
                    data-cy="mensagem-contato"
                    placeholder="Digite sua mensagem"
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                />

                <button data-cy="enviar-contato" type="submit" className="botao-enviar">
                    Enviar Mensagem
                </button>

                {envSuccess && (
                    <p data-cy="mensagem-sucesso" className="mensagem-sucesso">
                        Mensagem enviada com sucesso!
                    </p>
                )}
            </form>
        </main>
    );
}

export default Contato;