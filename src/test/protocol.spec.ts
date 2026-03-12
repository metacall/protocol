import { deepStrictEqual, ok } from 'assert';
import FormData from 'form-data';

describe('Unit Protocol', function () {
	it('FormData getHeaders returns multipart boundary', () => {
		const fd = new FormData();
		fd.append('test', 'value');
		const headers = fd.getHeaders();

		const contentType = headers['content-type'] as string;
		ok(contentType);
		ok(contentType.includes('multipart/form-data'));
		ok(contentType.includes('boundary='));
	});

	it('encodeURIComponent handles special characters', () => {
		const testCases = [
			{ input: 'my function', expected: 'my%20function' },
			{ input: 'test/path', expected: 'test%2Fpath' },
			{ input: 'hello@world', expected: 'hello%40world' },
			{ input: 'v1.0.0', expected: 'v1.0.0' },
			{ input: 'simple', expected: 'simple' }
		];

		testCases.forEach(({ input, expected }) => {
			deepStrictEqual(encodeURIComponent(input), expected);
		});
	});

	it('encodeURIComponent preserves path segments', () => {
		const prefix = 'my-org';
		const suffix = 'my app';
		const version = 'v1';
		const name = 'hello world';

		const encodedPrefix = encodeURIComponent(prefix);
		const encodedSuffix = encodeURIComponent(suffix);
		const encodedVersion = encodeURIComponent(version);
		const encodedName = encodeURIComponent(name);

		const path = `/${encodedPrefix}/${encodedSuffix}/${encodedVersion}/call/${encodedName}`;

		deepStrictEqual(path, '/my-org/my%20app/v1/call/hello%20world');
	});
});
