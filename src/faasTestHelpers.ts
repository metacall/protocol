/**
 * FaaS test helpers: readiness, inspect, get deployment by suffix, call function.
 * Uses axios to match existing protocol code. For use in integration tests and tooling.
 */

import axios from 'axios';
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
			const res = await axios.get(url);
			if (res.status === 200) return;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (
				i === 0 &&
				(msg.includes('ECONNREFUSED') ||
					msg.includes('Network Error') ||
					(err as { code?: string }).code === 'ECONNREFUSED')
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
 * GET /api/inspect and return deployments (no token).
 */
export async function getDeployments(baseUrl: string): Promise<Deployment[]> {
	const url = `${baseUrl.replace(/\/$/, '')}/api/inspect`;
	try {
		const res = await axios.get<Deployment[]>(url);
		return res.data;
	} catch (err) {
		if (axios.isAxiosError(err) && err.response) {
			throw new Error(
				`Inspect failed: ${err.response.status} ${err.response.statusText}`
			);
		}
		throw err;
	}
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
	try {
		const res = await axios.post<unknown>(url, args, {
			headers: { 'Content-Type': 'application/json' }
		});
		return res.data;
	} catch (err) {
		if (axios.isAxiosError(err) && err.response) {
			const text =
				typeof err.response.data === 'string'
					? err.response.data
					: JSON.stringify(err.response.data);
			throw new Error(
				`Call ${funcName} failed: ${err.response.status} ${text}`
			);
		}
		throw err;
	}
}
