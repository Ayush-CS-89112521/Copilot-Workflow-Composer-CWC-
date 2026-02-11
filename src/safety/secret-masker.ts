/**
 * Secret Masker Module - Layer 7: Secret Masking
 * 
 * Redacts credentials from step outputs and logs.
 * Enhanced with registry-informed masking for API-specific auth types.
 * 
 * Layer 7: Auth-type-aware masking
 * - Apply tool-specific credential patterns (from MCP registry)
 * - Enrich audit trail with toolId and secretTypes
 * - Support auth types: apiKey, oauth, serviceAccount, none
 * 
 * Masking strategy:
 * 1. If API identity known (from registry) → apply auth-type-specific patterns
 * 2. If auth type known → apply auth-pattern masks (Layer 7)
 * 3. Otherwise → apply generic credential detection
 * 4. Always preserve full output in audit trail with metadata
 */

// ─────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────

export interface SecretRedactionAudit {
  timestamp: string;
  stepId: string;
  secretType: string;                    // 'API_KEY' | 'OAUTH_TOKEN' | etc
  authType?: string | undefined;         // From registry: 'apiKey' | 'oauth'
  apiId?: string | undefined;            // 'stripe', 'github', etc
  domain?: string | undefined;           // API domain
  toolId?: string | undefined;           // Layer 7: Tool ID from registry
  count: number;                         // Number of redactions
  originalLength: number;               // Length before redaction
  redactedLength: number;               // Length after redaction
  compressionRatio: number;             // redactedLength / originalLength
}

