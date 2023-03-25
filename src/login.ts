import axios from 'axios';
import { URL } from 'url';

interface Request {
	email: string;
	password: string;
	'g-recaptcha-response'?: string;
}

export default (
	email: string,
	password: string,
	baseURL: string
): Promise<string> => {
	const request: Request = {
		email,
		password
	};

	if (!baseURL.includes('localhost'))
		request['g-recaptcha-response'] = 'empty'; //TODO: Review the captcha

	return axios
		.post<string>(baseURL + '/login', request, {
			headers: {
				Accept: 'application/json, text/plain, */*',
				Host: new URL(baseURL).host,
				Origin: baseURL
			}
		})
		.then(res => res.data);
};
