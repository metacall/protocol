import { ProtocolError } from './protocol';

interface Request {
	email: string;
	password: string;
	'g-recaptcha-response'?: string;
}

export default async (
	email: string,
	password: string,
	baseURL: string
): Promise<string> => {
	const request: Request = {
		email,
		password
	};

	if (!baseURL.includes('localhost')) {
		request['g-recaptcha-response'] = 'empty'; // TODO: Review the captcha
	}

	// Use built-in URL class (available in both browsers and Node.js 10+)
	// No need to import from 'url' module which is Node.js-specific
	const url = new URL(baseURL);

	const res = await fetch(baseURL + '/login', {
		method: 'POST',
		headers: {
			Accept: 'application/json, text/plain, */*',
			Host: url.host,
			Origin: baseURL,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(request)
	});

	if (!res.ok) {
		throw new ProtocolError('Login failed', res.status, await res.text());
	}

	return await res.text();
};
