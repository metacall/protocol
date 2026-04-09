/*
	This is just a client that implements all the rest API from the FaaS,
	so each function it contains is an endpoint in the FaaS for deploying:

	refresh: updates the auth token
	validate: validates the auth token
	deployEnabled: checks if you're able to deploy
	listSubscriptions: gives you a list of the subscription available
	listSubscriptionsDeploys: gives you a list of the subscription being used in deploys
	inspect: gives you are deploys with it's endpoints
	upload: uploads a zip (package) into the faas
	deploy: deploys the previously uploaded zip into the faas
	deployDelete: deletes the deploy and the zip
	logs: retrieve the logs of a deploy by runner or deployment
	branchList: get the branches of a repository
	fileList: get files of a repository by branch
*/

import { Readable } from 'stream';
import { URL } from 'url';
import { Create, Deployment, LogType, MetaCallJSON } from './deployment';
import { Plans } from './plan';

export class ProtocolError extends Error {
	status?: number;
	data?: unknown;

	constructor(message: string, status?: number, data?: unknown) {
		super(message);
		this.name = 'ProtocolError';
		this.status = status;
		this.data = data;
	}
}

/**
 * Type guard for protocol-specific errors.
 * @param err - The unknown error to check.
 * @returns True if the error is an ProtocolError, false otherwise.
 */
export const isProtocolError = (err: unknown): err is ProtocolError =>
	err instanceof ProtocolError;

type SubscriptionMap = Record<string, number>;

export interface SubscriptionDeploy {
	id: string;
	plan: Plans;
	date: number;
	deploy: string;
}

export enum ResourceType {
	Package = 'Package',
	Repository = 'Repository'
}

export interface Resource {
	id: string;
}

export interface Branches {
	branches: [string];
}

export enum InvokeType {
	Call = 'call',
	Await = 'await'
}

export interface DeployCreateRequest {
	suffix: string;
	resourceType: ResourceType;
	release: string;
	env: { name: string; value: string }[];
	plan: Plans;
	version: string;
}

export interface DeployDeleteRequest {
	prefix: string;
	suffix: string;
	version: string;
}

export interface RepositoryAddRequest {
	url: string;
	branch: string;
	jsons: MetaCallJSON[];
}

export interface RepositoryBranchListRequest {
	url: string;
}

export interface RepositoryFileListRequest {
	url: string;
	branch: string;
}

export interface API {
	refresh(): Promise<string>;
	ready(): Promise<boolean>;
	validate(): Promise<boolean>;
	deployEnabled(): Promise<boolean>;
	listSubscriptions(): Promise<SubscriptionMap>;
	listSubscriptionsDeploys(): Promise<SubscriptionDeploy[]>;
	inspect(): Promise<Deployment[]>;
	inspectByName(suffix: string): Promise<Deployment>;
	upload(
		name: string,
		blob: Blob | Readable,
		jsons?: MetaCallJSON[],
		runners?: string[]
	): Promise<Resource>;
	add(url: string, branch: string, jsons: MetaCallJSON[]): Promise<Resource>;
	deploy(
		name: string,
		env: { name: string; value: string }[],
		plan: Plans,
		resourceType: ResourceType,
		release?: string,
		version?: string
	): Promise<Create>;
	deployDelete(
		prefix: string,
		suffix: string,
		version: string
	): Promise<string>;
	logs(
		container: string,
		type: LogType,
		suffix: string,
		prefix: string,
		version?: string
	): Promise<string>;
	branchList(url: string): Promise<Branches>;
	fileList(url: string, branch: string): Promise<string[]>;
	invoke<Result, Args = unknown>(
		type: InvokeType,
		prefix: string,
		suffix: string,
		version: string,
		name: string,
		args?: Args
	): Promise<Result>;
	call<Result, Args = unknown>(
		prefix: string,
		suffix: string,
		version: string,
		name: string,
		args?: Args
	): Promise<Result>;
	await<Result, Args = unknown>(
		prefix: string,
		suffix: string,
		version: string,
		name: string,
		args?: Args
	): Promise<Result>;
}

interface RequestImpl {
	url: string;
	headers: Headers;
	method: string;
	body?: BodyInit;
}

class Request {
	private token: string;
	private baseURL: string;
	private impl: RequestImpl;

	constructor(token: string, baseURL: string) {
		this.token = token;
		this.baseURL = baseURL;
		this.impl = {
			url: '',
			headers: new Headers({
				Authorization: 'jwt ' + this.token
			}),
			method: 'GET',
			body: undefined
		};
	}

	url(path: string): Request {
		this.impl.url = new URL(path, this.baseURL).toString();
		return this;
	}

	headers(headers = {}): Request {
		this.impl.headers = new Headers({
			Authorization: 'jwt ' + this.token,
			...headers
		});
		return this;
	}

	method(method: string): Request {
		this.impl.method = method;
		return this;
	}

