/*

* About File:

	this is just a client that implements all the rest API from the FaaS, so each function it contains is an endpoint in the FaaS for deploying and similar

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

import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import FormData from 'form-data';
import { URL } from 'url';
import { Create, Deployment, LogType, MetaCallJSON } from './deployment';
import { Plans } from './plan';
import { ProtocolError } from './protocol';

/**
 * Type guard for protocol-specific errors (Axios errors in this case).
 * @param err - The unknown error to check.
 * @returns True if the error is an ProtocolError, false otherwise.
 */
export const isProtocolError = (err: unknown): boolean =>
	axios.isAxiosError(err);

export { AxiosError as ProtocolError };

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

export interface AddResponse {
	id: string;
}

export interface Branches {
	branches: [string];
}

export enum InvokeType {
	Call = 'call',
	Await = 'await'
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
		blob: unknown,
		jsons?: MetaCallJSON[],
		runners?: string[]
	): Promise<string>;
	add(
		url: string,
		branch: string,
		jsons: MetaCallJSON[]
	): Promise<AddResponse>;
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

export default (token: string, baseURL: string): API => {
	const getURL = (path: string): string => new URL(path, baseURL).toString();
	const getConfig = (headers = {}): AxiosRequestConfig => {
		return {
			headers: {
				Authorization: 'jwt ' + token,
				...headers
			}
		};
	};

	const api: API = {
		refresh: (): Promise<string> =>
			axios
				.get<string>(getURL('/api/account/refresh-token'), getConfig())
				.then(res => res.data),

		ready: (): Promise<boolean> =>
			axios
				.get<boolean>(getURL('/api/readiness'), getConfig())
				.then(res => res.status == 200),

		validate: (): Promise<boolean> =>
			axios
				.get<boolean>(getURL('/validate'), getConfig())
				.then(res => res.data),

		deployEnabled: (): Promise<boolean> =>
			axios
				.get<boolean>(
					getURL('/api/account/deploy-enabled'),
					getConfig()
				)
				.then(res => res.data),

		listSubscriptions: async (): Promise<SubscriptionMap> => {
			const res = await axios.get<string[]>(
				getURL('/api/billing/list-subscriptions'),
				getConfig()
			);

			const subscriptions: SubscriptionMap = {};

			for (const id of res.data) {
				if (subscriptions[id] === undefined) {
					subscriptions[id] = 1;
				} else {
					++subscriptions[id];
				}
			}

			return subscriptions;
		},

		listSubscriptionsDeploys: (): Promise<SubscriptionDeploy[]> =>
			axios
				.get<SubscriptionDeploy[]>(
					getURL('/api/billing/list-subscriptions-deploys'),
					getConfig()
				)
				.then(res => res.data),

		inspect: (): Promise<Deployment[]> =>
			axios
				.get<Deployment[]>(getURL('/api/inspect'), getConfig())
				.then(res => res.data),

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
			blob: unknown,
			jsons: MetaCallJSON[] = [],
			runners: string[] = []
		): Promise<string> => {
			const fd = new FormData();
			fd.append('id', name);
			fd.append('type', 'application/x-zip-compressed');
			fd.append('jsons', JSON.stringify(jsons));
			fd.append('runners', JSON.stringify(runners));
			fd.append('raw', blob, {
				filename: 'blob',
				contentType: 'application/x-zip-compressed'
			});
			const res = await axios.post<string>(
				getURL('/api/package/create'),
				fd,
				getConfig(fd.getHeaders?.() ?? {}) // Operator chaining to make it compatible with frontend
			);
			return res.data;
		},
		add: (
			url: string,
			branch: string,
			jsons: MetaCallJSON[] = []
		): Promise<AddResponse> =>
			axios
				.post<AddResponse>(
					getURL('/api/repository/add'),
					{
						url,
						branch,
						jsons
					},
					getConfig()
				)
				.then(res => res.data),
		branchList: (url: string): Promise<Branches> =>
			axios
				.post<Branches>(
					getURL('/api/repository/branchlist'),
					{
						url
					},
					getConfig()
				)
				.then(res => res.data),

		deploy: (
			name: string,
			env: { name: string; value: string }[],
			plan: Plans,
			resourceType: ResourceType,
			release: string = Date.now().toString(16),
			version = 'v1'
		): Promise<Create> =>
			axios
				.post<Create>(
					getURL('/api/deploy/create'),
					{
						resourceType,
						suffix: name,
						release,
						env,
						plan,
						version
					},
					getConfig()
				)
				.then(res => res.data),

		deployDelete: (
			prefix: string,
			suffix: string,
			version = 'v1'
		): Promise<string> =>
			axios
				.post<string>(
					getURL('/api/deploy/delete'),
					{
						prefix,
						suffix,
						version
					},
					getConfig()
				)
				.then(res => res.data),

		logs: (
			container: string,
			type: LogType = LogType.Deploy,
			suffix: string,
			prefix: string,
			version = 'v1'
		): Promise<string> =>
			axios
				.post<string>(
					getURL('/api/deploy/logs'),
					{
						container,
						type,
						suffix,
						prefix,
						version
					},
					getConfig()
				)
				.then(res => res.data),

		fileList: (url: string, branch: string): Promise<string[]> =>
			axios
				.post<{ [k: string]: string[] }>(
					getURL('/api/repository/filelist'),
					{
						url,
						branch
					},
					getConfig()
				)
				.then(res => res.data['files']),

		invoke: <Result, Args = unknown>(
			type: InvokeType,
			prefix: string,
			suffix: string,
			version = 'v1',
			name: string,
			args?: Args
		): Promise<Result> => {
			const url = getURL(
				`/${prefix}/${suffix}/${version}/${type}/${name}`
			);
			const config = getConfig();

			const req =
				args === undefined
					? axios.get<Result>(url, config)
					: axios.post<Result>(url, args, config);

			return req.then(res => res.data);
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

export const MaxRetries = 30;
export const MaxRetryInterval = 2000;

/**
 * Executes an asynchronous function with automatic retry logic.
 *
 * The function will be retried up to `maxRetries` times, waiting `interval`
 * milliseconds between each attempt. If all retries fail, the last error is
 * wrapped in a new `Error` with a descriptive message, including:
 * - Function name (or truncated string representation if anonymous)
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
	fn: () => Promise<T>,
	maxRetries: number = MaxRetries,
	interval: number = MaxRetryInterval
): Promise<T> => {
	let retry = 0;

	for (;;) {
		try {
			return await fn();
		} catch (error) {
			retry++;
			if (retry >= maxRetries) {
				const func = fn.name || fn.toString();
				const message = isProtocolError(error)
					? (error as ProtocolError).message
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
