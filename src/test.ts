// Test for testing the jwt token

import jwt from 'jsonwebtoken';

export default function verifyToken(token: string) {
    try {
      const decoded = jwt.verify(token, 'your-secret-key');
      return decoded;
    } catch (error) {
      return null;
    }
  }