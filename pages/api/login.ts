import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Legacy login endpoint retained only to return an explicit retirement response.
 * Authentication is handled exclusively by NextAuth.
 */
export default function login(_req: NextApiRequest, res: NextApiResponse) {
  return res.status(410).json({
    message: 'This login endpoint has been retired. Use NextAuth credentials sign-in.',
  });
}
