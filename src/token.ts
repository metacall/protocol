import jwt from 'jsonwebtoken';

/**
 * Returns the time in milliseconds until the token expires.
 * Negative value means the token is already expired.
 *
 * @param token - JWT token string
 * @returns Milliseconds until expiration
 */
export const expiresIn = (token: string): number => {
	if (!token) {
		throw new Error('Token is required');
	}

	const decoded = jwt.decode(token);

	if (!decoded || typeof decoded === 'string') {
		throw new Error('Invalid token');
	}

	if (typeof decoded.exp !== 'number') {
		throw new Error('Token missing expiration');
	}

	const now = Date.now() / 1000;
	return (decoded.exp - now) * 1000;
};