	bodyRaw(body: BodyInit): Request {
		this.impl.body = body;
		return this;
	}

	body(body: unknown): Request {
		this.impl.body = JSON.stringify(body);
		this.impl.headers.set('Content-Type', 'application/json');
		return this;
	}

	private async execute(): Promise<Response> {
		const config: RequestInit = {
			method: this.impl.method,
			headers: this.impl.headers
		};

		if (this.impl.body !== undefined) {
			config.body = this.impl.body;
		}

		const res = await fetch(this.impl.url, config);

		if (!res.ok) {
			const data = await res.text().catch(() => null);
			throw new Error(
				`HTTP ${res.status}: ${res.statusText}${
					data ? ` - ${data}` : ''
				}`
			);
		}

		return res;
	}

	async asJson<T>(): Promise<T> {
		const res = await this.execute();
		return res.json() as Promise<T>;
	}

	async asText(): Promise<string> {
		const res = await this.execute();
		return res.text();
	}

	async asStatus(): Promise<number> {
		const res = await this.execute();
		return res.status;
	}

	async asResponse(): Promise<Response> {
		return await this.execute();
	}
}

export default (token: string, baseURL: string): API => {
	const request = (url = baseURL) => new Request(token, url);
	const hostname = new URL(baseURL).hostname;

	const api: API = {
		refresh: (): Promise<string> =>
			request().url('/api/account/refresh-token').asText(),

		ready: (): Promise<boolean> =>
			request()
				.url('/api/readiness')
				.asStatus()
				.then(status => status === 200),

		validate: (): Promise<boolean> =>
			request().url('/validate').asJson<boolean>(),

		deployEnabled: (): Promise<boolean> =>
			request().url('/api/account/deploy-enabled').asJson<boolean>(),

		listSubscriptions: async (): Promise<SubscriptionMap> => {
			const subscriptionsList = await request()
				.url('/api/billing/list-subscriptions')
				.asJson<string[]>();

			const subscriptions: SubscriptionMap = {};

			for (const id of subscriptionsList) {
				if (subscriptions[id] === undefined) {
					subscriptions[id] = 1;
				} else {
					++subscriptions[id];
				}
			}

			return subscriptions;
		},

		listSubscriptionsDeploys: (): Promise<SubscriptionDeploy[]> =>
			request()
				.url('/api/billing/list-subscriptions')
				.asJson<SubscriptionDeploy[]>(),

		inspect: (): Promise<Deployment[]> =>
			request().url('/api/inspect').asJson<Deployment[]>(),

		inspectByName: async (suffix: string): Promise<Deployment> => {
			const deployments = await api.inspect();

			const deploy = deployments.find(deploy => deploy.suffix == suffix);

			if (!deploy) {
				throw new Error(`Deployment with suffix '${suffix}' not found`);
			}

			return deploy;
		},

		upload: async (
			name: string,
			data: Blob | Readable,
			jsons: MetaCallJSON[] = [],
			runners: string[] = []
		): Promise<Resource> => {
			const fd = new FormData();

			fd.append('id', name);
			fd.append('type', 'application/x-zip-compressed');
			fd.append('jsons', JSON.stringify(jsons));
			fd.append('runners', JSON.stringify(runners));

			if (data instanceof Blob) {
				fd.append('raw', data, `${name}.zip`);
			} else if (data instanceof Readable) {
				// This is terrible but NodeJS does not ensure that streaming and zero
				// copy will be performed anyway, as the sizes are not really big (150mb is the limit)
				// we can do this nasty intermediate buffer creation and forget about it
				const chunks: Uint8Array[] = [];
				for await (const chunk of data) {
					chunks.push(
						typeof chunk === 'string' ? Buffer.from(chunk) : chunk
					);
				}
				const buffer = Buffer.concat(chunks);
				fd.append('raw', new Blob([buffer]), `${name}.zip`);
			} else {
				throw Error(
					`Type ${typeof data} not supported, use Blob or Readable`
				);
			}

			return await request()
				.url('/api/package/create')
				.method('POST')
				.bodyRaw(fd)
				.asJson<Resource>();
		},

		add: (
			url: string,
			branch: string,
			jsons: MetaCallJSON[] = []
		): Promise<Resource> =>
			request()
				.url('/api/repository/add')
				.method('POST')
				.body({
					url,
					branch,
					jsons
				})
				.asJson<Resource>(),

		branchList: (url: string): Promise<Branches> =>
			request()
				.url('/api/repository/branchlist')
				.method('POST')
				.body({
					url
				})
				.asJson<Branches>(),

		deploy: (
			name: string,
			env: { name: string; value: string }[],
			plan: Plans,
			resourceType: ResourceType,
			release: string = Date.now().toString(16),
			version = 'v1'
		): Promise<Create> =>
			request()
				.url('/api/deploy/create')
				.method('POST')
				.body({
					resourceType,
					suffix: name,
					release,
					env,
					plan,
					version
				})
				.asJson<Create>(),

		deployDelete: (
			prefix: string,
			suffix: string,
			version = 'v1'
		): Promise<string> =>
			request()
				.url('/api/deploy/delete')
				.method('POST')
				.body({
					prefix,
					suffix,
					version
				})
				.asJson<string>(),

		logs: (
			container: string,
			type: LogType = LogType.Deploy,
			suffix: string,
			prefix: string,
			version = 'v1'
		): Promise<string> =>
			request()
				.url('/api/deploy/logs')
				.method('POST')
				.body({
					container,
					type,
					suffix,
					prefix,
					version
				})
				.asJson<string>(),

		fileList: (url: string, branch: string): Promise<string[]> =>
			request()
				.url('/api/repository/filelist')
				.method('POST')
				.body({
					url,
					branch
				})
				.asJson<{ [k: string]: string[] }>()
				.then(res => res['files']),

		invoke: async <Result, Args = unknown>(
			type: InvokeType,
			prefix: string,
			suffix: string,
			version = 'v1',
			name: string,
			args?: Args
		): Promise<Result> => {
			const req = (() => {
				if (hostname === 'localhost') {
					// Old API in commercial FaaS and current API of FaaS reimplementation
					return request().url(
						`/${prefix}/${suffix}/${version}/${type}/${name}`
					);
				} else {
					// New API used by commercial FaaS
					return request(
						`https://${version}-${suffix}-${prefix}.api.metacall.io`
					).url(`/${type}/${name}`);
				}
			})();

			if (args === undefined) {
				req.method('GET');
			} else {
				req.method('POST').body(args);
			}

			return await req.asJson<Result>();
		},

		call: <Result, Args = unknown>(
			prefix: string,
			suffix: string,
			version = 'v1',
			name: string,
			args?: Args
		): Promise<Result> =>
			api.invoke(InvokeType.Call, prefix, suffix, version, name, args),

		await: <Result, Args = unknown>(
			prefix: string,
			suffix: string,
			version = 'v1',
			name: string,
			args?: Args
		): Promise<Result> =>
			api.invoke(InvokeType.Await, prefix, suffix, version, name, args)
	};

	return api;
};

