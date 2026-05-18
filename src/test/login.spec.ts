import { fail, ok, strictEqual } from 'assert';
import login from '../login';
import API, { ProtocolError } from '../protocol';

const user = process.env.API_USER || '';
const password = process.env.API_PASSWORD || '';
const baseURL = process.env.API_BASE_URL || 'https://dashboard.metacall.io';

describe('Unit Login', function () {
	const itCredentials = (() => {
		if (!user || !password) {
			// Skip credential required tests
			console.warn(
				'⚠️ Warning: Login API Test being skipped due to API_USER or API_PASSWORD not defined'
			);
			return it.skip;
		}

		return it;
	})();

	it('login bad email', async () => {
		try {
			await login('eeee', 'aaaa', baseURL);

			fail('This should not be reached');
		} catch (error) {
			strictEqual((error as ProtocolError).data, 'Invalid email.');
		}
	});

	it('login bad token', async () => {
		try {
			const api = API('yeet', baseURL);

			await api.validate();

			fail('This should not be reached');
		} catch (error) {
			strictEqual((error as ProtocolError).data, 'jwt malformed');
		}
	});

	itCredentials('login good email', async () => {
		const token = await login(user, password, baseURL);
		ok(token.length !== 0);
	});
});
