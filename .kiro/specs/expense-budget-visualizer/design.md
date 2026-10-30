# Design Document

## Overview

The Expense & Budget Visualizer is a single-page, client-side web application delivered as plain HTML, CSS, and Vanilla JavaScript — no build step, no framework, no backend. All application state is stored in the browser's `localStorage`. The app runs directly in any modern browser (Chrome, Firefox, Edge, Safari) and is structured around one HTML file, one CSS file (`css/styles.css`), and one JavaScript file (`js/app.js`).

The core interaction loop is:

1. User enters a transaction in the Input Form.
2. The app validates input, creates a Transaction object, saves it to `localStorage`, and triggers a UI refresh.
3. The Transaction List, Balance display, and Chart are all re-rendered from the single source of truth in `localStorage`.

All side-effecting UI updates (add, delete, filter, sort, theme toggle, budget limit set) follow the same pattern: mutate in-memory state → persist to `localStorage` → re-render affected components.

---

## Architecture

The application follows a **unidirectional data-flow** architecture entirely in a single JavaScript module:

```
User Action
    │
    ▼
Event Handler (in app.js)
    │
    ▼
State Mutation (in-memory AppState object)
    │
    ▼
Persistence (localStorage.setItem)
    │
    ▼
Render (DOM update functions)
```

Because there is no virtual DOM or framework, rendering functions directly manipulate the DOM. Each render function is idempotent — calling it multiple times with the same state produces the same DOM.

### File Structure

```
/
├── index.html
├── css/
│   └── styles.css        ← exactly one CSS file
└── js/
    └── app.js            ← exactly one JS file
```

Chart.js is loaded from a CDN `<script>` tag in `index.html` (no npm install required):

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
```

### Rendering Strategy

All rendering is triggered by a central `render()` function that orchestrates five sub-renders:

```
render()
  ├── renderBalance()
  ├── renderTransactionList()
  ├── renderChart()
  ├── renderBudgetWarnings()
  └── renderCategorySelects()
```

`render()` reads from `AppState` (the single source of truth) and applies the active sort and month filter before passing data to each sub-renderer.

---

## Components and Interfaces

### AppState (in-memory singleton)

```js
const AppState = {
  transactions: [],      // Transaction[]
  categories: [],        // string[]  (built-ins + custom)
  budgetLimits: {},      // { [categoryName]: number }
  sortOption: null,      // SortOption | null
  monthFilter: null,     // { year: number, month: number } | null  (1-indexed month)
  theme: 'system',       // 'light' | 'dark' | 'system'
};
```

### Transaction Object

```js
{
  id: string,            // crypto.randomUUID() or Date.now().toString() fallback
  name: string,          // 1–100 chars
  amount: number,        // 0.01–999,999,999.99, stored as JS number (float)
  category: string,      // must match a name in AppState.categories
  date: string,          // ISO 8601 string, e.g. "2024-10-26T14:35:00.000Z"
}
```

### SortOption Enum

```js
// Stored as a string in localStorage key "sortOption"
const SORT_OPTIONS = {
  AMOUNT_ASC:    'amount_asc',
  AMOUNT_DESC:   'amount_desc',
  CATEGORY_ASC:  'category_asc',
  CATEGORY_DESC: 'category_desc',
};
```

### Input Form Component

- **DOM id**: `#transaction-form`
- **Fields**: `#input-name` (text), `#input-amount` (number), `#input-category` (select)
- **Validation**: runs on `submit` event before any state mutation
- **Error display**: inline `<span class="field-error">` elements adjacent to each field; cleared on next submit attempt

### Transaction List Component

- **DOM id**: `#transaction-list`
- **Rendered by**: `renderTransactionList(filteredSortedTransactions)`
- Each row is a `<li>` containing: name, amount (formatted), category badge, date, delete button
- Delete button fires `handleDelete(id)` which removes from `AppState`, persists, and calls `render()`
- Empty state: renders a `<p class="empty-state">` message when the filtered list is empty

### Balance Display Component

- **DOM id**: `#balance-display`
- Rendered by `renderBalance(filteredTransactions)` as `$X,XXX.XX` or `-$X,XXX.XX`

### Chart Component

- **DOM id**: `<canvas id="spending-chart">`
- Managed by a Chart.js instance stored in `let chartInstance = null`
- `renderChart(filteredTransactions)`: if `chartInstance` exists, calls `chartInstance.destroy()` then recreates; otherwise creates new
- Empty state: hides `<canvas>` and shows `#chart-empty-message` when no transactions exist

### Category Manager Component

- **DOM id**: `#add-category-form`
- **Field**: `#input-category-name` (text, max 50 chars)
- Validation: non-empty, ≤ 50 chars, case-insensitive uniqueness check against `AppState.categories`
- On success: pushes to `AppState.categories`, persists, calls `renderCategorySelects()`

### Month Filter Component

- **DOM id**: `#month-filter` (a `<input type="month">` element)
- Change event sets `AppState.monthFilter` and calls `render()`
- Clear button resets `AppState.monthFilter = null` and calls `render()`

