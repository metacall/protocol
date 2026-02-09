/**
 * FaaS test helpers: readiness, inspect (fetch-based), get deployment by suffix, call function.
 * Uses fetch (no axios). For use in integration tests and tooling.
 */

import type { Deployment } from './deployment';

const defaultMaxRetries = 30;
const defaultRetryIntervalMs = 1000;
const defaultGetDeploymentRetries = 10;
const defaultGetDeploymentIntervalMs = 2000;

/**
 * Poll GET /readiness until 200 or max retries.
 * On connection failure, throws a message suggesting to start the FaaS first.
 */
export async function waitForReadiness(
	baseUrl: string,
	maxRetries = defaultMaxRetries,
	intervalMs = defaultRetryIntervalMs
): Promise<void> {
	const url = `${baseUrl.replace(/\/$/, '')}/readiness`;
	for (let i = 0; i < maxRetries; i++) {
		try {
			const res = await fetch(url);
			if (res.status === 200) return;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (
				i === 0 &&
				(msg.includes('fetch failed') || msg.includes('ECONNREFUSED'))
			) {
				throw new Error(
					`Cannot reach FaaS at ${url}. Start it first (e.g. "npm start" in another terminal), then run the integration tests.`
				);
			}
			if (i === maxRetries - 1) throw err;
		}
		await new Promise(r => setTimeout(r, intervalMs));
	}
	throw new Error(`Readiness check failed after ${maxRetries} retries.`);
}

/**
 * GET /api/inspect and return deployments (fetch, no token).
 */
export async function getDeployments(baseUrl: string): Promise<Deployment[]> {
	const url = `${baseUrl.replace(/\/$/, '')}/api/inspect`;
	const res = await fetch(url);
	if (!res.ok)
		throw new Error(`Inspect failed: ${res.status} ${res.statusText}`);
	return (await res.json()) as Deployment[];
}

/**
 * Get the full deployment object for a given suffix. Retries until found or max retries.
 * Returns the whole deployment (use .prefix, .suffix, .version as needed).
 */
export async function getDeployment(
	baseUrl: string,
	suffix: string,
	maxRetries = defaultGetDeploymentRetries,
	intervalMs = defaultGetDeploymentIntervalMs
): Promise<Deployment> {
	const base = baseUrl.replace(/\/$/, '');
	for (let i = 0; i < maxRetries; i++) {
		const deployments = await getDeployments(base);
		const dep = deployments.find(d => d.suffix === suffix);
		if (dep) return dep;
		await new Promise(r => setTimeout(r, intervalMs));
	}
	throw new Error(
		`Failed to get deployment for suffix "${suffix}" after ${maxRetries} retries.`
	);
}

/**
 * Call a deployed function: POST to /prefix/suffix/version/call/funcName with args as JSON body.
 * Returns parsed JSON response body.
 */
export async function callFunction(
	baseUrl: string,
	prefix: string,
	suffix: string,
	version: string,
	funcName: string,
	args: unknown[]
): Promise<unknown> {
	const url = `${baseUrl.replace(
		/\/$/,
		''
	)}/${prefix}/${suffix}/${version}/call/${funcName}`;
	const contentType = 'Content-Type';
	const res = await fetch(url, {
		method: 'POST',
		headers: { [contentType]: 'application/json' },
		body: JSON.stringify(args)
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Call ${funcName} failed: ${res.status} ${text}`);
	}
	const text = await res.text();
	if (!text) return undefined;
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return text;
	}
}
