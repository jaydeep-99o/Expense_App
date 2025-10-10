import bcrypt from 'bcryptjs';
import { User, Expense, ApprovalTask } from './model';
import { getNextSeq } from './model';

export async function seedIfEmpty() {
  const userCount = await User.countDocuments();
  if (userCount > 0) return;

  // Users
  const adminId = await getNextSeq('user');
  await User.create({
    id: adminId, name: 'Admin', email: 'admin@hack.co', role: 'admin',
    managerId: null, passwordHash: bcrypt.hashSync('admin123', 10)
  });

  const mgrId = await getNextSeq('user');
  await User.create({
    id: mgrId, name: 'John Manager', email: 'john@hack.co', role: 'manager',
    managerId: null, passwordHash: bcrypt.hashSync('manager123', 10)
  });

  const empId = await getNextSeq('user');
  await User.create({
    id: empId, name: 'Sarah Employee', email: 'sarah@hack.co', role: 'employee',
    managerId: mgrId, passwordHash: bcrypt.hashSync('employee123', 10)
  });

  // Expenses
  const e1 = await getNextSeq('expense');
  await Expense.create({
    id: e1, employeeId: empId, employeeName: 'Sarah Employee',
    spendDate: '2024-01-15T10:00:00Z', category: 'Travel',
    amount: 450, currency: 'EUR', amountCompanyCcy: 500, companyCurrency: 'USD',
    status: 'waiting', description: 'Business travel expenses', remarks: 'Conference attendance',
    timeline: [{ at: '2024-01-15T10:00:00Z', decision: 'submitted', comment: 'Initial submission' }]
  });

  const e2 = await getNextSeq('expense');
  await Expense.create({
    id: e2, employeeId: mgrId, employeeName: 'John Manager',
    spendDate: '2024-03-15T10:00:00Z', category: 'Meals',
    amount: 85, currency: 'USD', amountCompanyCcy: 85, companyCurrency: 'USD',
    status: 'approved', description: 'Business lunch with client', remarks: 'Q1 catch-up',
    timeline: [{ at: '2024-03-15T10:00:00Z', decision: 'approved', comment: 'Looks good' }]
  });

  // ApprovalTasks
  const t1 = await getNextSeq('task');
  await ApprovalTask.create({
    id: t1, expenseId: e1, ownerName: 'Sarah Employee', category: 'Travel',
    amountCompanyCcy: 500, companyCurrency: 'USD', submittedCurrency: 'EUR'
  });

  const t2 = await getNextSeq('task');
  await ApprovalTask.create({
    id: t2, expenseId: e2, ownerName: 'John Manager', category: 'Meals',
    amountCompanyCcy: 85, companyCurrency: 'USD', submittedCurrency: 'USD'
  });

  console.log('🌱 Seeded Mongo data');
}
