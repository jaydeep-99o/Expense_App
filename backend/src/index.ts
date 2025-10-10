// src/index.ts
// import dotenv from 'dotenv';
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
// dotenv.config();

import { connectDB } from './db';
import { seedIfEmpty } from './seed';

import authRoutes from './routes/auth';
import approvalsRoutes from './routes/approvals';
import expensesRoutes from './routes/expenses';
import usersRoutes from './routes/users';
import flowsRoutes from './routes/flows';



const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT ?? 4000);
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/odoo_app';

// Simple health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/flows', flowsRoutes);

// Boot
(async () => {
  try {
    await connectDB(MONGODB_URI);
    await seedIfEmpty();
    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
})();

// Optional: keep the process alive and visible for unexpected errors
process.on('unhandledRejection', (err) => console.error('unhandledRejection', err));
process.on('uncaughtException', (err) => console.error('uncaughtException', err));
