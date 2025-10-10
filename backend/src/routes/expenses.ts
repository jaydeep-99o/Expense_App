import { Router } from 'express';
import { z } from 'zod';
import { ensureAuth } from '../auth';
import { Expense, User } from '../model';

const router = Router();

async function getNextId() {
  const last = await Expense.findOne().sort({ id: -1 }).select('id');
  return (last?.id || 0) + 1;
}

// GET /api/expenses (employee -> own; manager/admin -> all)
router.get('/', ensureAuth, async (req: any, res) => {
  const me = req.user;
  const query = me.role === 'employee' ? { employeeId: me.id } : {};
  const list = await Expense.find(query).sort({ spendDate: -1 });

  // shape for the table
  const rows = list.map(e => ({
    id: e.id,
    spendDate: e.spendDate,
    description: e.description,
    category: e.category,
    amount: e.amount,
    currency: e.currency,
    amountCompanyCcy: e.amountCompanyCcy,
    companyCurrency: e.companyCurrency,
    status: e.status,
  }));

  res.json(rows);
});

// GET /api/expenses/:id (employees can only view own)
router.get('/:id', ensureAuth, async (req: any, res) => {
  const id = Number(req.params.id);
  const exp = await Expense.findOne({ id });
  if (!exp) return res.status(404).json({ error: 'Not found' });

  if (req.user.role === 'employee' && exp.employeeId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(exp);
});

// POST /api/expenses (create new expense)
router.post('/', ensureAuth, async (req: any, res) => {
  const schema = z.object({
    spendDate: z.string().min(1),
    category: z.string().min(1),
    description: z.string().min(1),
    amount: z.number().positive(),
    currency: z.string().min(1),
    remarks: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });

  const me = await User.findOne({ id: req.user.id });
  if (!me) return res.status(404).json({ error: 'User not found' });

  const nextId = await getNextId();
  const companyCurrency = 'USD'; // demo; replace with company’s currency
  // demo conversion: if currency matches company -> 1:1
  const amountCompanyCcy =
    parsed.data.currency === companyCurrency
      ? parsed.data.amount
      : Math.round(parsed.data.amount * 1.1 * 100) / 100; // fake fx

  const doc = await Expense.create({
    id: nextId,
    employeeId: me.id,
    employeeName: me.name || me.email,
    spendDate: parsed.data.spendDate,
    category: parsed.data.category,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    amountCompanyCcy,
    companyCurrency,
    status: 'submitted',
    description: parsed.data.description,
    remarks: parsed.data.remarks,
    timeline: [
      { at: new Date().toISOString(), decision: 'submitted', comment: 'Created by employee' },
    ],
  });

  res.status(201).json(doc);
});

export default router;
