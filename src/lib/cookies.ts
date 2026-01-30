export function normalizeCookieInput(value: string) {
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith("cookie:")) {
    return trimmed.slice("cookie:".length).trim();
  }
  return trimmed;
}

export function validateCookieInput(value: string) {
  if (!value) {
    return "Cookie value is empty.";
  }
  if (value.includes("\n") || value.includes("\r")) {
    return "Cookie value should be a single header line without newlines.";
  }
  const parts = value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return 'Cookie value should look like "name=value" pairs from the Cookie header.';
  }
  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex <= 0 || eqIndex === part.length - 1) {
      return 'Cookie value should look like "name=value" pairs from the Cookie header.';
    }
  }
  return null;
}
