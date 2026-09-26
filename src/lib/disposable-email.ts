import disposableDomains from "disposable-email-domains";

const DISPOSABLE_DOMAINS = new Set(disposableDomains);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? DISPOSABLE_DOMAINS.has(domain) : true;
}
