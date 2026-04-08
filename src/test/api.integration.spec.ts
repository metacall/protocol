import { strictEqual } from 'assert';
import { readFile } from 'fs/promises';
import { join } from 'path';
import login from '../login';
import { Plans } from '../plan';
import Protocol, { API, ResourceType, waitFor } from '../protocol';

const user = process.env.API_USER;
const password = process.env.API_PASSWORD;
const baseURL = process.env.API_BASE_URL || 'https://dashboard.metacall.io';

describe('Integration API', function () {
	this.timeout(2000000);

	let API: API;

	before(async function () {
		if (!user || !password) {
			// Skip all tests
			console.warn(
				'⚠️ Warning: Login API Test being skipped due to API_USER or API_PASSWORD not defined'
			);
			this.skip();
		}
		const token = await login(user, password, baseURL);
		API = Protocol(token, baseURL);
	});

	it('Should deploy a repository', async function () {
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

	it('Should deploy a package', async function () {
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
