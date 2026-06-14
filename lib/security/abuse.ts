// Known scanner / attack-tool user-agent patterns
const BOT_UA_PATTERNS = [
  /sqlmap/i, /nikto/i, /nessus/i, /masscan/i, /dirbuster/i,
  /nmap/i, /hydra/i, /burpsuite/i, /havij/i, /acunetix/i,
  /appscan/i, /w3af/i, /zap/i, /skipfish/i, /metasploit/i,
];

// Paths that legitimate users never access on a Next.js app
const PROBE_PATHS = [
  "/wp-admin", "/wp-login.php", "/phpmyadmin", "/.env",
  "/config.php", "/admin.php", "/shell.php", "/.git",
  "/xmlrpc.php", "/cgi-bin", "/.htaccess", "/web.config",
  "/etc/passwd", "/proc/self",
];

export interface AbuseCheckResult {
  isSuspicious: boolean;
  reason?:      string;
  severity:     "low" | "medium" | "high";
}

export function checkRequestAbuse(
  pathname: string,
  userAgent: string,
  queryLength: number,
): AbuseCheckResult {
  // Scanner tool in user-agent
  for (const pattern of BOT_UA_PATTERNS) {
    if (pattern.test(userAgent)) {
      return { isSuspicious: true, reason: "scanner_ua",         severity: "high" };
    }
  }

  // Probing known sensitive paths
  if (PROBE_PATHS.some(p => pathname.toLowerCase().startsWith(p))) {
    return { isSuspicious: true, reason: "probe_path",           severity: "medium" };
  }

  // Oversized query string (potential injection attempt)
  if (queryLength > 3000) {
    return { isSuspicious: true, reason: "oversized_query",      severity: "medium" };
  }

  // Path traversal attempt
  if (pathname.includes("../") || pathname.includes("..%2F") || pathname.includes("%2e%2e")) {
    return { isSuspicious: true, reason: "path_traversal",       severity: "high" };
  }

  // Null-byte injection
  if (pathname.includes("\0") || pathname.includes("%00")) {
    return { isSuspicious: true, reason: "null_byte_injection",  severity: "high" };
  }

  return { isSuspicious: false, severity: "low" };
}

// Detect if a request body looks like an injection attempt
export function hasSqlInjectionPattern(value: string): boolean {
  const SQL_PATTERNS = [
    /(\bunion\b.*\bselect\b)/i,
    /(\bselect\b.*\bfrom\b.*\bwhere\b)/i,
    /(\bdrop\b.*\btable\b)/i,
    /(\bexec\b|\bexecute\b).*\(/i,
    /--\s*$/m,
    /;\s*(drop|delete|truncate|insert|update)\b/i,
  ];
  return SQL_PATTERNS.some(p => p.test(value));
}
