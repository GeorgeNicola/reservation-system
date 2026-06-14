import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../asyncHandler';
import { findUserByEmail, createUser } from '../db/users';

const router = Router();

// Fallback to a hardcoded secret for demo purposes, 
// normally this should come from environment variables.
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-dissertation-key';

router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, full_name, phone, role } = req.body;

    if (!email || !password || !full_name) {
      res.status(400).json({ error: 'Missing required fields (email, password, full_name)' });
      return;
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const userRole = role === 'doctor' ? 'doctor' : 'patient';

    const newUser = await createUser(email, passwordHash, full_name, phone || null, userRole);

    const token = jwt.sign(
      { userId: newUser.id, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        full_name: newUser.full_name,
        role: newUser.role,
      },
      token
    });
  })
);

router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Missing required fields (email, password)' });
      return;
    }

    const user = await findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Since seed data has '$2b$10$placeholder', trying to bcrypt.compare might fail or just return false
    // unless they actually registered or we update the seed. This is fine for new users.
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch && user.password_hash !== '$2b$10$placeholder') {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Demo backdoor: if it's a seeded user with placeholder hash, allow password 'password'
    if (user.password_hash === '$2b$10$placeholder' && password !== 'password') {
      res.status(401).json({ error: 'Invalid credentials (try "password" for seeded users)' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
      token
    });
  })
);

export default router;
