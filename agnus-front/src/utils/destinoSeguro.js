// Aceita só caminhos deste site. Comparar o texto não basta: o navegador lê "/\\host" como outro domínio.
export function destinoSeguro(valor) {
  if (!valor || !valor.startsWith("/")) {
    return null;
  }

  try {
    const url = new URL(valor, window.location.origin);
    return url.origin === window.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : null;
  } catch {
    return null;
  }
}
