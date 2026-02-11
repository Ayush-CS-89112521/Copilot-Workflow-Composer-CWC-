
import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { UIManager } from '../../src/ui/ui-manager';

describe('UIManager', () => {
    // Save original state
    const originalEnv = { ...process.env };
    const originalIsTTY = process.stdin.isTTY;

    beforeEach(() => {
        // Reset Singleton before each test
        // UIManager has a reset static method based on analysis? 
        // If not, we might need to access the private static instance if possible, 
        // or rely on a "reset" method if added.
        // Looking at source: static reset(): void exists!
        UIManager.reset();
        process.env = { ...originalEnv };
        Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
    });

    afterEach(() => {
        process.env = originalEnv;
        Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = UIManager.getInstance();
            const instance2 = UIManager.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should create new instance after reset', () => {
            const instance1 = UIManager.getInstance();
            UIManager.reset();
            const instance2 = UIManager.getInstance();
            expect(instance1).not.toBe(instance2);
        });
    });

    describe('Configuration Loading', () => {
        it('should detect interactive mode (TTY + No CI)', () => {
            Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
            delete process.env.CI;

            const config = UIManager.getInstance().getConfig();
            expect(config.interactive).toBe(true);
        });

        it('should detect non-interactive mode (No TTY)', () => {
            Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
            const config = UIManager.getInstance().getConfig();
            expect(config.interactive).toBe(false);
        });

        it('should detect non-interactive mode (CI env)', () => {
            Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
            process.env.CI = 'true';

            const config = UIManager.getInstance().getConfig();
            expect(config.interactive).toBe(false);
        });

        it('should disable colors with NO_COLORS env', () => {
            process.env.NO_COLORS = '1';
            const config = UIManager.getInstance().getConfig();
            expect(config.showColors).toBe(false);
        });

        it('should disable spinners with NO_SPINNERS env', () => {
            process.env.NO_SPINNERS = '1';
            const config = UIManager.getInstance().getConfig();
            expect(config.showSpinners).toBe(false);
        });

        it('should enable silent mode', () => {
            process.env.SILENT = '1';
            const config = UIManager.getInstance().getConfig();
            expect(config.silent).toBe(true);
            expect(config.showSpinners).toBe(false);
            expect(config.showColors).toBe(false);
        });
    });

    describe('Component Access', () => {
        it('should lazy load spinner manager', () => {
            const manager = UIManager.getInstance();
            // Checking private property access via any cast or just functionality
            const spinners = manager.getSpinnerManager();
            expect(spinners).toBeDefined();

            const spinners2 = manager.getSpinnerManager();
            expect(spinners2).toBe(spinners); // Should be same instance
        });

        it('should lazy load progress header', () => {
            const manager = UIManager.getInstance();
            // Provide totalSteps argument
            const header = manager.getProgressHeader(10);
            expect(header).toBeDefined();

            // Subsequent calls return same instance (argument ignored for retrieval usually, or updates it)
            // Based on typical Singleton/Lazy-load pattern
            const header2 = manager.getProgressHeader(20);
            expect(header2).toBe(header);
        });
    });

    describe('Runtime Updates', () => {
        it('should update config at runtime', () => {
            const manager = UIManager.getInstance();
            manager.setConfig({ showColors: false });
            expect(manager.getConfig().showColors).toBe(false);
        });
    });
});
