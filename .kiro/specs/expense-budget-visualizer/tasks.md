# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a single-page, client-side web application using HTML, CSS, and Vanilla JavaScript. The app follows a unidirectional data-flow architecture: all user actions mutate an in-memory `AppState`, persist to `localStorage`, and trigger a central `render()` call. Chart.js is loaded from CDN. No build step or backend is required.

## Tasks

- [x] 1. Set up project structure and HTML scaffold
  - Create `index.html` with semantic layout sections: balance display, transaction form, transaction list, chart canvas, category manager, month filter, sort controls, budget form, theme toggle
  - Load Chart.js from CDN (`https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js`) via `<script>` tag with an `onerror` fallback handler
  - Create `css/styles.css` with CSS custom properties for light and dark themes using `[data-theme="dark"]` selector overrides
  - Create `js/app.js` as an empty module — all subsequent tasks add code here
  - Wire all DOM element `id` attributes as specified in the design (`#transaction-form`, `#transaction-list`, `#balance-display`, `#spending-chart`, `#add-category-form`, `#month-filter`, `#sort-controls`, `#budget-form`, `#theme-toggle`)
  - _Requirements: 11.4_

- [x] 2. Implement AppState, localStorage helpers, and serialization
  - [x] 2.1 Define `AppState` singleton and `SORT_OPTIONS` constant
    - Declare `AppState` with fields: `transactions`, `categories`, `budgetLimits`, `sortOption`, `monthFilter`, `theme`
    - Declare `SORT_OPTIONS` enum object with four string values
    - _Requirements: 5.1, 5.2, 5.3, 8.1_

  - [ ]* 2.2 Write property test for Transaction serialization round-trip
    - **Property 1: Transaction Serialization Round-Trip**
    - **Validates: Requirements 5.5**
    - Use fast-check to generate arbitrary valid `Transaction[]` arrays; assert that `loadTransactions(saveTransactions(txns))` returns a collection equal in count, order, and all named fields (`id`, `name`, `amount`, `category`, `date`)

  - [x] 2.3 Implement `saveTransactions`, `loadTransactions`, `saveCategories`, `loadCategories`, `saveBudgetLimits`, `loadBudgetLimits`, `saveSortOption`, `loadSortOption`, `saveTheme`, `loadTheme`
    - Wrap all `localStorage` calls in `try/catch`; on failure show non-blocking `<div class="warning-banner">` and continue in memory-only mode
    - `loadTransactions` must call `isValidTransaction(t)` to filter corrupt records and show non-blocking warning on parse failure
    - Built-in categories `["Food", "Transport", "Fun"]` are always prepended in memory and NOT written to `localStorage`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.4, 6.5, 8.4, 10.3_

- [x] 3. Implement validation helpers
  - [x] 3.1 Implement `validateNameInput(name)` and `validateAmountInput(str)` and `validateCategoryInput(name, existingCategories)` and `validateBudgetInput(str)`
    - `validateNameInput`: reject empty string and whitespace-only strings; enforce max 100 chars
    - `validateAmountInput`: reject zero, negative, non-numeric, > 999,999,999.99, > 2 decimal places
    - `validateCategoryInput`: reject empty, > 50 chars, case-insensitive duplicate against `existingCategories`
    - `validateBudgetInput`: same numeric rules as `validateAmountInput`
    - Each function returns a `{ valid: boolean, error?: string }` result object
    - _Requirements: 1.3, 1.4, 6.2, 6.3, 9.1, 9.6_

  - [ ]* 3.2 Write property test for invalid amount rejection
    - **Property 2: Input Validation Rejects Invalid Amounts**
    - **Validates: Requirements 1.4**
    - Generate invalid amount strings (zero, negative, > 999,999,999.99, > 2 decimal places, non-numeric); assert `validateAmountInput(s).valid === false` for all

  - [ ]* 3.3 Write property test for whitespace name rejection
    - **Property 3: Whitespace-Only Names Are Rejected**
    - **Validates: Requirements 1.3**
    - Generate strings composed entirely of whitespace characters; assert `validateNameInput(s).valid === false` for all

  - [ ]* 3.4 Write property test for category uniqueness invariant
    - **Property 6: Category Uniqueness Invariant**
    - **Validates: Requirements 6.3**
    - Generate sequences of add-category operations (mix of valid, duplicate, empty); simulate the add logic using `validateCategoryInput`; assert the resulting category list has no case-insensitive duplicates

