import { describe, expect, it } from 'vitest';

/**
 * Parallel Vitest test suite - runs alongside existing Mocha tests.
 * Naming: *.vitest.ts so Mocha (which picks up dist/test/*.js) never conflicts.
 * Ref: https://github.com/metacall/protocol/issues/49
 */

describe('Protocol - Module Loading', () => {
	it('index module loads without errors', async () => {
		const mod = await import('../src/index');
		expect(mod).toBeDefined();
		expect(typeof mod).toBe('object');
	});
});

describe('Protocol - Package Metadata', () => {
	it('has correct package name', () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const pkg = require('../package.json') as {
			name: string;
			version: string;
		};
		expect(pkg.name).toBe('@metacall/protocol');
	});

	it('has a valid semver version string', () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const pkg = require('../package.json') as { version: string };
		expect(typeof pkg.version).toBe('string');
		expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
	});
});

describe('Protocol - Source Modules', () => {
	it('deployment module loads', async () => {
		const mod = await import('../src/deployment');
		expect(mod).toBeDefined();
	});

	it('login module loads', async () => {
		const mod = await import('../src/login');
		expect(mod).toBeDefined();
	});

	it('token module loads', async () => {
		const mod = await import('../src/token');
		expect(mod).toBeDefined();
	});

	it('plan module loads', async () => {
		const mod = await import('../src/plan');
		expect(mod).toBeDefined();
	});

	it('signup module loads', async () => {
		const mod = await import('../src/signup');
		expect(mod).toBeDefined();
	});

	it('language module loads', async () => {
		const mod = await import('../src/language');
		expect(mod).toBeDefined();
	});

	it('package module loads', async () => {
		const mod = await import('../src/package');
		expect(mod).toBeDefined();
	});

	it('protocol module loads', async () => {
		const mod = await import('../src/protocol');
		expect(mod).toBeDefined();
	});
});
