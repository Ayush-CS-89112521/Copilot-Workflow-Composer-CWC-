import { describe, it, expect } from 'bun:test';
import { maskSecrets, maskGenericSecrets } from '../../src/safety/secret-masker';

describe('Layer 7: Secret Masking', () => {

    describe('Generic Pattern Detection', () => {
        it('should mask AWS Access Keys', () => {
            const input = 'My key is AKIAIOSFODNN7EXAMPLE';
            const { masked } = maskGenericSecrets(input);
            expect(masked).toContain('REDACTED');
            expect(masked).not.toContain('AKIAIOSFODNN7EXAMPLE');
        });

        it('should mask GitHub tokens', () => {
            const input = 'Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz';
            const { masked } = maskGenericSecrets(input);
            expect(masked).toContain('REDACTED');
            expect(masked).not.toContain('ghp_1234567890abcdefghijklmnopqrstuvwxyz');
        });

        it('should mask Private Keys', () => {
            const input = 'Key content: -----BEGIN RSA PRIVATE KEY----- MIIE... -----END RSA PRIVATE KEY-----';
            const { masked } = maskGenericSecrets(input);
            expect(masked).toContain('REDACTED');
            expect(masked).not.toContain('MIIE');
        });

        it('should mask standard API key patterns (len > 16)', () => {
            const input = 'api_key=abcdef1234567890abcdef';
            const { masked } = maskGenericSecrets(input);
            expect(masked).toContain('REDACTED');
            expect(masked).not.toContain('abcdef1234567890abcdef');
        });
    });

    describe('Full Masking Pipeline', () => {
        it('should mask multiple secrets in one string', () => {
            const input = 'Exposed: AKIAIOSFODNN7EXAMPLE and ghp_1234567890abcdefghijklmnopqrstuvwxyz';
            const { masked } = maskSecrets(input, { stepId: 'test-step' });
            expect(masked).not.toContain('AKIAIOSFODNN7EXAMPLE');
            expect(masked).not.toContain('ghp_1234567890abcdefghijklmnopqrstuvwxyz');
            const parts = masked.split('REDACTED');
            expect(parts.length).toBeGreaterThan(2);
        });

        it('should generate audit trail for redactions', () => {
            const input = 'My key is AKIAIOSFODNN7EXAMPLE';
            const { audits } = maskSecrets(input, { stepId: 'test-step' });
            expect(audits.length).toBeGreaterThan(0);
            expect(audits[0]).toHaveProperty('secretType');
            expect(audits[0]).toHaveProperty('redactedLength');
        });

        it('should return original text if no secrets found', () => {
            const input = 'Just a normal log message';
            const { masked, audits } = maskSecrets(input, { stepId: 'test-step' });
            expect(masked).toBe(input);
            expect(audits.length).toBe(0);
        });
    });
});