### Sort Controls Component

- **DOM id**: `#sort-controls`
- Radio buttons or a `<select>` with values matching `SORT_OPTIONS`
- Change event sets `AppState.sortOption`, persists to `localStorage`, calls `render()`

### Budget Limit Component

- **DOM id**: `#budget-form`
- **Fields**: `#budget-category` (select), `#budget-amount` (number)
- Validation: same numeric rules as transaction amounts
- On success: sets `AppState.budgetLimits[category]`, persists, calls `render()`

### Theme Toggle Component

- **DOM id**: `#theme-toggle` (checkbox or button)
- On change: sets `AppState.theme`, persists, applies `data-theme` attribute to `<html>` element
- Theme CSS uses `[data-theme="dark"]` selector to override variables

---

## Data Models

### localStorage Keys

| Key | Type | Description |
|---|---|---|
| `"transactions"` | JSON string → `Transaction[]` | All transaction records |
| `"categories"` | JSON string → `string[]` | Custom categories only (built-ins always added at runtime) |
| `"budgetLimits"` | JSON string → `{ [name]: number }` | Per-category budget limits |
| `"sortOption"` | plain string | Active sort option or absent |
| `"theme"` | plain string | `"light"` / `"dark"` / absent |

Built-in categories (`["Food", "Transport", "Fun"]`) are always prepended in memory at load time and are **not** written to `localStorage` — only custom categories are persisted separately (satisfying Requirement 6.5).

### Serialization / Deserialization

```js
function saveTransactions(transactions) {
  localStorage.setItem('transactions', JSON.stringify(transactions));
}

function loadTransactions() {
  try {
    const raw = localStorage.getItem('transactions');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Not an array');
    return parsed.filter(isValidTransaction); // schema guard
  } catch {
    showNonBlockingWarning('Could not load saved data. Starting fresh.');
    return [];
  }
}
```

`isValidTransaction(t)` checks:
- `t.id` is a non-empty string
- `t.name` is a non-empty string ≤ 100 chars
- `t.amount` is a finite number in `[0.01, 999_999_999.99]`
- `t.category` is a non-empty string
- `t.date` is a valid ISO 8601 date string

### Computed Values

- **Balance**: `transactions.reduce((sum, t) => sum + t.amount, 0)`
- **Category totals**: `transactions.reduce((acc, t) => { acc[t.category] = (acc[t.category] ?? 0) + t.amount; return acc; }, {})`
- **Filtered transactions**: `transactions.filter(t => matchesMonthFilter(t, AppState.monthFilter))`
- **Sorted transactions**: applied after filtering using `Array.prototype.sort` with a stable comparator (tie-broken by descending date)

### Formatting Helpers

```js
function formatCurrency(amount) {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Transaction Serialization Round-Trip

*For any* valid collection of Transaction objects, serializing the collection to JSON and then deserializing it SHALL produce a collection that is identical in item count, item order, and all named per-item fields (`id`, `name`, `amount`, `category`, `date`).

**Validates: Requirements 5.5**

---

### Property 2: Input Validation Rejects Invalid Amounts

*For any* amount string that is zero, negative, non-numeric, exceeds 999,999,999.99, or has more than 2 decimal places, the validation function SHALL return a failure result and the Transaction collection SHALL remain unchanged.

**Validates: Requirements 1.4**

---

### Property 3: Whitespace-Only Names Are Rejected

*For any* item name string composed entirely of whitespace characters (space, tab, newline, etc.), the validation function SHALL reject it and the Transaction collection SHALL remain unchanged.

**Validates: Requirements 1.3**

---

### Property 4: Balance Equals Sum of Filtered Amounts

*For any* collection of Transactions and any month filter (including no filter), the displayed Balance SHALL equal the arithmetic sum of the `amount` fields of all Transactions that pass the filter.

**Validates: Requirements 3.2, 3.3, 7.4**

---

### Property 5: Sort Stability and Correctness

*For any* collection of Transactions and any sort option, the sorted output SHALL satisfy the sort predicate for every adjacent pair, and for any two Transactions with equal sort-key values, the one with the more recent `date` SHALL appear first.

**Validates: Requirements 8.1, 8.3**

---

### Property 6: Category Uniqueness Invariant

*For any* sequence of add-category operations, the resulting category list SHALL never contain two entries that are equal when compared case-insensitively.

**Validates: Requirements 6.3**

---

### Property 7: Budget Warning Consistency

*For any* collection of Transactions and any set of Budget_Limits, a category SHALL be in the "over budget" state if and only if the sum of its Transaction amounts strictly exceeds its Budget_Limit, and SHALL be in the "within budget" state otherwise.

**Validates: Requirements 9.2, 9.3, 9.4**

---

### Property 8: Month Filter Exclusion

*For any* collection of Transactions and any active month-year filter, every Transaction in the filtered result SHALL have a `date` within the selected calendar month and year, and no Transaction outside that month/year SHALL appear.

**Validates: Requirements 7.1, 7.2**

---

## Error Handling

| Scenario | Handling |
|---|---|
| `localStorage` unavailable (private browsing, quota exceeded) | Wrap all `localStorage` calls in `try/catch`; show non-blocking `<div class="warning-banner">` at top of page; app continues in memory-only mode |
| Corrupt or schema-invalid data in `localStorage` | `loadTransactions()` / `loadCategories()` catch parse errors; initialize with empty collections; show non-blocking warning |
| Chart.js CDN unavailable | `window.onerror` or `<script onerror>` handler hides `#chart-section` and shows a static fallback message |
| User submits invalid form data | Inline `<span class="field-error">` messages adjacent to each offending field; form is not submitted; focus moved to first errored field |
| `crypto.randomUUID()` unavailable (old browser) | Fallback: `Date.now().toString(36) + Math.random().toString(36).slice(2)` |
| Negative balance | Allowed (by design — balance is sum of expenses, could theoretically be used for credits); formatted as `-$X.XX` |