- [x] 4. Implement formatting helpers and computed value functions
  - [x] 4.1 Implement `formatCurrency(amount)`, `formatDate(isoString)`, `computeBalance(transactions)`, `computeCategoryTotals(transactions)`
    - `formatCurrency`: output `$X,XXX.XX` or `-$X,XXX.XX` using `toLocaleString('en-US', …)`
    - `computeBalance`: sum `amount` fields using `reduce`
    - `computeCategoryTotals`: return `{ [categoryName]: number }` map
    - _Requirements: 3.4, 3.5, 3.6_

  - [x] 4.2 Implement `filterByMonth(transactions, monthFilter)` and `sortTransactions(transactions, sortOption)`
    - `filterByMonth`: when `monthFilter` is null return all; otherwise return only transactions whose ISO date falls in the given `{ year, month }`
    - `sortTransactions`: implement all four `SORT_OPTIONS`; tie-break by descending date using a stable comparator
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.3_

  - [ ]* 4.3 Write property test for Balance equals sum of filtered amounts
    - **Property 4: Balance Equals Sum of Filtered Amounts**
    - **Validates: Requirements 3.2, 3.3, 7.4**
    - Generate arbitrary transaction arrays and optional month filters; assert `computeBalance(filterByMonth(txns, filter))` equals the manually computed sum

  - [ ]* 4.4 Write property test for sort stability and correctness
    - **Property 5: Sort Stability and Correctness**
    - **Validates: Requirements 8.1, 8.3**
    - Generate arbitrary transaction arrays and a sort option; assert every adjacent pair satisfies the sort predicate and that equal-key pairs are ordered by descending date

  - [ ]* 4.5 Write property test for month filter exclusion
    - **Property 8: Month Filter Exclusion**
    - **Validates: Requirements 7.1, 7.2**
    - Generate transaction arrays spanning multiple months and a target month-year filter; assert every result item has a date in the target month/year and no item outside it appears

- [ ] 5. Checkpoint — Ensure all helper tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement render functions
  - [x] 6.1 Implement `renderBalance(filteredTransactions)`
    - Read from `computeBalance`; write formatted output to `#balance-display`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 6.2 Implement `renderTransactionList(filteredSortedTransactions)`
    - Build `<li>` rows: item name, formatted amount, category badge, formatted date, delete button with `data-id`
    - Show `<p class="empty-state">` message when list is empty
    - Apply visually distinct background to rows whose category is over budget (read from `AppState.budgetLimits` and `computeCategoryTotals`)
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 9.2_

  - [x] 6.3 Implement `renderChart(filteredTransactions)`
    - Destroy existing `chartInstance` before recreating
    - Show `#chart-empty-message` and hide `<canvas>` when no transactions; otherwise render pie chart with per-category slices, percentage labels, and matching legend colors
    - Handle Chart.js CDN unavailability via `window.onerror` / `<script onerror>` fallback
    - _Requirements: 4.1, 4.4, 4.5_

  - [x] 6.4 Implement `renderBudgetWarnings(filteredTransactions)`
    - For each category whose total exceeds its `AppState.budgetLimits` value, render a warning message identifying the category and excess amount in `#budget-warnings`
    - Remove warnings for categories at or below their limit
    - _Requirements: 9.3, 9.4_

  - [x] 6.5 Implement `renderCategorySelects()`
    - Populate `#input-category` and `#budget-category` selects with all categories (`AppState.categories`)
    - _Requirements: 1.1, 6.1, 6.2_

  - [x] 6.6 Implement central `render()` function
    - Compute `filteredTransactions = filterByMonth(AppState.transactions, AppState.monthFilter)`
    - Compute `filteredSortedTransactions = sortTransactions(filteredTransactions, AppState.sortOption)`
    - Call all five sub-renders in order: `renderBalance`, `renderTransactionList`, `renderChart`, `renderBudgetWarnings`, `renderCategorySelects`
    - _Requirements: 4.2, 4.3, 7.2_

- [x] 7. Implement budget warning logic
  - [x] 7.1 Implement `isOverBudget(category, transactions, budgetLimits)` helper
    - Return `true` if and only if category total strictly exceeds its budget limit
    - _Requirements: 9.2, 9.3, 9.4_

  - [ ]* 7.2 Write property test for budget warning consistency
    - **Property 7: Budget Warning Consistency**
    - **Validates: Requirements 9.2, 9.3, 9.4**
    - Generate transaction arrays and budget limit maps; assert `isOverBudget(cat, txns, limits)` is true if and only if `computeCategoryTotals(txns)[cat] > limits[cat]`

