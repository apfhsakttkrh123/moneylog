import {
  categories, filterExpenses, formatPercent, formatWon, isAmount, isDate, isMonth,
  localDate, monthlyExpenses, offsetMonth, summarize,
} from "./summary.js";
import { loadData, saveData, StorageConflict } from "./storage.js";

const byId = id => document.getElementById(id);
const monthInput = byId("month");
const searchInput = byId("search");
const categoryFilter = byId("category-filter");
const resultCount = byId("result-count");
const dialog = byId("editor");
const form = byId("editor-form");
const fields = form.elements;
const expenseFields = byId("expense-fields");
const budgetFields = byId("budget-fields");
const saveButton = byId("save-editor");
const cancelButton = byId("cancel-editor");
const editorError = byId("editor-error");
const dashboard = byId("dashboard-view");
const ledger = byId("expenses-view");
const budgetButton = document.querySelector("[data-action='budget']");
const addButtons = document.querySelectorAll("[data-action='add']");
const navigation = document.querySelectorAll(".navigation a");

let selectedMonth = localDate().slice(0, 7);
let snapshot = null;
let monthExpenses = [];
let editor = null;
let saving = false;

function load() {
  try {
    snapshot = loadData();
  } catch {
    const warning = byId("storage-error");
    warning.textContent = "저장된 데이터를 읽을 수 없습니다. 브라우저의 사이트 저장 설정을 확인하고 새로고침해 주세요. 저장된 데이터는 그대로 유지됩니다.";
    warning.hidden = false;
  }
}

for (const [key, label] of Object.entries(categories)) {
  categoryFilter.add(new Option(label, key));
  fields.category.add(new Option(label, key));
}
load();
for (const button of [...addButtons, budgetButton]) button.disabled = !snapshot;

function monthLabel(month) {
  const [year, number] = month.split("-").map(Number);
  return year + "년 " + number + "월";
}

function setText(id, value) {
  byId(id).textContent = value;
}

function expenseRow(expense, editable) {
  const row = byId("expense-row").content.firstElementChild.cloneNode(true);
  row.dataset.category = expense.category;
  const category = categories[expense.category];
  row.querySelector(".category-mark").textContent = category.slice(0, 1);
  row.querySelector(".expense-title").textContent = expense.title;
  row.querySelector(".expense-meta").textContent = expense.date.slice(5).replace("-", ".") + " · " + category;
  row.querySelector(".expense-amount").textContent = formatWon(expense.amount);
  if (editable) {
    const memo = row.querySelector(".expense-memo");
    memo.textContent = expense.memo;
    memo.hidden = expense.memo === "";
    const actions = row.querySelector(".row-actions");
    actions.hidden = false;
    for (const button of actions.querySelectorAll("button")) {
      button.dataset.id = expense.id;
      button.setAttribute("aria-label", expense.title + " " + button.textContent.trim());
    }
  }
  return row;
}

function categoryRow(item) {
  const row = byId("category-row").content.firstElementChild.cloneNode(true);
  row.dataset.category = item.category;
  row.querySelector(".category-name").textContent = categories[item.category];
  row.querySelector(".category-amount").textContent = formatWon(item.amount);
  row.querySelector(".category-share").textContent = formatPercent(item.share);
  row.querySelector(".category-track span").style.width = item.share + "%";
  return row;
}

function renderList() {
  const filtered = filterExpenses(monthExpenses, searchInput.value, categoryFilter.value);
  byId("expense-list").replaceChildren(...filtered.map(expense => expenseRow(expense, true)));
  resultCount.textContent = snapshot ? filtered.length + "건" : "";
  byId("list-empty").hidden = filtered.length !== 0;
  const hasFilter = searchInput.value.trim() !== "" || categoryFilter.value !== "";
  setText("list-empty-message", !snapshot ? "지출 내역을 불러올 수 없습니다."
    : hasFilter ? "검색 조건에 맞는 지출이 없습니다." : "이 달에 등록된 지출이 없습니다.");
  byId("list-empty").querySelector("button").hidden = !snapshot || hasFilter;
}

