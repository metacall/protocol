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

import axios, { AxiosError, AxiosResponse } from 'axios';
import FormData from 'form-data';
import { Create, Deployment, LogType, MetaCallJSON } from './deployment';
import { Plans } from './plan';

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
};

export interface AddResponse {
	id: string;
}

export interface Branches {
	branches: [string];
}

export interface API {
	refresh(): Promise<string>;
	validate(): Promise<boolean>;
	deployEnabled(): Promise<boolean>;
	listSubscriptions(): Promise<SubscriptionMap>;
	listSubscriptionsDeploys(): Promise<SubscriptionDeploy[]>;
	inspect(): Promise<Deployment[]>;
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
}

export default (token: string, baseURL: string): API => {
	const api: API = {
		refresh: (): Promise<string> =>
			axios
				.get<string>(baseURL + '/api/account/refresh-token', {
					headers: { Authorization: 'jwt ' + token }
				})
				.then(res => res.data),

		validate: (): Promise<boolean> =>
			axios
				.get<boolean>(baseURL + '/validate', {
					headers: { Authorization: 'jwt ' + token }
				})
				.then(res => res.data),

		deployEnabled: (): Promise<boolean> =>
			axios
				.get<boolean>(baseURL + '/api/account/deploy-enabled', {
					headers: { Authorization: 'jwt ' + token }
				})
				.then(res => res.data),

		listSubscriptions: async (): Promise<SubscriptionMap> => {
			const res = await axios.get<string[]>(
				baseURL + '/api/billing/list-subscriptions',
				{
					headers: { Authorization: 'jwt ' + token }
				}
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

		listSubscriptionsDeploys: async (): Promise<SubscriptionDeploy[]> =>
			axios
				.get<SubscriptionDeploy[]>(
					baseURL + '/api/billing/list-subscriptions-deploys',
					{
						headers: { Authorization: 'jwt ' + token }
					}
				)
				.then(res => res.data),

		inspect: async (): Promise<Deployment[]> =>
			axios
				.get<Deployment[]>(baseURL + '/api/inspect', {
					headers: { Authorization: 'jwt ' + token }
				})
				.then(res => res.data),

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
				baseURL + '/api/package/create',
				fd,
				{
					headers: {
						Authorization: 'jwt ' + token,
						...fd.getHeaders()
					}
				}
			);
			return res.data;
		},
		add: (
			url: string,
			branch: string,
			jsons: MetaCallJSON[] = []
		): Promise<AddResponse> =>
			axios
				.post<string>(
					baseURL + '/api/repository/add',
					{
						url,
						branch,
						jsons
					},
					{
						headers: { Authorization: 'jwt ' + token }
					}
				)
				.then((res: AxiosResponse) => res.data as AddResponse),
		branchList: (url: string): Promise<Branches> =>
			axios
				.post<string>(
					baseURL + '/api/repository/branchlist',
					{
						url
					},
					{
						headers: { Authorization: 'jwt ' + token }
					}
				)
				.then((res: AxiosResponse) => res.data as Branches),

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
					baseURL + '/api/deploy/create',
					{
						resourceType,
						suffix: name,
						release,
						env,
						plan,
						version
					},
					{
						headers: { Authorization: 'jwt ' + token }
					}
				)
				.then(res => res.data),

		deployDelete: (
			prefix: string,
			suffix: string,
			version = 'v1'
		): Promise<string> =>
			axios
				.post<string>(
					baseURL + '/api/deploy/delete',
					{
						prefix,
						suffix,
						version
					},
					{
						headers: { Authorization: 'jwt ' + token }
					}
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
					baseURL + '/api/deploy/logs',
					{
						container,
						type,
						suffix,
						prefix,
						version
					},
					{
						headers: { Authorization: 'jwt ' + token }
					}
				)
				.then(res => res.data),

		fileList: (url: string, branch: string): Promise<string[]> =>
			axios
				.post<{ [k: string]: string[] }>(
					baseURL + '/api/repository/filelist',
					{
						url,
						branch
					},
					{
						headers: { Authorization: 'jwt ' + token }
					}
				)
				.then(res => res.data['files'])
	};

	return api;
};
