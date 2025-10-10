// src/model.ts
import { Schema, model, models } from 'mongoose';

export type Role = 'employee' | 'manager' | 'admin';
export type ExpenseStatus = 'draft' | 'waiting' | 'approved' | 'rejected' | 'submitted';

/* -------------------- Counter (auto-increment helper) -------------------- */
type CounterDoc = { _id: string; seq: number };
const CounterSchema = new Schema<CounterDoc>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = models.Counter || model<CounterDoc>('Counter', CounterSchema);

export async function getNextSeq(name: string): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doc!.seq;
}

/* ------------------------------ User model ------------------------------- */
export type UserDoc = {
  _id: any;
  id: number;
  name: string;
  email: string;
  role: Role;
  managerId: number | null;
  passwordHash: string;
  resetRequired: boolean;
};

const UserSchema = new Schema<UserDoc>(
  {
    id: { type: Number, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, index: true, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ['employee', 'manager', 'admin'], required: true },
    managerId: { type: Number, default: null },
    passwordHash: { type: String, required: true },
resetRequired: { type: Boolean, default: false }

  },
  { timestamps: true }
);

UserSchema.pre('validate', async function (next) {
  if (this.isNew && (this as any).id == null) {
    (this as any).id = await getNextSeq('users');
  }
  next();
});

export const UserModel = models.User || model<UserDoc>('User', UserSchema);
export const User = UserModel;

/* ----------------------------- Expense model ----------------------------- */
export type TimelineEvt = { at: string; decision: string; comment?: string };

export type ExpenseDoc = {
  _id: any;
  id: number;
  employeeId: number;
  employeeName: string;
  spendDate: string; // ISO string
  category: string;
  amount: number;
  currency: string;
  amountCompanyCcy: number;
  companyCurrency: string;
  status: ExpenseStatus;
  description: string;
  remarks?: string;
  timeline?: TimelineEvt[];
};

const ExpenseSchema = new Schema<ExpenseDoc>(
  {
    id: { type: Number, unique: true, index: true },
    employeeId: { type: Number, required: true },
    employeeName: { type: String, required: true, trim: true },
    spendDate: { type: String, required: true },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, trim: true },
    amountCompanyCcy: { type: Number, required: true },
    companyCurrency: { type: String, required: true, trim: true },
    status: { type: String, enum: ['draft', 'waiting', 'approved', 'rejected', 'submitted'], required: true },
    description: { type: String, required: true, trim: true },
    remarks: { type: String },
    timeline: [{ at: String, decision: String, comment: String }],
  },
  { timestamps: true }
);

ExpenseSchema.pre('validate', async function (next) {
  if (this.isNew && (this as any).id == null) {
    (this as any).id = await getNextSeq('expenses');
  }
  next();
});

export const ExpenseModel = models.Expense || model<ExpenseDoc>('Expense', ExpenseSchema);
export const Expense = ExpenseModel;

/* -------------------------- ApprovalTask model --------------------------- */
export type ApprovalTaskDoc = {
  _id: any;
  id: number;
  expenseId: number;
  ownerName: string;
  category: string;
  amountCompanyCcy: number;
  companyCurrency: string;
  submittedCurrency: string;
};

const ApprovalTaskSchema = new Schema<ApprovalTaskDoc>(
  {
    id: { type: Number, unique: true, index: true },
    expenseId: { type: Number, required: true },
    ownerName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    amountCompanyCcy: { type: Number, required: true },
    companyCurrency: { type: String, required: true, trim: true },
    submittedCurrency: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

ApprovalTaskSchema.pre('validate', async function (next) {
  if (this.isNew && (this as any).id == null) {
    (this as any).id = await getNextSeq('approvalTasks');
  }
  next();
});

export const ApprovalTaskModel =
  models.ApprovalTask || model<ApprovalTaskDoc>('ApprovalTask', ApprovalTaskSchema);
export const ApprovalTask = ApprovalTaskModel;

/* ----------------------------- FlowConfig model -------------------------- */
/** Matches your AdminFlows UI */
export type FlowApprover = { userId: number; required: boolean };
export type FlowConfigDoc = {
  _id: any;
  key: string;                      // e.g. 'default' (for single-tenant demo)
  isManagerFirst: boolean;
  sequenceEnabled: boolean;
  approvers: FlowApprover[];        // picked approvers (manager/admins)
  percentThreshold?: number;        // 1..100
  specificApproverId?: number;      // if this user approves -> auto approve
};

const FlowApproverSchema = new Schema<FlowApprover>(
  {
    userId: { type: Number, required: true },
    required: { type: Boolean, default: true },
  },
  { _id: false }
);

const FlowConfigSchema = new Schema<FlowConfigDoc>(
  {
    key: { type: String, required: true, unique: true, index: true, default: 'default' },
    isManagerFirst: { type: Boolean, default: true },
    sequenceEnabled: { type: Boolean, default: false },
    approvers: { type: [FlowApproverSchema], default: [] },
    percentThreshold: { type: Number, min: 1, max: 100 },
    specificApproverId: { type: Number },
  },
  { timestamps: true }
);

export const FlowConfigModel =
  models.FlowConfig || model<FlowConfigDoc>('FlowConfig', FlowConfigSchema);
export const FlowConfig = FlowConfigModel;
