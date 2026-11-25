export const categories = Object.freeze({
  food: "식비",
  transport: "교통",
  shopping: "쇼핑",
  daily: "생활",
  other: "기타",
});

const numberFormat = new Intl.NumberFormat("ko-KR");
const percentFormat = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });

export function formatWon(amount) {
  return numberFormat.format(amount) + "원";
}

export function formatPercent(value) {
  if (value > 0 && value < 0.1) return "0.1% 미만";
  return percentFormat.format(value) + "%";
}

export function isMonth(value) {
  return typeof value === "string" && /^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function isDate(value) {
  if (typeof value !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  if (!isMonth(value.slice(0, 7))) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isAmount(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function localDate(now = new Date()) {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

export function offsetMonth(value, offset) {
  const [year, month] = value.split("-").map(Number);
  const index = year * 12 + month - 1 + offset;
  if (index < 12 || index >= 10000 * 12) return value;
  const nextYear = String(Math.floor(index / 12)).padStart(4, "0");
  const nextMonth = String(index % 12 + 1).padStart(2, "0");
  return nextYear + "-" + nextMonth;
}

export function monthlyExpenses(expenses, month) {
  return expenses
    .filter(expense => expense.date.slice(0, 7) === month)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function summarize(expenses, budget) {
  const amounts = new Map();
  let total = 0n;
  for (const expense of expenses) {
    const value = BigInt(expense.amount);
    total += value;
    amounts.set(expense.category, (amounts.get(expense.category) ?? 0n) + value);
  }

  const byCategory = [...amounts]
    .sort(([, a], [, b]) => b > a ? 1 : b < a ? -1 : 0)
    .map(([category, amount]) => ({
      category,
      amount,
      share: Number(amount) / Number(total) * 100,
    }));

  return {
    total,
    byCategory,
    balance: budget === undefined ? null : BigInt(budget) - total,
    usage: budget === undefined ? null : Number(total) / budget * 100,
  };
}

export function filterExpenses(expenses, keyword, category) {
  const query = keyword.trim().normalize("NFC").toLocaleLowerCase("ko-KR");
  return expenses.filter(expense => {
    if (category && expense.category !== category) return false;
    return [expense.title, expense.memo].some(text =>
      text.normalize("NFC").toLocaleLowerCase("ko-KR").includes(query)
    );
  });
}
