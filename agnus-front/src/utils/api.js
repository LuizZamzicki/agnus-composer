const rawApiBase = process.env.REACT_APP_API_BASE_URL || "";

export const API_BASE_URL = rawApiBase.replace(/\/+$/, "");

function isAbsoluteUrl(value) {
  return /^(?:https?:|data:|blob:)/i.test(value);
}

export function apiUrl(path = "") {
  const value = String(path || "");

  if (isAbsoluteUrl(value)) {
    return value;
  }

  const normalizedPath = value.startsWith("/") ? value : `/${value}`;

  if (!API_BASE_URL) {
    return normalizedPath;
  }

  if (normalizedPath === API_BASE_URL || normalizedPath.startsWith(`${API_BASE_URL}/`)) {
    return normalizedPath;
  }

  return `${API_BASE_URL}${normalizedPath}`;
}

export function assetUrl(path = "") {
  if (typeof path !== "string") {
    return "";
  }

  const value = path.trim();
  return value ? apiUrl(value) : "";
}
