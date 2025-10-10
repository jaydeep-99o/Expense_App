export type JWTPayload = { uid: number; role: 'ADMIN'|'MANAGER'|'EMPLOYEE' }

export type ApprovalTaskDTO = {
  id: number
  expenseId: number
  ownerName: string
  category: string
  amountCompanyCcy: number
  companyCurrency: string
  submittedCurrency: string
}
