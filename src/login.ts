import axios from 'axios';

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
				Host: baseURL.split('//')[1],
				Origin: baseURL
			}
		})
		.then(res => res.data);
};
