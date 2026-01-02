const DEFAULT_CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data:",
  "media-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
].join("; ");

export function applyRuntimeCsp(policy: string = DEFAULT_CSP): void {
  const existing = document.querySelector<HTMLMetaElement>(
    "meta[http-equiv='Content-Security-Policy']"
  );
  if (existing) {
    return;
  }
  const meta = document.createElement("meta");
  meta.setAttribute("http-equiv", "Content-Security-Policy");
  meta.setAttribute("content", policy);
  document.head.appendChild(meta);
}
