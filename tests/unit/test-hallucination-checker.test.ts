import { describe, it, expect, beforeEach } from 'bun:test';
import {
    HallucinationChecker,
    MockToolCatalog,
    HallucinationDetectedError,
    type ToolDescriptor
} from '../../src/execution/hallucination-checker';

describe('HallucinationChecker', () => {
    let catalog: MockToolCatalog;
    let checker: HallucinationChecker;

    const sampleTools: ToolDescriptor[] = [
        {
            id: 'fs-read',
            name: 'Read File',
            description: 'Reads a file from disk',
            schema: {
                type: 'object',
                properties: {
                    path: { type: 'string' }
                },
                required: ['path']
            }
        },
        {
            id: 'fs-write',
            name: 'Write File',
            description: 'Writes a file to disk'
        }
    ];

    beforeEach(() => {
        catalog = new MockToolCatalog(sampleTools);
        checker = new HallucinationChecker(catalog);
    });

    describe('validateTool', () => {
        it('should return tool descriptor for valid tool', () => {
            const tool = checker.validateTool('fs-read', { path: 'test.txt' });
            expect(tool.id).toBe('fs-read');
        });

        it('should throw HallucinationDetectedError for non-existent tool', () => {
            try {
                checker.validateTool('fs-delete');
                expect(true).toBe(false); // Should not reach here
            } catch (error) {
                expect(error).toBeInstanceOf(HallucinationDetectedError);
                const err = error as HallucinationDetectedError;
                expect(err.message).toContain("Tool 'fs-delete' does not exist");
                expect(err.details.requestedTool).toBe('fs-delete');
                expect(err.details.suggestions).toHaveLength(2); // fs-read, fs-write
            }
        });

        it('should throw error for missing required arguments', () => {
            try {
                checker.validateTool('fs-read', {});
                expect(true).toBe(false);
            } catch (error) {
                expect(error).toBeInstanceOf(HallucinationDetectedError);
                const err = error as HallucinationDetectedError;
                expect(err.message).toBe("Tool 'fs-read' argument validation failed");
                expect(err.details.schemaErrors).toContain('Missing required argument: path');
            }
        });

        it('should skip schema validation if tool has no schema', () => {
            const tool = checker.validateTool('fs-write', { some: 'args' });
            expect(tool.id).toBe('fs-write');
        });
    });

    describe('Helper Methods', () => {
        it('should check if tool exists', () => {
            expect(checker.toolExists('fs-read')).toBe(true);
            expect(checker.toolExists('nonexistent')).toBe(false);
        });

        it('should get tool descriptor', () => {
            expect(checker.getTool('fs-read')).toBeDefined();
            expect(checker.getTool('nonexistent')).toBeUndefined();
        });

        it('should list all tools', () => {
            expect(checker.listAvailableTools()).toHaveLength(2);
        });

        it('should find similar tools', () => {
            const matches = checker.findSimilarTools('fs-red', 1);
            expect(matches).toHaveLength(1);
            expect(matches[0].id).toBe('fs-read');
        });
    });

    describe('HallucinationDetectedError', () => {
        it('should format message for user when tool is missing', () => {
            const err = new HallucinationDetectedError('Missing tool', {
                requestedTool: 'xyz',
                suggestions: [{ id: 'abc', name: 'ABC' }],
                availableToolCount: 10
            });

            const output = err.formatForUser();
            expect(output).toContain('Requested: \'xyz\'');
            expect(output).toContain('Did you mean one of these?');
            expect(output).toContain('abc - ABC');
            expect(output).toContain('Available tools: 10');
        });

        it('should format message for schema errors', () => {
            const err = new HallucinationDetectedError('Invalid args', {
                schemaErrors: ['Missing path', 'Wrong type']
            });

            const output = err.formatForUser();
            expect(output).toContain('Argument validation errors:');
            expect(output).toContain('Missing path');
            expect(output).toContain('Wrong type');
        });
    });
});
