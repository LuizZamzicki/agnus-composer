import { useEffect, useState } from "react";
import { apiUrl, authHeaders } from "../utils/api";

const LADO_MAXIMO = 1600;

// Reduz a foto no navegador antes de enviar: foto de celular (8 MB, 4000 px) vira um JPEG de
// ~300 KB que continua nítido para avaliar um defeito. Também apaga os metadados (localização).
export function reduzirImagem(arquivo) {
    return new Promise((resolve, reject) => {
        if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(arquivo.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(arquivo.name)) {
            reject(new Error("Escolha uma foto (JPG, PNG ou WEBP)."));
            return;
        }

        const url = URL.createObjectURL(arquivo);
        const img = new Image();
        img.onload = () => {
            const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * escala);
            canvas.height = Math.round(img.height * escala);
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Não foi possível ler esta foto. Tente outra."));
        };
        img.src = url;
    });
}

// Foto que exige login (ex.: fotos da devolução): baixa com o token e mostra por um endereço local.
export default function FotoProtegida({ url, alt = "", className = "" }) {
    const [src, setSrc] = useState(null);
    const [erro, setErro] = useState(false);

    useEffect(() => {
        let ativo = true;
        let local = null;

        fetch(apiUrl(url), { headers: authHeaders() })
            .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
            .then((blob) => {
                local = URL.createObjectURL(blob);
                if (ativo) setSrc(local);
            })
            .catch(() => ativo && setErro(true));

        return () => {
            ativo = false;
            if (local) URL.revokeObjectURL(local);
        };
    }, [url]);

    if (erro) return <span className={`${className} foto-indisponivel`} role="img" aria-label="Foto indisponível" />;
    if (!src) return <span className={`${className} foto-carregando`} aria-hidden="true" />;

    return (
        <a href={src} target="_blank" rel="noreferrer" title="Abrir a foto">
            <img src={src} alt={alt} className={className} />
        </a>
    );
}