export interface MaskingContext {
  stepId: string;
  apiId?: string;                       // API being called (if known)
  authType?: 'none' | 'apiKey' | 'oauth' | 'serviceAccount' | 'other';
  domain?: string;
  toolId?: string;                      // Layer 7: Tool ID from MCP registry
  executionContext?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────
// GENERIC CREDENTIAL PATTERNS
// ─────────────────────────────────────────────────────────────────

const GENERIC_PATTERNS = {
  // AWS credentials
  aws_access_key: /AKIA[0-9A-Z]{16}/g,
  aws_secret_key: /aws_secret_access_key\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi,

  // GitHub tokens
  github_pat: /ghp_[A-Za-z0-9_]{36,255}/g,
  github_oauth: /ghu_[A-Za-z0-9_]{36,255}/g,
  github_app: /ghs_[A-Za-z0-9_]{36,255}/g,
  github_refresh: /ghr_[A-Za-z0-9_]{36,255}/g,

  // Generic Bearer tokens
  bearer_token: /bearer\s+([a-zA-Z0-9._-]{20,})/gi,

  // API keys (generic)
  api_key: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{16,})['"]?/gi,

  // Database URLs with credentials
  db_url: /(?:mongodb|postgres|mysql|sqlite)(?:\+[a-z]+)?:\/\/([^:]+):([^@]+)@/gi,

  // Private keys
  private_key: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi,
  dsa_key: /-----BEGIN\s+DSA\s+PRIVATE\s+KEY-----[\s\S]*?-----END\s+DSA\s+PRIVATE\s+KEY-----/gi,
  ec_key: /-----BEGIN\s+EC\s+PRIVATE\s+KEY-----[\s\S]*?-----END\s+EC\s+PRIVATE\s+KEY-----/gi,

  // OAuth refresh tokens (generic)
  refresh_token: /refresh[_-]?token\s*[:=]\s*['"]?([a-zA-Z0-9._-]{20,})['"]?/gi,
};

// ─────────────────────────────────────────────────────────────────
// API-SPECIFIC MASKING PATTERNS
// ─────────────────────────────────────────────────────────────────

const API_SPECIFIC_PATTERNS: Record<string, { patterns: Array<{ regex: RegExp; type: string }> }> = {
  'stripe': {
    patterns: [
      { regex: /pk_live_[a-zA-Z0-9]{20,}/g, type: 'STRIPE_PUBLISHABLE_KEY' },
      { regex: /sk_live_[a-zA-Z0-9]{20,}/g, type: 'STRIPE_SECRET_KEY' },
      { regex: /rk_live_[a-zA-Z0-9]{20,}/g, type: 'STRIPE_RESTRICTED_KEY' },
      { regex: /X-Stripe-Key:\s*([a-zA-Z0-9_-]+)/gi, type: 'STRIPE_HEADER_KEY' },
    ],
  },
  'github': {
    patterns: [
      { regex: /ghp_[A-Za-z0-9_]{36,255}/g, type: 'GITHUB_PAT' },
      { regex: /ghu_[A-Za-z0-9_]{36,255}/g, type: 'GITHUB_OAUTH' },
      { regex: /ghs_[A-Za-z0-9_]{36,255}/g, type: 'GITHUB_APP_INSTALL' },
      { regex: /Authorization:\s*token\s+([a-zA-Z0-9_-]+)/gi, type: 'GITHUB_TOKEN_HEADER' },
    ],
  },
  'slack': {
    patterns: [
      { regex: /xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,32}/g, type: 'SLACK_BOT_TOKEN' },
      { regex: /xoxp-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,32}/g, type: 'SLACK_USER_TOKEN' },
      { regex: /Authorization:\s*Bearer\s+([a-zA-Z0-9_-]+)/gi, type: 'SLACK_BEARER_TOKEN' },
    ],
  },
  'openai': {
    patterns: [
      { regex: /sk-[a-zA-Z0-9]{20,}/g, type: 'OPENAI_API_KEY' },
      { regex: /Authorization:\s*Bearer\s+([a-zA-Z0-9_-]+)/gi, type: 'OPENAI_BEARER_TOKEN' },
    ],
  },
  'google': {
    patterns: [
      { regex: /AIza[0-9A-Za-z\-_]{35}/g, type: 'GOOGLE_API_KEY' },
      { regex: /ya29\.[a-zA-Z0-9_-]{20,}/g, type: 'GOOGLE_OAUTH_TOKEN' },
      { regex: /"private_key":\s*"([^"]+)"/g, type: 'GOOGLE_SERVICE_ACCOUNT_KEY' },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────
// MASKING FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Mask generic credentials in text
 */
export function maskGenericSecrets(text: string): { masked: string; audits: SecretRedactionAudit[] } {
  let masked = text;
  const audits: SecretRedactionAudit[] = [];

  for (const [secretType, pattern] of Object.entries(GENERIC_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      const redactedType = secretType.replace(/_/g, '_').toUpperCase();
      masked = masked.replace(pattern, `[REDACTED_${redactedType}]`);

      audits.push({
        timestamp: new Date().toISOString(),
        stepId: 'unknown',
        secretType: redactedType,
        count: matches.length,
        originalLength: text.length,
        redactedLength: masked.length,
        compressionRatio: masked.length / text.length,
      });
    }
  }

  return { masked, audits };
}

/**
 * Mask API-specific secrets based on registry knowledge
 */
export function maskApiSecrets(
  text: string,
  apiDomain: string
): { masked: string; audits: SecretRedactionAudit[] } {
  let masked = text;
  const audits: SecretRedactionAudit[] = [];

  // Find matching API domain
  for (const [apiId, config] of Object.entries(API_SPECIFIC_PATTERNS)) {
    if (apiDomain.includes(apiId)) {
      for (const { regex, type } of config.patterns) {
        const matches = text.match(regex);
        if (matches && matches.length > 0) {
          masked = masked.replace(regex, `[REDACTED_${type}]`);

          const audit: SecretRedactionAudit = {
            timestamp: new Date().toISOString(),
            stepId: 'unknown',
            secretType: type,
            apiId,
            domain: apiDomain,
            count: matches.length,
            originalLength: text.length,
            redactedLength: masked.length,
            compressionRatio: masked.length / text.length,
          };
          audits.push(audit);
        }
      }
      break; // Found matching API
    }
  }

  return { masked, audits };
}

/**
 * Mask credentials based on auth type
 * Called when API auth type is known from registry
 * Layer 7: Apply tool-specific patterns
 */
export function maskByAuthType(
  text: string,
  authType: 'none' | 'apiKey' | 'oauth' | 'serviceAccount' | 'other',
  apiDomain?: string,
  toolId?: string  // Layer 7: Tool identifier
): { masked: string; audits: SecretRedactionAudit[] } {
  const audits: SecretRedactionAudit[] = [];
  let masked = text;

  switch (authType) {
    case 'none':
      // No credentials to mask
      return { masked, audits };

    case 'apiKey':
      // API Key pattern (Layer 7 specific)
      {
        const apiKeyPattern = /(?:api[_-]?key|apikey|access[_-]?key)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{16,})['"]?/gi;
        const matches = text.match(apiKeyPattern);
        if (matches && matches.length > 0) {
          masked = masked.replace(apiKeyPattern, '[REDACTED_API_KEY]');
          audits.push({
            timestamp: new Date().toISOString(),
            stepId: 'unknown',
            secretType: 'API_KEY',
            authType: 'apiKey',
            toolId,           // Layer 7
            apiId: apiDomain,
            count: matches.length,
            originalLength: text.length,
            redactedLength: masked.length,
            compressionRatio: masked.length / text.length,
          });
        }
      }
      break;

    case 'oauth':
      // OAuth token pattern (Layer 7 specific)
      {
        const oauthPattern = /(?:oauth|access[_-]?token|bearer)\s*[:=]\s*['"]?([a-zA-Z0-9._-]{20,})['"]?/gi;
        const matches = text.match(oauthPattern);
        if (matches && matches.length > 0) {
          masked = masked.replace(oauthPattern, '[REDACTED_OAUTH_TOKEN]');
          audits.push({
            timestamp: new Date().toISOString(),
            stepId: 'unknown',
            secretType: 'OAUTH_TOKEN',
            authType: 'oauth',
            toolId,           // Layer 7
            apiId: apiDomain,
            count: matches.length,
            originalLength: text.length,
            redactedLength: masked.length,
            compressionRatio: masked.length / text.length,
          });
        }
      }
      break;

    case 'serviceAccount':
      // Service account pattern (Layer 7 specific)
      {
        const serviceAccountPattern = /(?:service[_-]?account|sa[_-]?key|private[_-]?key)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi;
        const keyPattern = /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi;
        
        const matches1 = text.match(serviceAccountPattern) || [];
        const matches2 = text.match(keyPattern) || [];
        const totalMatches = matches1.length + matches2.length;

        if (totalMatches > 0) {
          masked = masked.replace(serviceAccountPattern, '[REDACTED_SERVICE_ACCOUNT]');
          masked = masked.replace(keyPattern, '[REDACTED_PRIVATE_KEY]');
          
          audits.push({
            timestamp: new Date().toISOString(),
            stepId: 'unknown',
            secretType: 'SERVICE_ACCOUNT',
            authType: 'serviceAccount',
            toolId,           // Layer 7
            apiId: apiDomain,
            count: totalMatches,
            originalLength: text.length,
            redactedLength: masked.length,
            compressionRatio: masked.length / text.length,
          });
        }
      }
      break;

    default:
      // Generic masking for unknown auth types
      const genericResult = maskGenericSecrets(text);
      // Add toolId to audits (Layer 7)
      for (const audit of genericResult.audits) {
        audit.toolId = toolId;
      }
      return genericResult;
  }

  return { masked, audits };
}

/**
 * Main masking function - orchestrates all masking strategies
 * 
 * Priority:
 * 1. If API known (registry) + auth type → use auth-type-specific masking
 * 2. If API known (registry) + domain → use API-specific masking
 * 3. Otherwise → use generic masking
 */
export function maskSecrets(
  text: string,
  context: MaskingContext
): { masked: string; audits: SecretRedactionAudit[] } {
  let masked = text;
  const allAudits: SecretRedactionAudit[] = [];

  // Strategy 1: Auth-type-aware masking (if auth type known)
  if (context.authType) {
    const { masked: authMasked, audits } = maskByAuthType(text, context.authType, context.domain);
    masked = authMasked;
    allAudits.push(...audits.map(a => ({ ...a, stepId: context.stepId })));
    return { masked, audits: allAudits };
  }

  // Strategy 2: API-specific masking (if domain known)
  if (context.domain) {
    const { masked: apiMasked, audits } = maskApiSecrets(text, context.domain);
    masked = apiMasked;
    allAudits.push(...audits.map(a => {
      const audit: SecretRedactionAudit = { ...a, stepId: context.stepId };
      if (context.apiId) audit.apiId = context.apiId;
      return audit;
    }));
    
    // Fall through to generic masking for patterns not covered by API-specific patterns
    if (masked.length === text.length) {
      const { masked: genericMasked, audits: genericAudits } = maskGenericSecrets(masked);
      masked = genericMasked;
      allAudits.push(...genericAudits.map(a => ({ ...a, stepId: context.stepId })));
    }
    return { masked, audits: allAudits };
  }

  // Strategy 3: Generic masking (fallback)
  const { masked: genericMasked, audits } = maskGenericSecrets(text);
  masked = genericMasked;
  allAudits.push(...audits.map(a => ({ ...a, stepId: context.stepId })));

  return { masked, audits: allAudits };
}

/**
 * Format audit entry for display
 */
export function formatMaskingAudit(audit: SecretRedactionAudit): string {
  return `${audit.timestamp} | Step: ${audit.stepId} | Type: ${audit.secretType} | Count: ${audit.count} | Ratio: ${(audit.compressionRatio * 100).toFixed(1)}%`;
}

/**
 * Generate masking report
 */
export function generateMaskingReport(audits: SecretRedactionAudit[]): string {
  if (audits.length === 0) {
    return 'No secrets masked.';
  }

  let report = `🔐 Secret Masking Report (${audits.length} entries)\n`;
  report += '─'.repeat(60) + '\n';

  // Group by step
  const byStep = new Map<string, SecretRedactionAudit[]>();
  audits.forEach(a => {
    if (!byStep.has(a.stepId)) byStep.set(a.stepId, []);
    byStep.get(a.stepId)!.push(a);
  });

  for (const [stepId, entries] of byStep.entries()) {
    report += `\nStep: ${stepId}\n`;
    entries.forEach(entry => {
      report += `  • ${entry.secretType}`;
      if (entry.apiId) report += ` (${entry.apiId})`;
      report += `: ${entry.count}x redacted\n`;
    });
  }

  // Summary statistics
  const totalRedactions = audits.reduce((sum, a) => sum + a.count, 0);
  const avgCompressionRatio =
    audits.reduce((sum, a) => sum + a.compressionRatio, 0) / audits.length;

  report += '\n' + '─'.repeat(60) + '\n';
  report += `Total Redactions: ${totalRedactions}\n`;
  report += `Avg Compression: ${(avgCompressionRatio * 100).toFixed(1)}%\n`;

  return report;
}