function renderDashboard() {
  const budget = snapshot.data.budgets[selectedMonth];
  const summary = summarize(monthExpenses, budget);
  const hasBudget = summary.balance !== null;
  const exceeded = hasBudget && summary.balance < 0n;

  setText("total-spent", formatWon(summary.total));
  setText("expense-count", "지출 " + monthExpenses.length + "건");
  setText("budget-amount", hasBudget ? formatWon(budget) : "미설정");
  setText("budget-detail", monthLabel(selectedMonth) + " 예산");
  setText("balance-amount", hasBudget ? formatWon(exceeded ? -summary.balance : summary.balance) : "—");
  setText("balance-detail", exceeded ? "예산 초과" : summary.balance === 0n ? "예산 소진" :
    hasBudget ? "이번 달 사용 가능한 금액" : "월 예산을 설정해 주세요.");
  byId("balance-amount").closest(".metric").classList.toggle("over-budget", exceeded);
  budgetButton.textContent = hasBudget ? "예산 수정" : "예산 설정";

  const progress = byId("budget-progress");
  progress.hidden = !hasBudget;
  progress.value = hasBudget ? Math.min(100, summary.usage) : 0;
  progress.classList.toggle("over-budget", exceeded);
  const usageText = hasBudget ? formatPercent(summary.usage) + " 사용" : "예산을 설정하면 사용률을 확인할 수 있습니다.";
  progress.setAttribute("aria-valuetext", usageText);
  setText("budget-usage", usageText);

  byId("category-list").replaceChildren(...summary.byCategory.map(categoryRow));
  byId("category-empty").hidden = summary.byCategory.length !== 0;
  byId("recent-list").replaceChildren(...monthExpenses.slice(0, 5).map(expense => expenseRow(expense, false)));
  byId("recent-empty").hidden = monthExpenses.length !== 0;
}

function renderMonth() {
  monthInput.value = selectedMonth;
  setText("month-caption", monthLabel(selectedMonth));
  byId("previous-month").disabled = offsetMonth(selectedMonth, -1) === selectedMonth;
  byId("next-month").disabled = offsetMonth(selectedMonth, 1) === selectedMonth;
  if (snapshot) {
    monthExpenses = monthlyExpenses(snapshot.data.expenses, selectedMonth);
    renderDashboard();
  } else {
    for (const id of ["recent-empty", "category-empty", "budget-usage"]) byId(id).hidden = true;
  }
  renderList();
}

function showPage() {
  const onLedger = location.hash === "#expenses";
  dashboard.hidden = onLedger;
  ledger.hidden = !onLedger;
  setText("page-title", onLedger ? "지출 내역" : "월간 대시보드");
  for (const link of navigation) {
    const current = link.hash === (onLedger ? "#expenses" : "#dashboard");
    if (current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

window.addEventListener("hashchange", () => {
  if (location.hash === "#main") return;
  showPage();
  byId("page-title").focus();
});

function changeMonth(value) {
  if (isMonth(value)) selectedMonth = value;
  renderMonth();
}

monthInput.addEventListener("change", () => {
  if (isMonth(monthInput.value)) changeMonth(monthInput.value);
});
monthInput.addEventListener("blur", () => { monthInput.value = selectedMonth; });
byId("previous-month").addEventListener("click", () => changeMonth(offsetMonth(selectedMonth, -1)));
byId("next-month").addEventListener("click", () => changeMonth(offsetMonth(selectedMonth, 1)));
searchInput.addEventListener("input", renderList);
categoryFilter.addEventListener("change", renderList);

const editorTitles = { add: "지출 등록", edit: "지출 수정", delete: "지출 삭제", budget: "월 예산 설정" };

function openEditor(action, expense, trigger) {
  const isExpense = action === "add" || action === "edit";
  const isBudget = action === "budget";
  const isDelete = action === "delete";
  editor = { action, expense, month: selectedMonth, trigger };
  form.reset();
  editorError.hidden = true;

  expenseFields.hidden = expenseFields.disabled = !isExpense;
  budgetFields.hidden = budgetFields.disabled = !isBudget;
  setText("editor-title", editorTitles[action]);
  setText("editor-month", monthLabel(selectedMonth));
  byId("editor-month").hidden = !isBudget;
  byId("delete-message").hidden = !isDelete;
  saveButton.textContent = isDelete ? "삭제" : "저장";
  saveButton.classList.toggle("danger", isDelete);
  saveButton.classList.toggle("primary", !isDelete);

  if (isExpense) {
    const today = localDate();
    const defaultDate = today.startsWith(selectedMonth) ? today : selectedMonth + "-01";
    fields.date.value = expense?.date ?? defaultDate;
    fields.title.value = expense?.title ?? "";
    fields.category.value = expense?.category ?? "";
    fields.amount.value = expense?.amount ?? "";
    fields.memo.value = expense?.memo ?? "";
  } else if (isBudget) {
    fields.budget.value = snapshot.data.budgets[selectedMonth] ?? "";
  } else {
    setText("delete-message", "‘" + expense.title + "’ 지출을 삭제하시겠어요?");
  }

  dialog.showModal();
  if (isExpense) fields.title.focus();
  else if (isBudget) fields.budget.focus();
  else cancelButton.focus();
}

document.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button || button.disabled || !snapshot || dialog.open) return;
  const action = button.dataset.action;
  const expense = monthExpenses.find(item => item.id === button.dataset.id);
  if ((action === "edit" || action === "delete") && !expense) return;
  openEditor(action, expense, button);
});

