import { getHistory } from "./db.js";

export function createSnapshot() {
  const rows = getHistory();
  
  // Hitung saldo per akun secara manual dari history
  const balances = rows.reduce((acc, curr) => {
    acc[curr.account] = (acc[curr.account] || 0) + curr.amount;
    return acc;
  }, {});

  return {
    timestamp: new Date().toISOString(),
    balances: Object.entries(balances).map(([account, balance]) => ({ account, balance }))
  };
}

export function getSnapshot() {
  return createSnapshot();
}
