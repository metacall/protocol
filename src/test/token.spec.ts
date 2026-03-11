import { ok, throws } from 'assert';
import jwt from 'jsonwebtoken';
import { expiresIn } from '../token';

describe('Unit Token', function () {
	const secret = 'test-secret';

	it('expiresIn valid token', () => {
		const exp = Math.floor(Date.now() / 1000) + 3600;
		const token = jwt.sign({ exp }, secret);
		const result = expiresIn(token);

		ok(result > 3599000 && result < 3601000);
	});

	it('expiresIn expired token', () => {
		const exp = Math.floor(Date.now() / 1000) - 100;
		const token = jwt.sign({ exp }, secret);

		ok(expiresIn(token) < 0);
	});

	it('expiresIn empty token', () => {
		throws(() => expiresIn(''));
	});

	it('expiresIn invalid token', () => {
		throws(() => expiresIn('invalid'));
	});

	it('expiresIn missing exp', () => {
		const token = jwt.sign({ sub: '123' }, secret);
		throws(() => expiresIn(token));
	});
});
