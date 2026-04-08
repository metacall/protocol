import { strictEqual } from 'assert';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Plans } from '../plan';
import Protocol, { ResourceType, waitFor } from '../protocol';

describe('Integration API', function () {
	this.timeout(2000000);

	const token = process.env.API_TOKEN;
	const baseURL = process.env.API_BASE_URL || 'https://dashboard.metacall.io';

	if (token === undefined) {
		// Skip test
		console.warn(
			'⚠️ Warning: Integration API Test being skipped due to API_TOKEN not defined'
		);
		return;
	}

	const API = Protocol(token, baseURL);

	it.skip('Should deploy a repository', async function () {
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

		const deploy = await waitFor(async cancel => {
			const deploy = await API.inspectByName(resource.suffix);

			if (deploy.status === 'create') {
				throw new Error('Not ready yet');
			} else if (deploy.status === 'fail') {
				cancel('Deploy failed');
			}

			return deploy;
		});

		strictEqual(deploy.suffix, 'metacall-examples');
		strictEqual(deploy.status, 'ready');

		const result = await API.deployDelete(
			deploy.prefix,
			deploy.suffix,
			deploy.version
		);

		strictEqual(result, 'Deploy Delete Succeed');
	});

	it.skip('Should deploy a package', async function () {
		const basePath = join(
			process.cwd(),
			'src',
			'test',
			'resources',
			'integration',
			'api'
		);

		const fileBuffer = await readFile(
			join(basePath, 'metacall-protocol-package-test.zip')
		);

		const blob = new Blob([fileBuffer], { type: 'application/zip' });

		const { id } = await API.upload(
			'metacall-protocol-package-test',
			blob,
			[],
			['nodejs']
		);

		strictEqual(id, 'metacall-protocol-package-test');

		const resource = await API.deploy(
			id,
			[],
			Plans.Essential,
			ResourceType.Package,
			'19d499ed1ab',
			'v1'
		);

		const deploy = await waitFor(async cancel => {
			const deploy = await API.inspectByName(resource.suffix);

			if (deploy.status === 'create') {
				throw new Error('Not ready yet');
			} else if (deploy.status === 'fail') {
				cancel('Deploy failed');
			}

			return deploy;
		});

		strictEqual(deploy.suffix, 'metacall-protocol-package-test');
		strictEqual(deploy.status, 'ready');

		const value = await API.call<string>(
			deploy.prefix,
			deploy.suffix,
			deploy.version,
			'test'
		);

		strictEqual(value, 'OK');

		const result = await API.deployDelete(
			deploy.prefix,
			deploy.suffix,
			deploy.version
		);

		strictEqual(result, 'Deploy Delete Succeed');
	});
});
