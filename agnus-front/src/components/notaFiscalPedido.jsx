import { useState } from "react";
import { Copy, Download, ExternalLink, FileText } from "lucide-react";
import { apiUrl, authHeaders } from "../utils/api";
import { formatarReal } from "../utils/sacola";

// Portal da NF-e (Receita): o cliente cola a chave de acesso para conferir a nota.
export const PORTAL_NFE = "https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&tipoConteudo=7PhJ+gAVw2g=";

const dataCurta = (valor) => (valor ? new Date(valor).toLocaleDateString("pt-BR") : null);

// Os arquivos exigem login (token no cabeçalho), então vêm por fetch e abrem como blob.
async function baixarArquivo(idPedido, tipo) {
    const res = await fetch(apiUrl(`orders/${idPedido}/nota-fiscal/${tipo}`), { headers: authHeaders() });
    if (!res.ok) throw new Error("Não foi possível abrir a nota agora. Tente de novo.");
    const nome = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") || "")?.[1] || `NF-e-pedido-${idPedido}.${tipo}`;
    return { blob: await res.blob(), nome };
}

export default function NotaFiscalPedido({ idPedido, nota }) {
    const [erro, setErro] = useState("");
    const [copiada, setCopiada] = useState(false);
    const [abrindo, setAbrindo] = useState(null);

    async function abrir(tipo) {
        setErro("");
        setAbrindo(tipo);
        // PDF: abre numa aba nova (aberta já no clique, para o navegador não bloquear).
        const aba = tipo === "pdf" ? window.open("", "_blank") : null;
        try {
            const { blob, nome } = await baixarArquivo(idPedido, tipo);
            const url = URL.createObjectURL(blob);
            if (aba) {
                aba.location.href = url;
            } else {
                const link = document.createElement("a");
                link.href = url;
                link.download = nome;
                document.body.appendChild(link);
                link.click();
                link.remove();
            }
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (e) {
            aba?.close();
            setErro(e.message);
        } finally {
            setAbrindo(null);
        }
    }

    async function copiarChave() {
        try {
            await navigator.clipboard.writeText(nota.chave);
            setCopiada(true);
            setTimeout(() => setCopiada(false), 2500);
        } catch {
            setErro("Não foi possível copiar. Selecione a chave e copie.");
        }
    }

    const detalhes = [
        nota.numero && `Nº ${nota.numero}${nota.serie ? ` · série ${nota.serie}` : ""}`,
        dataCurta(nota.data_emissao) && `emitida em ${dataCurta(nota.data_emissao)}`,
        nota.valor != null && formatarReal(nota.valor),
    ].filter(Boolean);

    return (
        <section className="nota-fiscal" data-cy="nota-fiscal" aria-label={`Nota fiscal do pedido ${idPedido}`}>
            <h3>
                <FileText size={18} strokeWidth={1.5} aria-hidden="true" /> Nota fiscal eletrônica (NF-e)
            </h3>
            {detalhes.length > 0 && <p className="nota-fiscal-detalhes">{detalhes.join(" · ")}</p>}

            <div className="nota-fiscal-chave">
                <span>Chave de acesso</span>
                <code data-cy="nota-fiscal-chave">{nota.chave_formatada || nota.chave}</code>
                <button type="button" onClick={copiarChave} data-cy="nota-fiscal-copiar">
                    <Copy size={15} strokeWidth={1.5} aria-hidden="true" /> {copiada ? "Copiada" : "Copiar"}
                </button>
            </div>

            <div className="nota-fiscal-acoes">
                {nota.tem_pdf && (
                    <button type="button" className="btn-agnus" data-cy="nota-fiscal-pdf" onClick={() => abrir("pdf")} disabled={abrindo === "pdf"}>
                        <FileText size={16} strokeWidth={1.5} aria-hidden="true" /> {abrindo === "pdf" ? "Abrindo…" : "Ver nota (PDF)"}
                    </button>
                )}
                {nota.tem_xml && (
                    <button type="button" className="btn-agnus-ghost" data-cy="nota-fiscal-xml" onClick={() => abrir("xml")} disabled={abrindo === "xml"}>
                        <Download size={16} strokeWidth={1.5} aria-hidden="true" /> {abrindo === "xml" ? "Baixando…" : "Baixar XML"}
                    </button>
                )}
                <a className="nota-fiscal-portal" href={PORTAL_NFE} target="_blank" rel="noreferrer">
                    Consultar na Receita <ExternalLink size={14} strokeWidth={1.5} aria-hidden="true" />
                </a>
            </div>

            {erro && <p className="nota-fiscal-erro" role="alert">{erro}</p>}
        </section>
    );
}