export const MaxRetries = 100;
export const MaxRetryInterval = 5000;
export const MaxFuncLength = 64;

/**
 * Executes an asynchronous function with automatic retry logic.
 *
 * The function will be retried up to `maxRetries` times, waiting `interval`
 * milliseconds between each attempt. If all retries fail, the last error is
 * wrapped in a new `Error` with a descriptive message, including:
 * - Function name (or string representation truncated to `MaxFuncLength` chars if anonymous)
 * - Number of retries attempted
 * - Original error message
 *
 * Error handling is fully type-safe:
 * - If the error is an ProtocolError (checked via `isProtocolError`), its
 *   message is used.
 * - If the error is a standard `Error`, its `message` is used.
 * - Otherwise, the error is converted to a string.
 *
 * @typeParam T - The return type of the function being retried.
 * @param fn - A lambda or bound function returning a `Promise<T>`. The
 *             function should contain the logic you want to retry.
 * @param maxRetries - Maximum number of retry attempts. Default: `MaxRetries`.
 * @param interval - Delay between retries in milliseconds. Default: `MaxRetryInterval`.
 * @returns A `Promise` resolving to the return value of `fn` if successful.
 * @throws Error If all retry attempts fail, throws a new Error containing
 *                 information about the function and the last error.
 *
 * @example
 * ```ts
 * const deployment = await waitFor(() => api.inspectByName('my-suffix'));
 * ```
 *
 * @example
 * ```ts
 * const result = await waitFor(
 *   () => api.deploy(name, env, plan, resourceType)
 * );
 * ```
 */
export const waitFor = async <T>(
	fn: (cancel: (message: string) => void) => Promise<T>,
	maxRetries: number = MaxRetries,
	interval: number = MaxRetryInterval
): Promise<T> => {
	let retry = 0;
	let cancellation = undefined;

	const cancel = (message: string) => {
		retry = MaxRetries;
		cancellation = `Operation cancelled with message: ${message}`;
	};

	for (;;) {
		try {
			return await fn(cancel);
		} catch (error) {
			retry++;
			if (retry >= maxRetries) {
				const fnStr = fn.toString();
				const func =
					fn.name ||
					(fnStr.length > MaxFuncLength
						? fnStr.slice(0, MaxFuncLength) + '...'
						: fnStr);
				const message =
					cancellation !== undefined
						? cancellation
						: isProtocolError(error)
						? error.message
						: error instanceof Error
						? error.message
						: String(error);

				throw new Error(
					`Failed to execute '${func}' after ${maxRetries} retries: ${message}`
				);
			}

			await new Promise(r => setTimeout(r, interval));
		}
	}
};
