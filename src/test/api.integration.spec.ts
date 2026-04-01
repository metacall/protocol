import { strictEqual } from 'assert';
import { Plans } from '../plan';
import Protocol, { ResourceType, waitFor } from '../protocol';

describe('Integration API', function () {
	this.timeout(2000000);

	const token = process.env.API_TOKEN;
	const baseURL = process.env.API_BASE_URL || 'https://dashboard.metacall.io';

	if (token === undefined) {
		// Skip test
		return;
	}

	const API = Protocol(token, baseURL);

	it('Should add repository', async function () {
		const { id } = await API.add(
			'https://github.com/metacall/examples.git',
			'master',
			[]
		);

		const resource = await API.deploy(
			id,
			[],
			Plans.Essential,
			ResourceType.Repository,
			'19d499ed1aa',
			'v1'
		);

		console.log(JSON.stringify(resource, null, 2));
		console.log(resource.suffix);

		const deploy = await waitFor(async cancel => {
			const deploy = await API.inspectByName(resource.suffix);

			if (deploy.status === 'create') {
				throw new Error('Not ready yet');
			} else if (deploy.status === 'fail') {
				cancel('Deploy failed');
			}

			return deploy;
		});

		console.log(JSON.stringify(deploy, null, 2));

		strictEqual(deploy.suffix, 'metacall-examples');
		strictEqual(deploy.status, 'ready');
	});
});