- [x] 8. Implement event handlers and wire up interactions
  - [x] 8.1 Implement transaction form submit handler (`handleAddTransaction`)
    - Validate name and amount using helpers; display inline `<span class="field-error">` on failure; clear errors on next submit
    - On success: generate `id` via `crypto.randomUUID()` with `Date.now`/`Math.random` fallback, create `Transaction`, push to `AppState.transactions`, call `saveTransactions`, call `render()`, reset form fields (name → empty, amount → empty, category → first option)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 8.2 Implement transaction delete handler (`handleDelete(id)`)
    - Remove matching transaction from `AppState.transactions`, call `saveTransactions`, call `render()`
    - Must complete within 1 second without page reload
    - _Requirements: 2.4, 3.3, 4.3_

  - [x] 8.3 Implement category form submit handler (`handleAddCategory`)
    - Validate using `validateCategoryInput`; show inline error on failure
    - On success: push to `AppState.categories`, call `saveCategories`, call `renderCategorySelects()`
    - _Requirements: 6.2, 6.3_

  - [x] 8.4 Implement month filter change and clear handlers
    - On change: parse `#month-filter` value into `{ year, month }`, set `AppState.monthFilter`, call `render()`
    - On clear: set `AppState.monthFilter = null`, call `render()`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 8.5 Implement sort controls change handler
    - Set `AppState.sortOption` to selected value, call `saveSortOption`, call `render()`
    - _Requirements: 8.1, 8.2, 8.4_

  - [x] 8.6 Implement budget limit form submit handler (`handleSetBudget`)
    - Validate using `validateBudgetInput`; show inline error on failure
    - On success: set `AppState.budgetLimits[category]`, call `saveBudgetLimits`, call `render()`
    - _Requirements: 9.1, 9.5, 9.6_

  - [x] 8.7 Implement theme toggle handler and initial theme application
    - On toggle: update `AppState.theme`, call `saveTheme`, set `data-theme` attribute on `<html>` element within 100 ms
    - On init: read saved theme; if absent, apply `prefers-color-scheme` media query default; apply `data-theme` before first render to prevent flash
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 9. Implement application bootstrap (`init`)
  - Load all persisted state: `loadTransactions`, `loadCategories` (prepend built-ins), `loadBudgetLimits`, `loadSortOption`, `loadTheme`
  - Apply theme to `<html>` before first render
  - Attach all event listeners (form submits, delete delegation on `#transaction-list`, month filter, sort controls, budget form, theme toggle, category form)
  - Call `render()` to populate initial UI
  - _Requirements: 2.3, 5.3, 6.4, 8.4, 10.3_

- [ ] 10. Checkpoint — Ensure full integration works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement CSS styling for all themes and states
  - Define CSS custom properties for both light and dark themes; use `[data-theme="dark"]` overrides
  - Style: balance display, transaction list rows (default and over-budget highlight), empty-state messages, inline field errors, warning banner, chart section, category badge, sort controls, month filter, theme toggle
  - Ensure scrollable `#transaction-list` container when overflow occurs
  - _Requirements: 2.2, 9.2, 10.1, 10.2_

- [ ] 12. Final checkpoint — Full feature verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use [fast-check](https://github.com/dubzzz/fast-check) and can be run via a `test.html` page (CDN load) or a Node.js script
- Built-in categories (`Food`, `Transport`, `Fun`) are never written to `localStorage` — only custom categories are persisted separately
- All `localStorage` calls must be wrapped in `try/catch` to support private browsing and quota-exceeded scenarios
- The `render()` function is the single re-render entry point; never mutate the DOM outside a render function
- Chart.js instance must be destroyed before re-creation to avoid canvas reuse errors

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["2.3", "3.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "3.3", "3.4", "4.1", "4.2"] },
    { "id": 3, "tasks": ["4.3", "4.4", "4.5", "6.1", "6.2", "6.3", "6.4", "6.5", "7.1"] },
    { "id": 4, "tasks": ["6.6", "7.2", "8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7"] },
    { "id": 5, "tasks": ["9"] }
  ]
}
```
