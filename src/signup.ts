import axios from 'axios';
interface Request {
	email: string;
	password: string;
	alias: string;
	'g-recaptcha-response'?: string;
}

export default (
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
	if (!baseURL.includes('localhost'))
		request['g-recaptcha-response'] = 'empty';
	return axios
		.post<string>(baseURL + '/signup', request, {
			headers: {
				Accept: 'application/json, text/plain, */*',
				Host: baseURL.split('//')[1],
				Origin: baseURL
			}
		})
		.then(res => res.data);
};
