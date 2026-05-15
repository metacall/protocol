import { URL } from 'url';
import { ProtocolError } from './protocol';
interface Request {
	email: string;
	password: string;
	alias: string;
	'g-recaptcha-response'?: string;
}

export default async (
	email: string,
	password: string,
	alias: string,
	baseURL: string
): Promise<string> => {
	const request: Request = {
		email,
		password,
		alias
	};

	if (!baseURL.includes('localhost')) {
		request['g-recaptcha-response'] = 'empty'; // TODO: Review the captcha
	}

	const res = await fetch(baseURL + '/signup', {
		method: 'POST',
		headers: {
			Accept: 'application/json, text/plain, */*',
			Host: new URL(baseURL).host,
			Origin: baseURL,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(request)
	});

	if (!res.ok) {
		throw new ProtocolError('Signup failed', res.status, await res.text());
	}

	return await res.text();
};
