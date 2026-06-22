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

// Net balance = (amount this person fronted as payer) - (amount of their own
// consumption across all itemized expenses). Positive = they're owed money,
// negative = they owe money.
export function computeNetBalances(
  people: BalancePerson[],
  expenses: ExpenseForBalance[],
  items: ExpenseItemForBalance[]
): NetBalance[] {
  const paid: Record<string, number> = {};
  const consumed: Record<string, number> = {};
  for (const p of people) {
    paid[p.id] = 0;
    consumed[p.id] = 0;
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

  return people.map((p) => ({
    personId: p.id,
    name: p.name,
    amount: Math.round((paid[p.id] - consumed[p.id]) * 100) / 100,
  }));
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
