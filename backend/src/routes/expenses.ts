import { Router } from 'express';
import { z } from 'zod';
import { ensureAuth } from '../auth';
import { Expense, User } from '../model';
import { createApprovalTask } from './approvals'; // Import the helper function

const router = Router();

async function getNextId() {
  const last = await Expense.findOne().sort({ id: -1 }).select('id');
  return (last?.id || 0) + 1;
}

// GET /api/expenses (employee -> own; manager/admin -> all)
router.get('/', ensureAuth, async (req: any, res) => {
  try {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/expenses/:id (employees can only view own)
router.get('/:id', ensureAuth, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const exp = await Expense.findOne({ id });
    if (!exp) return res.status(404).json({ error: 'Not found' });

    if (req.user.role === 'employee' && exp.employeeId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(exp);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
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

  try {
    const me = await User.findOne({ id: req.user.id });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const nextId = await getNextId();
    const companyCurrency = 'INR'; // demo; replace with company's currency
    
    // Simple currency conversion (replace with real FX service)
    const conversionRates: Record<string, number> = {
      'USD': 85,
      'EUR': 90,
      'INR': 1,
      'GBP': 105,
    };
    
    const amountInINR = parsed.data.amount * (conversionRates[parsed.data.currency] || 1);
    const amountCompanyCcy = companyCurrency === 'INR' 
      ? amountInINR 
      : amountInINR / (conversionRates[companyCurrency] || 1);

    const doc = await Expense.create({
      id: nextId,
      employeeId: me.id,
      employeeName: me.name || me.email,
      spendDate: parsed.data.spendDate,
      category: parsed.data.category,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      amountCompanyCcy: Math.round(amountCompanyCcy * 100) / 100,
      companyCurrency,
      status: 'waiting', // Changed from 'submitted' to 'waiting'
      description: parsed.data.description,
      remarks: parsed.data.remarks,
      timeline: [
        { 
          at: new Date().toISOString(), 
          byUserId: me.id, // Added byUserId
          decision: 'submitted', 
          comment: parsed.data.remarks || 'Expense submitted' 
        },
      ],
    });

    // **Create approval task for the manager**
    await createApprovalTask(doc.toObject());

    res.status(201).json(doc);
  } catch (error: any) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;