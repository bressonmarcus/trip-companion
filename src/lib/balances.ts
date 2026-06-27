export type BalancePerson = { id: string; name: string };

export type ExpenseForBalance = {
  id: string;
  payer_id: string;
  total_amount: number;
};

export type ExpenseItemForBalance = {
  expense_id: string;
  price: number;
  shared_by: string[];
};

export type NetBalance = { personId: string; name: string; amount: number };

export type SettlePayment = {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
};

// A recorded settle-up: a batch of payments that have actually been made.
export type SettlementForBalance = { payments: SettlePayment[] };

// Net balance = (amount this person fronted as payer) - (amount of their own
// consumption across all itemized expenses) + (settle-up payments already made).
// Positive = they're owed money, negative = they owe money.
//
// Settlements must be included here: a recorded payment from A to B means A has
// paid down their debt, so A's balance moves up and B's moves down by the same
// amount. Leaving them out makes already-settled debt reappear every time the
// balances are recomputed (the original "settle up does nothing" bug).
export function computeNetBalances(
  people: BalancePerson[],
  expenses: ExpenseForBalance[],
  items: ExpenseItemForBalance[],
  settlements: SettlementForBalance[] = []
): NetBalance[] {
  const paid: Record<string, number> = {};
  const consumed: Record<string, number> = {};
  const settled: Record<string, number> = {};
  for (const p of people) {
    paid[p.id] = 0;
    consumed[p.id] = 0;
    settled[p.id] = 0;
  }

  for (const expense of expenses) {
    if (paid[expense.payer_id] != null) {
      paid[expense.payer_id] += Number(expense.total_amount) || 0;
    }
  }

  for (const item of items) {
    const sharedBy = item.shared_by.filter((id) => consumed[id] != null);
    if (sharedBy.length === 0) continue;
    const perPerson = (Number(item.price) || 0) / sharedBy.length;
    for (const id of sharedBy) {
      consumed[id] += perPerson;
    }
  }

  for (const settlement of settlements) {
    for (const pay of settlement.payments ?? []) {
      const amount = Number(pay.amount) || 0;
      if (settled[pay.fromId] != null) settled[pay.fromId] += amount;
      if (settled[pay.toId] != null) settled[pay.toId] -= amount;
    }
  }

  return people.map((p) => ({
    personId: p.id,
    name: p.name,
    amount: Math.round((paid[p.id] - consumed[p.id] + settled[p.id]) * 100) / 100,
  }));
}

// A correct ledger always nets to zero. If it doesn't, some receipt's items
// don't add up to its total (money was credited to a payer that nobody was
// charged for, or vice-versa). Returns the signed imbalance, rounded.
export function balanceImbalance(balances: NetBalance[]): number {
  return Math.round(balances.reduce((sum, b) => sum + b.amount, 0) * 100) / 100;
}

// Greedy debt simplification: repeatedly match the biggest creditor with the
// biggest debtor until everyone nets to (near) zero. Produces a minimal-ish
// set of suggested settle-up payments, Splitwise-style.
export function simplifyDebts(balances: NetBalance[]): SettlePayment[] {
  const EPS = 0.01;
  const creditors = balances
    .filter((b) => b.amount > EPS)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((b) => b.amount < -EPS)
    .map((b) => ({ ...b, amount: -b.amount }))
    .sort((a, b) => b.amount - a.amount);

  const payments: SettlePayment[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.round(Math.min(creditor.amount, debtor.amount) * 100) / 100;
    if (amount > EPS) {
      payments.push({
        fromId: debtor.personId,
        fromName: debtor.name,
        toId: creditor.personId,
        toName: creditor.name,
        amount,
      });
    }
    creditor.amount -= amount;
    debtor.amount -= amount;
    if (creditor.amount <= EPS) ci++;
    if (debtor.amount <= EPS) di++;
  }
  return payments;
}
