import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { apiUrl, assetUrl } from "../utils/api";
import "../css/cliente/vitrineHome.css";

const INTERVALO_MS = 7000;

// Foto grande de campanha, de ponta a ponta da tela. Os banners vêm do admin (Vitrine); com mais
// de um, vira um carrossel que troca sozinho (pausa com o mouse em cima e para quem prefere menos movimento).
export default function BannerCampanha() {
    const [banners, setBanners] = useState([]);
    const [atual, setAtual] = useState(0);
    const [pausado, setPausado] = useState(false);
    const reduzir = useRef(false);

    useEffect(() => {
        reduzir.current = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
        let ativo = true;
        fetch(apiUrl("vitrine/banners"))
            .then((r) => (r.ok ? r.json() : { data: [] }))
            .then((j) => ativo && setBanners(Array.isArray(j.data) ? j.data : []))
            .catch(() => ativo && setBanners([]));
        return () => {
            ativo = false;
        };
    }, []);

    const ir = useCallback((i) => setAtual((i + banners.length) % banners.length), [banners.length]);

    useEffect(() => {
        if (banners.length < 2 || pausado || reduzir.current) return undefined;
        const id = setInterval(() => setAtual((i) => (i + 1) % banners.length), INTERVALO_MS);
        return () => clearInterval(id);
    }, [banners.length, pausado]);

    if (!banners.length) return null;

    return (
        <section
            className="banner-campanha"
            data-cy="banner-campanha"
            aria-roledescription={banners.length > 1 ? "carrossel" : undefined}
            aria-label="Campanhas"
            onMouseEnter={() => setPausado(true)}
            onMouseLeave={() => setPausado(false)}
            onFocus={() => setPausado(true)}
            onBlur={() => setPausado(false)}
        >
            {banners.map((b, i) => (
                <article
                    key={b.id_banner}
                    className={`banner-slide banner-slide--${b.alinhamento} ${i === atual ? "is-atual" : ""}`}
                    aria-hidden={i !== atual}
                    aria-roledescription={banners.length > 1 ? "slide" : undefined}
                    aria-label={banners.length > 1 ? `${i + 1} de ${banners.length}` : undefined}
                    data-cy="banner-slide"
                >
                    <picture>
                        {b.imagem_mobile_url && <source media="(max-width: 720px)" srcSet={assetUrl(b.imagem_mobile_url)} />}
                        <img
                            src={assetUrl(b.imagem_url)}
                            alt=""
                            style={{ objectPosition: `center ${b.foco === "topo" ? "20%" : b.foco === "base" ? "80%" : "50%"}` }}
                            loading={i === 0 ? "eager" : "lazy"}
                        />
                    </picture>
                    <div className="banner-texto">
                        {b.sobretitulo && <p className="banner-sobretitulo">{b.sobretitulo}</p>}
                        <h2>{b.titulo}</h2>
                        {b.subtitulo && <p className="banner-subtitulo">{b.subtitulo}</p>}
                        {b.texto_botao && b.link && (
                            <Link className="banner-botao" to={b.link} tabIndex={i === atual ? 0 : -1} data-cy="banner-botao">
                                {b.texto_botao}
                            </Link>
                        )}
                    </div>
                </article>
            ))}

            {banners.length > 1 && (
                <>
                    <button type="button" className="banner-seta banner-seta--anterior" aria-label="Banner anterior" onClick={() => ir(atual - 1)}>
                        <ChevronLeft size={22} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                    <button type="button" className="banner-seta banner-seta--proxima" aria-label="Próximo banner" onClick={() => ir(atual + 1)}>
                        <ChevronRight size={22} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                    <div className="banner-pontos">
                        {banners.map((b, i) => (
                            <button
                                key={b.id_banner}
                                type="button"
                                className={i === atual ? "is-atual" : ""}
                                aria-label={`Ir para o banner ${i + 1}`}
                                aria-current={i === atual}
                                onClick={() => ir(i)}
                            />
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}
