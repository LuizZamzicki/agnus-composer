import { useEffect } from "react";

const MARCA = "Agnus";

// Título da aba (e de quem salva/compartilha o link): "Peça · Agnus". Sem título, fica só a marca.
export function useTituloPagina(titulo) {
    useEffect(() => {
        document.title = titulo ? `${titulo} · ${MARCA}` : `${MARCA} · Roupas de treino com identidade católica`;
    }, [titulo]);
}