---

## Testing Strategy

### Unit Tests (example-based)

Unit tests cover specific scenarios and edge cases for pure helper functions and validation logic. Since this is a Vanilla JS app with no build tooling required, tests can be written using a lightweight runner such as [QUnit](https://qunitjs.com/) loaded from CDN into a `test.html` page, or using Node.js with the built-in `assert` module.

Focus areas:

- **`formatCurrency`**: `$0.00`, `$1,234.56`, `-$50.00`, `$999,999,999.99`
- **`validateTransactionInput`**: empty name, whitespace name, amount = 0, amount = -1, amount = 1000000000, amount with 3 decimal places, valid input
- **`validateCategoryInput`**: empty string, 51-char string, duplicate (case-insensitive), valid new name
- **`validateBudgetInput`**: same numeric rules as transaction amount
- **`loadTransactions`**: non-array JSON, missing fields, extra fields (should be ignored), empty array, valid array
- **`sortTransactions`**: ascending/descending by amount and category; tie-breaking by date
- **`filterByMonth`**: transactions in target month, transactions outside, edge of month boundary, no filter active
- **`computeBalance`**: empty list, single item, multiple items, rounding accumulation

### Property-Based Tests

Property-based tests verify the correctness properties identified in this document. Use [fast-check](https://github.com/dubzzz/fast-check) (loadable from CDN or via `npm i fast-check` for a Node-based test script).

Each test runs a minimum of **100 iterations**.

**Property 1 — Serialization round-trip**
```
Feature: expense-budget-visualizer, Property 1: Transaction Serialization Round-Trip
```
Generate arbitrary arrays of valid Transaction objects. Assert `loadTransactions(saveTransactions(txns))` returns a collection equal in count, order, and all fields.

**Property 2 — Invalid amount rejection**
```
Feature: expense-budget-visualizer, Property 2: Input Validation Rejects Invalid Amounts
```
Generate invalid amount strings (zero, negative, > 999999999.99, > 2 decimal places, non-numeric). Assert `validateAmountInput(s)` returns a failure for all of them.

**Property 3 — Whitespace name rejection**
```
Feature: expense-budget-visualizer, Property 3: Whitespace-Only Names Are Rejected
```
Generate strings composed entirely of `\s` characters. Assert `validateNameInput(s)` returns a failure.

**Property 4 — Balance equals sum**
```
Feature: expense-budget-visualizer, Property 4: Balance Equals Sum of Filtered Amounts
```
Generate arbitrary transaction arrays and optional month filters. Assert `computeBalance(filterByMonth(txns, filter))` equals `txns.filter(matchesFilter).reduce((s, t) => s + t.amount, 0)`.

**Property 5 — Sort stability**
```
Feature: expense-budget-visualizer, Property 5: Sort Stability and Correctness
```
Generate arbitrary transaction arrays and sort options. Assert adjacent-pair order invariant and date-based tie-breaking.

**Property 6 — Category uniqueness**
```
Feature: expense-budget-visualizer, Property 6: Category Uniqueness Invariant
```
Generate sequences of category add operations (mix of valid, duplicate, empty). Assert resulting list has no case-insensitive duplicates.

**Property 7 — Budget warning consistency**
```
Feature: expense-budget-visualizer, Property 7: Budget Warning Consistency
```
Generate transaction arrays and budget limit maps. Assert `isOverBudget(category, txns, limits)` ↔ `categoryTotal(category, txns) > limits[category]`.

**Property 8 — Month filter exclusion**
```
Feature: expense-budget-visualizer, Property 8: Month Filter Exclusion
```
Generate transaction arrays spanning multiple months and a target month-year. Assert every item in `filterByMonth(txns, filter)` has a date in the target month/year, and no item outside it appears.

### Integration / Smoke Tests

- Load `index.html` in each target browser and verify:
  - Initial render shows empty state messages (no transactions)
  - Adding a transaction updates balance, list, and chart
  - Deleting the last transaction shows empty-state messages
  - Refreshing the page restores all data from `localStorage`
  - Theme toggle applies immediately and persists across reload
  - Month filter hides transactions outside the selected period
