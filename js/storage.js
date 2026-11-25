import { categories, isAmount, isDate, isMonth } from "./summary.js";

export const STORAGE_KEY = "moneylog:v1";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validExpense(expense) {
  return isRecord(expense)
    && typeof expense.id === "string" && expense.id.trim() !== ""
    && isDate(expense.date)
    && typeof expense.title === "string" && expense.title.trim() !== ""
    && typeof expense.category === "string" && Object.hasOwn(categories, expense.category)
    && isAmount(expense.amount)
    && typeof expense.memo === "string";
}

function readData(raw) {
  if (raw === null) return { version: 1, expenses: [], budgets: {} };

  const data = JSON.parse(raw);
  if (!isRecord(data) || data.version !== 1
      || !Array.isArray(data.expenses) || !data.expenses.every(validExpense)
      || !isRecord(data.budgets)
      || !Object.entries(data.budgets).every(([month, amount]) => isMonth(month) && isAmount(amount))) {
    throw new Error("저장 데이터 형식이 올바르지 않습니다.");
  }

  if (new Set(data.expenses.map(expense => expense.id)).size !== data.expenses.length) {
    throw new Error("지출 기록의 ID가 중복되었습니다.");
  }

  return data;
}

export class StorageConflict extends Error {}

export function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return { raw, data: readData(raw) };
}

export async function saveData(expectedRaw, data) {
  const save = () => {
    if (localStorage.getItem(STORAGE_KEY) !== expectedRaw) throw new StorageConflict();
    const raw = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, raw);
    return raw;
  };

  // When available, serialize the read and write across this app's tabs.
  return navigator.locks ? navigator.locks.request(STORAGE_KEY, save) : save();
}