cancelButton.addEventListener("click", () => dialog.close());
dialog.addEventListener("cancel", event => {
  if (saving) event.preventDefault();
});
dialog.addEventListener("close", () => {
  if (dialog.open) return;
  const trigger = editor?.trigger;
  editor = null;
  if (trigger?.isConnected && !trigger.closest("[hidden]")) trigger.focus();
  else if (!ledger.hidden) searchInput.focus();
  else navigation[0].focus();
});

function showEditorError(message, field) {
  editorError.textContent = message;
  editorError.hidden = false;
  field?.focus();
}

function nextData(action, expense, month) {
  const { data } = snapshot;
  if (action === "budget") {
    const budget = fields.budget.valueAsNumber;
    if (!isAmount(budget)) {
      showEditorError("예산은 1원 이상의 정수로 입력해 주세요.", fields.budget);
      return null;
    }
    return { ...data, budgets: { ...data.budgets, [month]: budget } };
  }

  if (action === "delete") {
    return { ...data, expenses: data.expenses.filter(item => item.id !== expense.id) };
  }

  const date = fields.date.value;
  const title = fields.title.value.trim();
  const category = fields.category.value;
  const amount = fields.amount.valueAsNumber;
  const checks = [
    [isDate(date), fields.date, "올바른 날짜를 입력해 주세요."],
    [title !== "", fields.title, "지출명을 입력해 주세요."],
    [Object.hasOwn(categories, category), fields.category, "카테고리를 선택해 주세요."],
    [isAmount(amount), fields.amount, "금액은 1원 이상의 정수로 입력해 주세요."],
  ];
  const invalid = checks.find(([valid]) => !valid);
  if (invalid) {
    const [, field, message] = invalid;
    showEditorError(message, field);
    return null;
  }

  const entry = { id: expense?.id ?? crypto.randomUUID(), date, title, category, amount, memo: fields.memo.value.trim() };
  const expenses = expense
    ? data.expenses.map(item => item.id === expense.id ? entry : item)
    : [entry, ...data.expenses];
  return { ...data, expenses };
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!editor || saving) return;
  const { action, expense, month } = editor;
  editorError.hidden = true;
  saving = saveButton.disabled = cancelButton.disabled = true;
  try {
    const data = nextData(action, expense, month);
    if (!data) return;
    const raw = await saveData(snapshot.raw, data);
    snapshot = { raw, data };
    if (action === "edit" || action === "add") {
      selectedMonth = fields.date.value.slice(0, 7);
      searchInput.value = "";
      categoryFilter.value = "";
    }
    renderMonth();
    dialog.close();
    const messages = { add: "지출을 등록했습니다.", edit: "지출을 수정했습니다.",
      delete: "지출을 삭제했습니다.", budget: "월 예산을 저장했습니다." };
    setText("announcement", messages[action]);
  } catch (error) {
    showEditorError(error instanceof StorageConflict
      ? "다른 탭에서 기록이 변경되었습니다. 입력 내용을 확인한 뒤 이 페이지를 새로고침해 주세요."
      : "저장하지 못했습니다. 브라우저의 사이트 저장 설정을 확인한 뒤 다시 시도해 주세요.");
  } finally {
    saving = saveButton.disabled = cancelButton.disabled = false;
  }
});

showPage();
renderMonth();
