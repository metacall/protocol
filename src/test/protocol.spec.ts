import { deepStrictEqual } from 'assert';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { Plans } from '../plan';
import Protocol, { API, SubscriptionDeploy } from '../protocol';

describe('Unit Subscription', function () {
	let api: API;
	let deployments: SubscriptionDeploy[];
	const requests: { method?: string; url?: string }[] = [];
	const server = createServer((req, res) => {
		requests.push({ method: req.method, url: req.url });

		if (req.method !== 'GET') {
			res.writeHead(405).end();
		} else if (req.url === '/api/billing/list-subscriptions-deploys') {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify(deployments));
		} else if (req.url === '/api/billing/list-subscriptions') {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify(['Essential', 'Essential', 'Standard']));
		} else {
			res.writeHead(404).end();
		}
	});

	before(async () => {
		await new Promise<void>((resolve, reject) => {
			server.once('error', reject);
			server.listen(0, '127.0.0.1', resolve);
		});
		const { port } = server.address() as AddressInfo;
		api = Protocol('offline-test-token', `http://127.0.0.1:${port}`);
	});

	beforeEach(() => {
		requests.length = 0;
		deployments = [];
	});

	after(async () => {
		await new Promise<void>((resolve, reject) => {
			server.close(error => (error ? reject(error) : resolve()));
		});
	});

	it('listSubscriptionsDeploys empty', async () => {
		const result = await api.listSubscriptionsDeploys();
		deepStrictEqual(requests, [
			{ method: 'GET', url: '/api/billing/list-subscriptions-deploys' }
		]);
		deepStrictEqual(result, []);
	});

	it('listSubscriptionsDeploys populated', async () => {
		deployments = [
			{
				id: 'subscription-1',
				plan: Plans.Essential,
				date: 1710000000000,
				deploy: 'deployment-1'
			},
			{
				id: 'subscription-2',
				plan: Plans.Standard,
				date: 1710000001000,
				deploy: 'deployment-2'
			}
		];

		const result = await api.listSubscriptionsDeploys();
		deepStrictEqual(requests, [
			{ method: 'GET', url: '/api/billing/list-subscriptions-deploys' }
		]);
		deepStrictEqual(result, deployments);
	});

	it('listSubscriptions counts per plan', async () => {
		const result = await api.listSubscriptions();
		deepStrictEqual(requests, [
			{ method: 'GET', url: '/api/billing/list-subscriptions' }
		]);
		deepStrictEqual(result, { Essential: 2, Standard: 1 });
	});
});
