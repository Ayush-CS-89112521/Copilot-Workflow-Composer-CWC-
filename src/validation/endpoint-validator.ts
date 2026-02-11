/**
 * Endpoint Validator Module
 * 
 * Validates API endpoints for correctness, reachability, and safety.
 * Ports Python validation logic from public-apis/scripts/format.py and links.py
 * 
 * Features:
 * - Format validation (regex patterns, field constraints)
 * - Link validation (HTTP checks, Cloudflare detection)
 * - Endpoint testing (optional, for custom APIs)
 * - Audit trail with validation results
 */

// ─────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────

export interface FormatError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface FormatValidationResult {
  valid: boolean;
  errors: FormatError[];
  warnings: FormatError[];
}

export interface LinkValidationResult {
  url: string;
  status: 'working' | 'cloudflare_protected' | 'dead' | 'timeout' | 'unknown';
  statusCode?: number | undefined;
  responseTime?: number | undefined;
  redirectUrl?: string | undefined;
  cloudflareIndicators?: string[] | undefined;
  error?: string | undefined;
}

export interface EndpointTestResult {
  endpoint: string;
  method: string;
  status: 'valid' | 'auth_required' | 'not_found' | 'server_error' | 'unknown';
  responseTime?: number | undefined;
  statusCode?: number | undefined;
  sampleResponse?: unknown;
  error?: string | undefined;
}

export interface ApiValidationAudit {
  apiName: string;
  timestamp: string;
  formatResult: FormatValidationResult;
  linkResult?: LinkValidationResult | undefined;
  endpointResults?: EndpointTestResult[] | undefined;
  overallValid: boolean;
}

// ─────────────────────────────────────────────────────────────────
// FORMAT VALIDATION (Ported from format.py)
// ─────────────────────────────────────────────────────────────────

const VALIDATION_RULES = {
  // URL validation
  URL_PATTERN: /^https?:\/\/.+\..+$/,
  MARKDOWN_LINK_PATTERN: /^\[(.+?)\]\((https?:\/\/.+?)\)$/,

  // Auth field validation (must be one of these)
  VALID_AUTH_TYPES: new Set([
    'no',
    'apikey',
    'oauth',
    'x-mashape-key',
    'user-agent',
  ]),

  // HTTPS field validation
  VALID_HTTPS_VALUES: new Set(['yes', 'no']),

  // CORS field validation
  VALID_CORS_VALUES: new Set(['yes', 'no', 'unknown']),

  // Description constraints
  MIN_DESCRIPTION_LENGTH: 10,
  MAX_DESCRIPTION_LENGTH: 100,
};

/**
 * Validate API name format
 */
function validateName(name: string | undefined): FormatError | null {
  if (!name || name.trim().length === 0) {
    return { field: 'name', message: 'API name is required', severity: 'error' };
  }

  if (name.endsWith(' API')) {
    return {
      field: 'name',
      message: 'API name should not end with " API" (redundant)',
      severity: 'warning',
    };
  }

  return null;
}

/**
 * Validate URL format and structure
 */
function validateUrl(url: string | undefined): FormatError | null {
  if (!url || url.trim().length === 0) {
    return { field: 'url', message: 'URL is required', severity: 'error' };
  }

  if (!VALIDATION_RULES.URL_PATTERN.test(url)) {
    return {
      field: 'url',
      message: 'URL must be valid HTTP(S) with TLD (e.g., https://example.com)',
      severity: 'error',
    };
  }

  return null;
}

/**
 * Validate description
 */
function validateDescription(desc: string | undefined): FormatError | null {
  if (!desc || desc.trim().length === 0) {
    return { field: 'description', message: 'Description is required', severity: 'error' };
  }

  if (desc.length < VALIDATION_RULES.MIN_DESCRIPTION_LENGTH) {
    return {
      field: 'description',
      message: `Description too short (min ${VALIDATION_RULES.MIN_DESCRIPTION_LENGTH} chars)`,
      severity: 'warning',
    };
  }

  if (desc.length > VALIDATION_RULES.MAX_DESCRIPTION_LENGTH) {
    return {
      field: 'description',
      message: `Description too long (max ${VALIDATION_RULES.MAX_DESCRIPTION_LENGTH} chars, got ${desc.length})`,
      severity: 'error',
    };
  }

  if (!desc[0].match(/[A-Z]/)) {
    return {
      field: 'description',
      message: 'Description must start with capital letter',
      severity: 'warning',
    };
  }

  return null;
}

