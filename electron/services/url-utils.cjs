const COMMON_TLDS = new Set([
  "ai",
  "app",
  "biz",
  "cc",
  "cn",
  "co",
  "com",
  "dev",
  "edu",
  "gov",
  "io",
  "net",
  "org",
  "site",
  "top",
  "xyz"
]);

const HTTP_URL_PATTERN = /https?:\/\/[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+/gi;
const BARE_DOMAIN_PATTERN = /\b(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\:\d{2,5})?(?:\/[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]*)?/gi;

function cleanUrlCandidate(value) {
  return String(value || "")
    .trim()
    .replace(/^["'`([{（【]+/, "")
    .replace(/["'`，。；;、!！?？)\]】）]+$/g, "");
}

function isLikelyDomain(candidate) {
  const host = String(candidate || "").replace(/^https?:\/\//i, "").split(/[/?#]/)[0].split(":")[0].toLowerCase();
  const labels = host.split(".");
  const tld = labels[labels.length - 1];
  return host.startsWith("www.") || COMMON_TLDS.has(tld);
}

function normalizeFetchUrl(url) {
  const cleaned = cleanUrlCandidate(url);
  const withProtocol = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  const parsed = new URL(withProtocol);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`只支持 http/https URL：${url}`);
  }
  if (!isLikelyDomain(parsed.hostname)) {
    throw new Error(`不是可识别的外部域名：${url}`);
  }
  return parsed.toString();
}

function extractExternalUrlsFromText(text) {
  const source = String(text || "");
  const candidates = [];

  for (const match of source.matchAll(HTTP_URL_PATTERN)) {
    candidates.push(match[0]);
  }

  for (const match of source.matchAll(BARE_DOMAIN_PATTERN)) {
    const value = match[0];
    if (!/^https?:\/\//i.test(value) && isLikelyDomain(value)) {
      candidates.push(value);
    }
  }

  const normalized = [];
  for (const candidate of candidates) {
    try {
      normalized.push(normalizeFetchUrl(candidate));
    } catch {
      // Ignore text that looks URL-like but cannot be safely normalized.
    }
  }

  return [...new Set(normalized)];
}

function stripExternalUrlsFromText(text) {
  return String(text || "")
    .replace(HTTP_URL_PATTERN, " ")
    .replace(BARE_DOMAIN_PATTERN, (match) => isLikelyDomain(match) ? " " : match);
}

module.exports = {
  cleanUrlCandidate,
  extractExternalUrlsFromText,
  normalizeFetchUrl,
  stripExternalUrlsFromText
};
