import { apiUrl } from "../../utils/api";

function mascararHeaders(headers = {}) {
  const copia = { ...headers };
  if (typeof copia.Authorization === "string") {
    const token = copia.Authorization.replace("Bearer ", "");
    const prefixo = token.slice(0, 10);
    copia.Authorization = `Bearer ${prefixo}...`;
  }
  return copia;
}

function serializarBodyParaLog(body) {
  if (!body) return null;

  if (body instanceof FormData) {
    const dados = {};
    body.forEach((value, key) => {
      if (value instanceof File) {
        const fileInfo = {
          tipo: "File",
          nome: value.name,
          mime: value.type,
          tamanho: value.size,
        };
        if (dados[key]) {
          if (Array.isArray(dados[key])) {
            dados[key].push(fileInfo);
          } else {
            dados[key] = [dados[key], fileInfo];
          }
        } else {
          dados[key] = fileInfo;
        }
      } else {
        dados[key] = value;
      }
    });
    return { tipo: "FormData", dados };
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  return body;
}

export function getAuthHeaders({ json = true } = {}) {
  const token = localStorage.getItem("auth_token");
  const headers = {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return headers;
}

export async function apiFetch(url, options = {}) {
  const finalUrl = apiUrl(url);
  const metodo = options.method || "GET";
  const headers = mascararHeaders(options.headers || {});
  const payload = serializarBodyParaLog(options.body);

  console.groupCollapsed(`[API] ${metodo} ${url}`);
  console.log("Metodo:", metodo);
  console.log("Rota:", url);
  console.log("Headers:", headers);
  console.log("Payload:", payload);
  console.groupEnd();

  const response = await fetch(finalUrl, options);

  if (!response.ok) {
    let respostaErro = null;
    try {
      respostaErro = await response.clone().json();
    } catch {
      try {
        respostaErro = await response.clone().text();
      } catch {
        respostaErro = null;
      }
    }

    console.group(`[API ERRO] ${metodo} ${finalUrl}`);
    console.log("Status:", response.status, response.statusText);
    console.log("Resposta:", respostaErro);
    console.groupEnd();

    if (
      (response.status === 401 || response.status === 403) &&
      window.location.pathname.startsWith("/admin")
    ) {
      localStorage.removeItem("auth");
      localStorage.removeItem("auth_token");
      sessionStorage.setItem(
        "auth_redirect_message",
        "Sessao expirada. Faca login novamente.",
      );
      window.location.assign("/login");
    }
  }

  return response;
}

export function formatarMoeda(valor) {
  if (valor === null || valor === undefined || valor === "-") {
    return "-";
  }
  const numero = Number(valor);
  if (Number.isNaN(numero)) {
    return "-";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numero);
}

export function formatarStatus(status) {
  switch (status) {
    case "aguardando_calculo_frete":
      return "Aguardando calculo do frete";
    case "aguardando_pagamento":
      return "Aguardando pagamento";
    case "pago":
      return "Pago";
    case "enviado":
      return "Enviado";
    case "entregue":
      return "Entregue";
    case "cancelado":
      return "Cancelado";
    default:
      return status ?? "-";
  }
}

export function normalizarProdutoResumo(item) {
  const precoBase = Number(item?.preco_base ?? item?.preco ?? 0);
  const precoCusto = Number(item?.preco_custo ?? item?.custo ?? 0);
  return {
    id: item?.id ?? item?.id_produto ?? Date.now(),
    nome: item?.nome ?? "-",
    categoriaId: item?.id_categoria ?? null,
    preco: Number.isNaN(precoBase) ? 0 : precoBase,
    custo: Number.isNaN(precoCusto) ? 0 : precoCusto,
  };
}