/**
 * Validate auth field
 */
function validateAuth(auth: string | undefined): FormatError | null {
  if (!auth || auth.trim().length === 0) {
    return { field: 'auth', message: 'Auth type is required', severity: 'error' };
  }

  const normalized = auth.toLowerCase().replace(/`/g, '').trim();

  if (!VALIDATION_RULES.VALID_AUTH_TYPES.has(normalized)) {
    return {
      field: 'auth',
      message: `Invalid auth type "${auth}". Must be one of: No, apiKey, OAuth, X-Mashape-Key, User-Agent`,
      severity: 'error',
    };
  }

  return null;
}

/**
 * Validate HTTPS field
 */
function validateHttps(https: string | undefined): FormatError | null {
  if (!https || https.trim().length === 0) {
    return { field: 'https', message: 'HTTPS field is required', severity: 'error' };
  }

  const normalized = https.toLowerCase();

  if (!VALIDATION_RULES.VALID_HTTPS_VALUES.has(normalized)) {
    return {
      field: 'https',
      message: `HTTPS must be "Yes" or "No", got "${https}"`,
      severity: 'error',
    };
  }

  return null;
}

/**
 * Validate CORS field
 */
function validateCors(cors: string | undefined): FormatError | null {
  if (!cors || cors.trim().length === 0) {
    return { field: 'cors', message: 'CORS field is required', severity: 'error' };
  }

  const normalized = cors.toLowerCase();

  if (!VALIDATION_RULES.VALID_CORS_VALUES.has(normalized)) {
    return {
      field: 'cors',
      message: `CORS must be "Yes", "No", or "Unknown", got "${cors}"`,
      severity: 'error',
    };
  }

  return null;
}

/**
 * Comprehensive format validation (Ported from format.py)
 */
export function validateFormat(
  name: string | undefined,
  url: string | undefined,
  description: string | undefined,
  auth: string | undefined,
  https: string | undefined,
  cors: string | undefined
): FormatValidationResult {
  const errors: FormatError[] = [];
  const warnings: FormatError[] = [];

  // Validate each field
  const nameErr = validateName(name);
  if (nameErr) {
    if (nameErr.severity === 'error') errors.push(nameErr);
    else warnings.push(nameErr);
  }

  const urlErr = validateUrl(url);
  if (urlErr) errors.push(urlErr);

  const descErr = validateDescription(description);
  if (descErr) {
    if (descErr.severity === 'error') errors.push(descErr);
    else warnings.push(descErr);
  }

  const authErr = validateAuth(auth);
  if (authErr) errors.push(authErr);

  const httpsErr = validateHttps(https);
  if (httpsErr) errors.push(httpsErr);

  const corsErr = validateCors(cors);
  if (corsErr) {
    if (corsErr.severity === 'error') errors.push(corsErr);
    else warnings.push(corsErr);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────
// LINK VALIDATION (Ported from links.py)
// ─────────────────────────────────────────────────────────────────

const CLOUDFLARE_INDICATORS = [
  '403 Forbidden',
  'cloudflare',
  'Please Wait... | Cloudflare',
  'checking your browser',
  'DDoS protection',
  'Ray ID:',
  '_cf_chl',
  '__cf_chl_rt_tk',
  '_cf_chl_opt',
];

const BROWSER_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
];

/**
 * Get random browser User-Agent to avoid bot detection
 */
function getRandomUserAgent(): string {
  return BROWSER_USER_AGENTS[Math.floor(Math.random() * BROWSER_USER_AGENTS.length)];
}

/**
 * Detect Cloudflare protection from response
 */
function detectCloudflare(
  status: number,
  headers: Record<string, string>,
  body: string
): string[] {
  const indicators: string[] = [];

  // Check status codes typical of Cloudflare
  if (status === 403 || status === 503) {
    indicators.push(`HTTP ${status} (Cloudflare error code)`);
  }

  // Check response headers
  const server = headers['server']?.toLowerCase() || '';
  if (server.includes('cloudflare')) {
    indicators.push('Cloudflare server header detected');
  }

  if (headers['cf-ray']) {
    indicators.push('Cloudflare Ray ID in headers');
  }

  if (headers['cf-cache-status']) {
    indicators.push('Cloudflare cache status in headers');
  }

  // Check response body for Cloudflare text
  const bodyLower = body.toLowerCase();
  CLOUDFLARE_INDICATORS.forEach(indicator => {
    if (bodyLower.includes(indicator.toLowerCase())) {
      indicators.push(`Cloudflare text found: "${indicator}"`);
    }
  });

  return indicators;
}

/**
 * Validate API documentation link (Ported from links.py)
 */
export async function validateLink(url: string, timeout: number = 10000): Promise<LinkValidationResult> {
  try {
    const startTime = Date.now();

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'application/json, text/html, */*',
      },
      signal: AbortSignal.timeout(timeout),
    });

    const responseTime = Date.now() - startTime;

    // Read response body (for Cloudflare detection)
    let body = '';
    try {
      body = await response.text();
    } catch {
      // Some URLs don't return readable body, that's okay
    }

    // Build headers map for analysis
    const headersMap: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headersMap[key.toLowerCase()] = value;
    });

    // Check for Cloudflare protection
    const cfIndicators = detectCloudflare(response.status, headersMap, body);
    if (cfIndicators.length > 0) {
      return {
        url,
        status: 'cloudflare_protected',
        statusCode: response.status,
        responseTime,
        cloudflareIndicators: cfIndicators,
      };
    }

    // Determine status based on HTTP status code
    if (response.status >= 200 && response.status < 300) {
      return {
        url,
        status: 'working',
        statusCode: response.status,
        responseTime,
        redirectUrl: response.url !== url ? response.url : undefined,
      };
    }

    if (response.status === 404 || response.status === 410) {
      return {
        url,
        status: 'dead',
        statusCode: response.status,
        responseTime,
      };
    }

    if (response.status === 429) {
      return {
        url,
        status: 'unknown',
        statusCode: response.status,
        responseTime,
        error: 'Rate limited (HTTP 429)',
      };
    }

    // For other error codes, mark as unknown
    return {
      url,
      status: 'unknown',
      statusCode: response.status,
      responseTime,
      error: `HTTP ${response.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Timeout errors
    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      return {
        url,
        status: 'timeout',
        error: 'Request timeout',
      };
    }

    // Connection errors
    if (
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND') ||
      message.includes('EHOSTUNREACH')
    ) {
      return {
        url,
        status: 'dead',
        error: `Connection error: ${message}`,
      };
    }

    // Other errors
    return {
      url,
      status: 'unknown',
      error: `Validation error: ${message}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// ENDPOINT TESTING (Optional, for custom APIs)
// ─────────────────────────────────────────────────────────────────

/**
 * Test an API endpoint
 */
export async function testEndpoint(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  headers?: Record<string, string>,
  timeout: number = 5000
): Promise<EndpointTestResult> {
  try {
    const startTime = Date.now();

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': getRandomUserAgent(),
        ...headers,
      },
      signal: AbortSignal.timeout(timeout),
    });

    const responseTime = Date.now() - startTime;

    let sampleResponse: unknown;
    try {
      sampleResponse = await response.json();
    } catch {
      // Response is not JSON, that's okay
    }

    // Determine status
    let status: 'valid' | 'auth_required' | 'not_found' | 'server_error' | 'unknown' = 'unknown';

    if (response.status >= 200 && response.status < 300) {
      status = 'valid';
    } else if (response.status === 401 || response.status === 403) {
      status = 'auth_required';
    } else if (response.status === 404 || response.status === 410) {
      status = 'not_found';
    } else if (response.status >= 500 && response.status < 600) {
      status = 'server_error';
    }

    return {
      endpoint,
      method,
      status,
      statusCode: response.status,
      responseTime,
      sampleResponse,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      endpoint,
      method,
      status: 'unknown',
      error: `Endpoint test failed: ${message}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// VALIDATION ORCHESTRATION
// ─────────────────────────────────────────────────────────────────

/**
 * Comprehensive API validation
 * Phase 1: Format validation (fast, sync)
 * Phase 2: Link validation (slow, async)
 * Phase 3: Endpoint testing (optional, very slow)
 */
export async function validateApi(
  name: string,
  url: string,
  description: string,
  auth: string,
  https: string,
  cors: string,
  options: {
    validateLinks?: boolean;
    testEndpoints?: boolean;
    endpoints?: string[];
  } = {}
): Promise<ApiValidationAudit> {
  const startTime = new Date().toISOString();

  // Phase 1: Format validation (always)
  const formatResult = validateFormat(name, url, description, auth, https, cors);

  // Phase 2: Link validation (optional)
  let linkResult: LinkValidationResult | undefined;
  if (options.validateLinks) {
    linkResult = await validateLink(url);
  }

  // Phase 3: Endpoint testing (optional, only if link is valid)
  let endpointResults: EndpointTestResult[] | undefined;
  if (options.testEndpoints && options.endpoints && linkResult?.status === 'working') {
    endpointResults = await Promise.all(
      options.endpoints.map(ep => testEndpoint(ep))
    );
  }

  const overallValid =
    formatResult.valid &&
    (!linkResult || linkResult.status === 'working') &&
    (!endpointResults || endpointResults.every(r => r.status === 'valid'));

  return {
    apiName: name,
    timestamp: startTime,
    formatResult,
    linkResult,
    endpointResults,
    overallValid,
  };
}

// ─────────────────────────────────────────────────────────────────
// FORMATTING UTILITIES
// ─────────────────────────────────────────────────────────────────

/**
 * Format validation result for display
 */
export function formatValidationResult(audit: ApiValidationAudit): string {
  let output = `\n📋 Validation Report: ${audit.apiName}\n`;
  output += `📅 ${audit.timestamp}\n`;
  output += `────────────────────────────────────────\n`;

  // Format validation
  output += `\n📝 Format Validation: ${audit.formatResult.valid ? '✅ PASS' : '❌ FAIL'}\n`;
  if (audit.formatResult.errors.length > 0) {
    output += `  Errors:\n`;
    audit.formatResult.errors.forEach(err => {
      output += `    ❌ ${err.field}: ${err.message}\n`;
    });
  }
  if (audit.formatResult.warnings.length > 0) {
    output += `  Warnings:\n`;
    audit.formatResult.warnings.forEach(warn => {
      output += `    ⚠️  ${warn.field}: ${warn.message}\n`;
    });
  }

  // Link validation
  if (audit.linkResult) {
    const statusIcon =
      audit.linkResult.status === 'working'
        ? '✅'
        : audit.linkResult.status === 'cloudflare_protected'
          ? '🚨'
          : '❌';
    output += `\n🔗 Link Validation: ${statusIcon} ${audit.linkResult.status}\n`;
    output += `  URL: ${audit.linkResult.url}\n`;
    if (audit.linkResult.statusCode) output += `  Status: HTTP ${audit.linkResult.statusCode}\n`;
    if (audit.linkResult.responseTime)
      output += `  Response Time: ${audit.linkResult.responseTime}ms\n`;
    if (audit.linkResult.cloudflareIndicators) {
      output += `  Cloudflare Indicators:\n`;
      audit.linkResult.cloudflareIndicators.forEach(ind => {
        output += `    🚨 ${ind}\n`;
      });
    }
    if (audit.linkResult.error) output += `  Error: ${audit.linkResult.error}\n`;
  }

  // Endpoint testing
  if (audit.endpointResults && audit.endpointResults.length > 0) {
    output += `\n🔌 Endpoint Testing:\n`;
    audit.endpointResults.forEach(result => {
      const icon = result.status === 'valid' ? '✅' : '⚠️ ';
      output += `  ${icon} ${result.method} ${result.endpoint} → ${result.status}\n`;
      if (result.statusCode) output += `     HTTP ${result.statusCode}\n`;
      if (result.responseTime) output += `     ${result.responseTime}ms\n`;
    });
  }

  // Overall result
  output += `\n${'═'.repeat(44)}\n`;
  output += `Overall: ${audit.overallValid ? '✅ VALID' : '❌ INVALID'}\n`;
  output += `${'═'.repeat(44)}\n`;

  return output;
}
