// app.js — Expense & Budget Visualizer
// Main application module. All subsequent tasks add code here.

// ---------------------------------------------------------------------------
// SORT_OPTIONS — enum-style constant for transaction sort order (Req 5.1–5.3)
// ---------------------------------------------------------------------------
const SORT_OPTIONS = Object.freeze({
  AMOUNT_ASC:    'amount_asc',
  AMOUNT_DESC:   'amount_desc',
  CATEGORY_ASC:  'category_asc',
  CATEGORY_DESC: 'category_desc',
});

// ---------------------------------------------------------------------------
// AppState — application singleton (Req 5.1, 5.2, 5.3, 8.1)
// ---------------------------------------------------------------------------
const AppState = {
  /** @type {Array}  Transaction[] */
  transactions: [],

  /** @type {string[]}  Built-in + custom category names */
  categories: [],

  /** @type {Object.<string, number>}  { [categoryName]: budgetLimit } */
  budgetLimits: {},

  /** @type {string|null}  One of SORT_OPTIONS values, or null */
  sortOption: null,

  /** @type {{year: number, month: number}|null}  1-indexed month, or null */
  monthFilter: null,

  /** @type {'light'|'dark'|'system'}  UI colour theme */
  theme: 'system',
};

// ---------------------------------------------------------------------------
// localStorage helpers (Req 5.1, 5.2, 5.3, 5.4, 6.4, 6.5, 8.4, 10.3)
// ---------------------------------------------------------------------------

const BUILTIN_CATEGORIES = ['Food', 'Transport', 'Fun'];

/**
 * Schema guard — validates a single transaction object.
 * @param {*} t
 * @returns {boolean}
 */
function isValidTransaction(t) {
  if (!t || typeof t !== 'object') return false;

  // id: non-empty string
  if (typeof t.id !== 'string' || t.id.trim() === '') return false;

  // name: non-empty string ≤ 100 chars
  if (typeof t.name !== 'string' || t.name.trim() === '' || t.name.length > 100) return false;

  // amount: finite number in [0.01, 999_999_999.99]
  if (typeof t.amount !== 'number' || !isFinite(t.amount) || t.amount < 0.01 || t.amount > 999_999_999.99) return false;

  // category: non-empty string
  if (typeof t.category !== 'string' || t.category.trim() === '') return false;

  // date: valid ISO 8601 date string
  if (typeof t.date !== 'string' || isNaN(new Date(t.date).getTime())) return false;

  return true;
}

/**
 * Shows a non-blocking warning banner at the top of <body>.
 * Creates the element if it doesn't exist, otherwise updates its text.
 * @param {string} message
 */
function showNonBlockingWarning(message) {
  let banner = document.querySelector('.warning-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'warning-banner';
    document.body.insertBefore(banner, document.body.firstChild);
  }
  banner.textContent = message;
}

/**
 * Persists the transactions array to localStorage.
 * @param {Array} transactions
 */
function saveTransactions(transactions) {
  try {
    localStorage.setItem('transactions', JSON.stringify(transactions));
  } catch (err) {
    showNonBlockingWarning('Could not save transactions. Storage may be full or unavailable.');
  }
}

/**
 * Loads transactions from localStorage.
 * Filters out any records that fail schema validation.
 * @returns {Array}
 */
function loadTransactions() {
  try {
    const raw = localStorage.getItem('transactions');
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('Stored transactions is not an array');
    }

    const valid = parsed.filter(isValidTransaction);
    if (valid.length < parsed.length) {
      showNonBlockingWarning(
        `${parsed.length - valid.length} transaction(s) could not be loaded due to invalid data and were skipped.`
      );
    }

    return valid;
  } catch (err) {
    showNonBlockingWarning('Could not load transactions. Data may be corrupt.');
    return [];
  }
}

/**
 * Persists custom categories (excludes built-ins) to localStorage.
 * @param {string[]} categories
 */
function saveCategories(categories) {
  try {
    const customOnly = categories.filter(c => !BUILTIN_CATEGORIES.includes(c));
    localStorage.setItem('categories', JSON.stringify(customOnly));
  } catch (err) {
    // Silently fail — built-ins are always available from code
  }
}

/**
 * Loads custom categories from localStorage.
 * Built-in categories are prepended by the caller.
 * @returns {string[]}
 */
function loadCategories() {
  try {
    const raw = localStorage.getItem('categories');
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(c => typeof c === 'string' && c.trim() !== '');
  } catch (err) {
    showNonBlockingWarning('Could not load categories. Custom categories may have been reset.');
    return [];
  }
}

/**
 * Persists budget limits map to localStorage.
 * @param {Object.<string, number>} budgetLimits
 */
function saveBudgetLimits(budgetLimits) {
  try {
    localStorage.setItem('budgetLimits', JSON.stringify(budgetLimits));
  } catch (err) {
    // Silently fail — non-critical persistence
  }
}

/**
 * Loads budget limits from localStorage.
 * @returns {Object.<string, number>}
 */
function loadBudgetLimits() {
  try {
    const raw = localStorage.getItem('budgetLimits');
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return parsed;
  } catch (err) {
    return {};
  }
}

/**
 * Persists the active sort option to localStorage.
 * Removes the key when sortOption is null.
 * @param {string|null} sortOption
 */
function saveSortOption(sortOption) {
  try {
    if (sortOption === null) {
      localStorage.removeItem('sortOption');
    } else {
      localStorage.setItem('sortOption', sortOption);
    }
  } catch (err) {
    // Silently fail — UI preference only
  }
}

/**
 * Loads the sort option from localStorage.
 * Returns null if the stored value is not a valid SORT_OPTIONS value.
 * @returns {string|null}
 */
function loadSortOption() {
  try {
    const value = localStorage.getItem('sortOption');
    const validValues = Object.values(SORT_OPTIONS);
    return validValues.includes(value) ? value : null;
  } catch (err) {
    return null;
  }
}

/**
 * Persists the UI theme to localStorage.
 * @param {string} theme
 */
function saveTheme(theme) {
  try {
    localStorage.setItem('theme', theme);
  } catch (err) {
    // Silently fail — UI preference only
  }
}

/**
 * Loads the UI theme from localStorage.
 * Returns null if the stored value is not 'light' or 'dark'.
 * @returns {'light'|'dark'|null}
 */
function loadTheme() {
  try {
    const value = localStorage.getItem('theme');
    return (value === 'light' || value === 'dark') ? value : null;
  } catch (err) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Validation helpers (Req 1.3, 1.4, 6.2, 6.3, 9.1, 9.6)
// ---------------------------------------------------------------------------

/**
 * Validates a transaction/category item name.
 * - Rejects empty strings and whitespace-only strings.
 * - Enforces a maximum length of 100 characters.
 * @param {string} name
 * @returns {{ valid: boolean, error?: string }}
 */
function validateNameInput(name) {
  if (typeof name !== 'string' || name.trim() === '') {
    return { valid: false, error: 'Item name is required.' };
  }
  if (name.length > 100) {
    return { valid: false, error: 'Item name must be 100 characters or fewer.' };
  }
  return { valid: true };
}

/**
 * Validates a transaction amount string.
 * - Rejects non-numeric, zero, negative values.
 * - Rejects values exceeding 999,999,999.99.
 * - Rejects values with more than 2 decimal places.
 * @param {string} str
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAmountInput(str) {
  if (typeof str !== 'string' || str.trim() === '') {
    return { valid: false, error: 'Amount is required.' };
  }

  // Must be a valid number (no trailing letters, multiple dots, etc.)
  const trimmed = str.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return { valid: false, error: 'Amount must be a valid number.' };
  }

  const value = parseFloat(trimmed);

  if (!isFinite(value) || isNaN(value)) {
    return { valid: false, error: 'Amount must be a valid number.' };
  }
  if (value <= 0) {
    return { valid: false, error: 'Amount must be greater than zero.' };
  }
  if (value > 999_999_999.99) {
    return { valid: false, error: 'Amount must not exceed 999,999,999.99.' };
  }

  // Check decimal places — count digits after the decimal point
  const dotIndex = trimmed.indexOf('.');
  if (dotIndex !== -1 && trimmed.length - dotIndex - 1 > 2) {
    return { valid: false, error: 'Amount must have at most 2 decimal places.' };
  }

  return { valid: true };
}

/**
 * Validates a new custom category name.
 * - Rejects empty strings.
 * - Rejects names longer than 50 characters.
 * - Rejects case-insensitive duplicates against `existingCategories`.
 * @param {string} name
 * @param {string[]} existingCategories
 * @returns {{ valid: boolean, error?: string }}
 */
function validateCategoryInput(name, existingCategories) {
  if (typeof name !== 'string' || name.trim() === '') {
    return { valid: false, error: 'Category name is required.' };
  }
  if (name.length > 50) {
    return { valid: false, error: 'Category name must be 50 characters or fewer.' };
  }

  const lowerName = name.toLowerCase();
  const isDuplicate = Array.isArray(existingCategories) &&
    existingCategories.some(c => typeof c === 'string' && c.toLowerCase() === lowerName);

  if (isDuplicate) {
    return { valid: false, error: 'A category with this name already exists.' };
  }

  return { valid: true };
}

/**
 * Validates a budget limit amount string.
 * Applies the same numeric rules as `validateAmountInput`.
 * @param {string} str
 * @returns {{ valid: boolean, error?: string }}
 */
function validateBudgetInput(str) {
  const result = validateAmountInput(str);
  if (!result.valid) {
    // Re-map the generic "Amount" wording to "Budget limit" for better UX
    return { valid: false, error: result.error.replace('Amount', 'Budget limit') };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Formatting & computation helpers (Req 3.4, 3.5, 3.6)
// ---------------------------------------------------------------------------

/**
 * Formats a numeric amount as a USD currency string.
 * Non-negative values are prefixed with "$"; negative values with "-$".
 * Example: 1234.5 → "$1,234.50", -50 → "-$50.00"
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

/**
 * Formats an ISO 8601 date string into a human-readable date.
 * Example: "2024-10-26T14:35:00.000Z" → "Oct 26, 2024"
 * @param {string} isoString
 * @returns {string}
 */
function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Computes the total balance by summing all transaction amounts.
 * Returns 0 for an empty array.
 * @param {Array} transactions
 * @returns {number}
 */
function computeBalance(transactions) {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Computes per-category spending totals.
 * Returns a map of { [categoryName]: totalAmount }.
 * @param {Array} transactions
 * @returns {Object.<string, number>}
 */
function computeCategoryTotals(transactions) {
  return transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + t.amount;
    return acc;
  }, {});
}

// ---------------------------------------------------------------------------
// filterByMonth — Month filter helper (Req 7.1, 7.2, 7.3)
// ---------------------------------------------------------------------------

/**
 * Filters a transaction array to only those whose date falls within the
 * specified calendar month and year.
 *
 * @param {Array} transactions  Full transaction array.
 * @param {{ year: number, month: number }|null} monthFilter
 *   1-indexed month (January = 1). Pass null to return all transactions.
 * @returns {Array} Filtered (or full) transaction array.
 */
function filterByMonth(transactions, monthFilter) {
  if (monthFilter === null || monthFilter === undefined) {
    return transactions;
  }

  const { year, month } = monthFilter;

  return transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
}

// ---------------------------------------------------------------------------
// sortTransactions — Sort helper (Req 8.1, 8.3)
// ---------------------------------------------------------------------------

/**
 * Returns a new sorted copy of `transactions` according to `sortOption`.
 * Does NOT mutate the original array.
 *
 * Sort options:
 *   AMOUNT_ASC    — ascending by amount; tie-break: descending date
 *   AMOUNT_DESC   — descending by amount; tie-break: descending date
 *   CATEGORY_ASC  — alphabetical ascending by category; tie-break: descending date
 *   CATEGORY_DESC — alphabetical descending by category; tie-break: descending date
 *   null / other  — descending date (most recent first)
 *
 * @param {Array}       transactions  Transaction array to sort.
 * @param {string|null} sortOption    One of SORT_OPTIONS values, or null.
 * @returns {Array} New sorted array.
 */
function sortTransactions(transactions, sortOption) {
  // Work on a shallow copy so the original is never mutated.
  const copy = transactions.slice();

  /**
   * Tie-breaker: more recent date comes first (descending).
   * Returns a negative number when `a` is more recent than `b`.
   */
  function byDateDesc(a, b) {
    return new Date(b.date) - new Date(a.date);
  }

  switch (sortOption) {
    case SORT_OPTIONS.AMOUNT_ASC:
      return copy.sort((a, b) => a.amount !== b.amount
        ? a.amount - b.amount
        : byDateDesc(a, b));

    case SORT_OPTIONS.AMOUNT_DESC:
      return copy.sort((a, b) => a.amount !== b.amount
        ? b.amount - a.amount
        : byDateDesc(a, b));

    case SORT_OPTIONS.CATEGORY_ASC:
      return copy.sort((a, b) => {
        const cmp = a.category.localeCompare(b.category);
        return cmp !== 0 ? cmp : byDateDesc(a, b);
      });

    case SORT_OPTIONS.CATEGORY_DESC:
      return copy.sort((a, b) => {
        const cmp = b.category.localeCompare(a.category);
        return cmp !== 0 ? cmp : byDateDesc(a, b);
      });

    default:
      // No sort selected — fall back to descending date order.
      return copy.sort(byDateDesc);
  }
}

// ---------------------------------------------------------------------------
// renderBalance — Balance display (Req 3.1, 3.2, 3.3, 3.4, 3.5, 3.6)
// ---------------------------------------------------------------------------

/**
 * Renders the total balance to the #balance-display element.
 *
 * Computes the balance from the provided filtered transactions, formats it as
 * a currency string (e.g. "$1,234.56" or "-$50.00"), and writes it to the
 * DOM.  If the #balance-display element is not found, the function returns
 * silently to avoid throwing in non-browser environments.
 *
 * @param {Array} filteredTransactions  The currently-visible transaction array
 *   (already filtered by month if a filter is active).
 */
function renderBalance(filteredTransactions) {
  const el = document.getElementById('balance-display');
  if (!el) return;

  const balance = computeBalance(filteredTransactions);
  el.textContent = formatCurrency(balance);
}

// ---------------------------------------------------------------------------
// renderTransactionList — Transaction list (Req 2.1, 2.2, 2.3, 2.5, 9.2)
// ---------------------------------------------------------------------------

/**
 * Renders the transaction list to the #transaction-list element.
 *
 * Each visible transaction is rendered as an `<li>` row containing the item
 * name, formatted amount, category badge, formatted date, and a delete
 * button.  Rows whose category's total spending strictly exceeds its budget
 * limit receive the `over-budget` class for visual distinction (Req 9.2).
 *
 * If the list is empty, a `<p class="empty-state">` placeholder is shown
 * instead (Req 2.5).
 *
 * If the #transaction-list element is not found, the function returns
 * silently to avoid throwing in non-browser environments.
 *
 * @param {Array} filteredSortedTransactions  Transactions already filtered by
 *   month (if active) and sorted by the active sort option.
 */
function renderTransactionList(filteredSortedTransactions) {
  const list = document.getElementById('transaction-list');
  if (!list) return;

  // Clear current contents
  list.innerHTML = '';

  // Empty state (Req 2.5)
  if (!filteredSortedTransactions || filteredSortedTransactions.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'empty-state';
    emptyMsg.textContent = 'No transactions recorded yet.';
    list.appendChild(emptyMsg);
    return;
  }

  // Compute category totals and read budget limits for over-budget detection
  // (Req 9.2 — use the filtered set so that month filter also scopes warnings)
  const categoryTotals = computeCategoryTotals(filteredSortedTransactions);
  const budgetLimits   = AppState.budgetLimits;

  // Build and append one <li> per transaction
  for (const t of filteredSortedTransactions) {
    const li = document.createElement('li');
    li.className = 'transaction-item';

    // Mark row as over-budget when the category total strictly exceeds its limit
    const limit = budgetLimits[t.category];
    if (typeof limit === 'number' && categoryTotals[t.category] > limit) {
      li.classList.add('over-budget');
    }

    // Item name (Req 2.1)
    const nameSpan = document.createElement('span');
    nameSpan.className = 'transaction-name';
    nameSpan.textContent = t.name;

    // Formatted amount (Req 2.1)
    const amountSpan = document.createElement('span');
    amountSpan.className = 'transaction-amount';
    amountSpan.textContent = formatCurrency(t.amount);

    // Category badge (Req 2.1)
    const categorySpan = document.createElement('span');
    categorySpan.className = 'category-badge';
    categorySpan.textContent = t.category;

    // Formatted date (Req 2.1)
    const dateSpan = document.createElement('span');
    dateSpan.className = 'transaction-date';
    dateSpan.textContent = formatDate(t.date);

    // Delete button (Req 2.4)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.type = 'button';
    deleteBtn.dataset.id = t.id;
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete transaction: ${t.name}`);

    li.appendChild(nameSpan);
    li.appendChild(amountSpan);
    li.appendChild(categorySpan);
    li.appendChild(dateSpan);
    li.appendChild(deleteBtn);

    list.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
// renderChart — Spending distribution chart (Req 4.1, 4.4, 4.5)
// ---------------------------------------------------------------------------

/**
 * Module-level Chart.js instance.
 * Kept here so `renderChart` can destroy it before recreating.
 * @type {Chart|null}
 */
let chartInstance = null;

/**
 * Colour palette for pie slices (at least 8 distinct colours).
 * Used in order of category insertion; wraps around if more than 8 categories.
 */
const CHART_COLORS = [
  '#AFCBFF', // Baby Blue
  '#B8E0D2', // Mint
  '#F9D5A7', // Peach
  '#D8B4E2', // Lavender
  '#F4B6C2', // Rose
  '#C7DDB5', // Sage
  '#F6E7A1', // Butter
];

/**
 * Renders (or re-renders) the spending pie chart inside `<canvas id="spending-chart">`.
 *
 * Behaviour:
 *  - If Chart.js failed to load from CDN (`window.__chartJsUnavailable` is truthy or
 *    `window.Chart` is not defined), hides the canvas and shows a static unavailability
 *    message inside `#chart-empty-message`, then returns.
 *  - If `filteredTransactions` is empty, destroys any existing chart instance, hides the
 *    canvas, and shows "No spending data available." in `#chart-empty-message`.
 *  - Otherwise, computes per-category totals, destroys the old chart if any, shows the
 *    canvas, hides the empty message, and creates a new Chart.js pie chart with
 *    percentage labels on tooltips and a matching legend.
 *
 * @param {Array} filteredTransactions  Transactions already filtered by the active month
 *   filter (may be the full list when no filter is active).
 */
function renderChart(filteredTransactions) {
  const canvas = document.getElementById('spending-chart');
  const emptyMsg = document.getElementById('chart-empty-message');

  // Guard: elements must exist (silently skip in non-browser / test environments)
  if (!canvas || !emptyMsg) return;

  // --- CDN unavailability guard (Req 4.5 / error handling) ---
  if (window.__chartJsUnavailable || typeof window.Chart === 'undefined') {
    canvas.hidden = true;
    emptyMsg.textContent = 'Chart unavailable: could not load the Chart.js library.';
    emptyMsg.hidden = false;
    return;
  }

  // --- Empty-state (Req 4.5) ---
  if (!filteredTransactions || filteredTransactions.length === 0) {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    canvas.hidden = true;
    emptyMsg.textContent = 'No spending data available.';
    emptyMsg.hidden = false;
    return;
  }

  // --- Compute totals (Req 4.1) ---
  const totals = computeCategoryTotals(filteredTransactions);
  const labels = Object.keys(totals);
  const data   = labels.map(label => totals[label]);
  const total  = data.reduce((sum, v) => sum + v, 0);

  // Assign colours cycling through the palette
  const backgroundColors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  // --- Destroy previous chart instance before recreating (Req 4.2, 4.3) ---
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  // --- Show canvas, hide empty message ---
  canvas.hidden = false;
  emptyMsg.hidden = true;

  // --- Create new Chart.js pie chart (Req 4.1, 4.4) ---
  chartInstance = new window.Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: backgroundColors,
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,       // Req 4.4 — legend with category names and matching colours
          position: 'bottom',
        },
        tooltip: {
          enabled: true,
          callbacks: {
            /**
             * Shows both the raw formatted amount and the percentage in the tooltip.
             * e.g. "Food: $42.50 (35.2%)"
             */
            label(context) {
              const value      = context.parsed;
              const pct        = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
              const label      = context.label || '';
              const formatted  = formatCurrency(value);
              return `${label}: ${formatted} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// renderBudgetWarnings — Budget warning messages (Req 9.3, 9.4)
// ---------------------------------------------------------------------------

/**
 * Renders over-budget warning messages to the #budget-warnings element.
 *
 * For each category that has a budget limit set in `AppState.budgetLimits`,
 * a warning is shown when that category's total spending strictly exceeds
 * its limit.  Warnings for categories at or below their limit are not shown
 * (Req 9.4).  The container is cleared on every call so stale warnings are
 * always removed.
 *
 * @param {Array} filteredTransactions  Transactions already filtered by the
 *   active month filter (may be the full list when no filter is active).
 */
function renderBudgetWarnings(filteredTransactions) {
  const container = document.getElementById('budget-warnings');
  if (!container) return;

  // Always clear previous warnings first (Req 9.4)
  container.innerHTML = '';

  // Nothing to warn about when no limits are configured or there are no transactions
  if (
    Object.keys(AppState.budgetLimits).length === 0 ||
    !filteredTransactions ||
    filteredTransactions.length === 0
  ) {
    return;
  }

  const categoryTotals = computeCategoryTotals(filteredTransactions);

  for (const [category, limit] of Object.entries(AppState.budgetLimits)) {
    const total = categoryTotals[category] ?? 0;

    if (total > limit) {
      const excess = total - limit;

      const warning = document.createElement('div');
      warning.className = 'budget-warning';
      warning.textContent = `⚠ ${category}: over budget by ${formatCurrency(excess)}`;

      container.appendChild(warning);
    }
  }
}

// ---------------------------------------------------------------------------
// renderCategorySelects — Populate category <select> elements (Req 1.1, 6.1, 6.2)
// ---------------------------------------------------------------------------

/**
 * Populates both `#input-category` (transaction form) and `#budget-category`
 * (budget form) select elements with the current list of categories from
 * `AppState.categories`.
 *
 * Behaviour:
 *  - Saves the previously selected value before clearing so it can be
 *    restored if the category still exists after the rebuild.
 *  - Clears the select's `innerHTML`, then appends one `<option>` per
 *    category in `AppState.categories` (built-ins first, custom appended).
 *  - After rebuilding, restores the previously selected value when that
 *    category is still present; otherwise the first option becomes active.
 *  - Silently skips any select element that does not exist in the DOM so
 *    the function is safe to call in non-browser / test environments.
 *
 * Called on initial app load and whenever a custom category is added
 * (Req 6.1, 6.2).
 */
function renderCategorySelects() {
  const selectIds = ['input-category', 'budget-category'];

  for (const id of selectIds) {
    const select = document.getElementById(id);
    if (!select) continue;

    // Preserve the current selection before wiping the options list
    const previousValue = select.value;

    // Rebuild options from the authoritative categories list
    select.innerHTML = '';

    for (const category of AppState.categories) {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    }

    // Restore previous selection if that category still exists; otherwise the
    // browser automatically selects the first option, which is the desired
    // fallback behaviour (Req 6.1).
    const stillExists = AppState.categories.includes(previousValue);
    if (stillExists) {
      select.value = previousValue;
    }
  }
}

// ---------------------------------------------------------------------------
// render — Central render orchestrator (Req 4.2, 4.3, 7.2)
// ---------------------------------------------------------------------------

/**
 * Re-renders the entire UI from the current AppState.
 *
 * Steps:
 *  1. Applies the active month filter to produce `filteredTransactions`.
 *  2. Applies the active sort option to produce `filteredSortedTransactions`.
 *  3. Calls each sub-render in order:
 *       - renderBalance          (filtered, unsorted — balance is order-independent)
 *       - renderTransactionList  (filtered AND sorted — list respects sort order)
 *       - renderChart            (filtered, unsorted — chart is order-independent)
 *       - renderBudgetWarnings   (filtered, unsorted — warnings are order-independent)
 *       - renderCategorySelects  (no args — rebuilds category <select> elements)
 */
function render() {
  const filteredTransactions = filterByMonth(AppState.transactions, AppState.monthFilter);
  const filteredSortedTransactions = sortTransactions(filteredTransactions, AppState.sortOption);

  renderBalance(filteredTransactions);
  renderTransactionList(filteredSortedTransactions);
  renderChart(filteredTransactions);
  renderBudgetWarnings(filteredTransactions);
  renderCategorySelects();
}

// ---------------------------------------------------------------------------
// isOverBudget — Budget over-limit predicate (Req 9.2, 9.3, 9.4)
// ---------------------------------------------------------------------------

/**
 * Returns `true` if and only if the total spending for `category` strictly
 * exceeds its configured budget limit.
 *
 * Logic:
 *  - If `budgetLimits[category]` is not a finite number, there is no limit
 *    set for that category and the function returns `false`.
 *  - Otherwise, uses `computeCategoryTotals` to sum all transaction amounts
 *    for the category and compares the total against the limit.
 *
 * @param {string}                    category      The category name to check.
 * @param {Array}                     transactions  Transaction array to inspect
 *   (already filtered by month when called from budget-aware render paths).
 * @param {Object.<string, number>}   budgetLimits  Map of category name →
 *   budget limit value (e.g., `AppState.budgetLimits`).
 * @returns {boolean}  `true` when the category total strictly exceeds its
 *   limit; `false` when no limit is set or the total is at or below the limit.
 */
function isOverBudget(category, transactions, budgetLimits) {
  const limit = budgetLimits[category];

  // No limit configured for this category — never over budget
  if (typeof limit !== 'number' || !isFinite(limit)) return false;

  const totals = computeCategoryTotals(transactions);
  const total  = totals[category] ?? 0;

  return total > limit;
}

// ---------------------------------------------------------------------------
// handleAddTransaction — Transaction form submit handler (Req 1.1–1.5)
// ---------------------------------------------------------------------------

/**
 * Generates a unique transaction ID.
 * Prefers `crypto.randomUUID()` when available; falls back to a
 * combination of `Date.now()` and `Math.random()` for older browsers.
 * @returns {string}
 */
function generateId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  // Fallback: Date.now() base-36 + Math.random() base-36 suffix
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Handles the `submit` event on `#transaction-form`.
 *
 * Behaviour:
 *  1. Prevents the default browser form submission.
 *  2. Clears any inline field errors left from a previous attempt.
 *  3. Reads the current values of `#input-name`, `#input-amount`, and
 *     `#input-category`.
 *  4. Validates the name with `validateNameInput` and the amount with
 *     `validateAmountInput`; writes error text to the corresponding
 *     `<span class="field-error">` element when validation fails.
 *  5. If any validation failed, moves focus to the first errored field and
 *     returns without creating a transaction.
 *  6. On success: creates a Transaction object, pushes it to
 *     `AppState.transactions`, persists via `saveTransactions`, triggers
 *     `render()`, and resets the form fields:
 *       - `#input-name`     → empty string
 *       - `#input-amount`   → empty string
 *       - `#input-category` → first option (index 0)
 *
 * @param {Event} event  The DOM submit event fired by `#transaction-form`.
 */
function handleAddTransaction(event) {
  event.preventDefault();

  // --- Grab DOM references ---
  const nameInput     = document.getElementById('input-name');
  const amountInput   = document.getElementById('input-amount');
  const categoryInput = document.getElementById('input-category');
  const errorName     = document.getElementById('error-name');
  const errorAmount   = document.getElementById('error-amount');

  // --- Clear previous error messages (Req 1.3, 1.4) ---
  if (errorName)   errorName.textContent   = '';
  if (errorAmount) errorAmount.textContent = '';

  // --- Read current field values ---
  const nameValue     = nameInput   ? nameInput.value   : '';
  const amountValue   = amountInput ? amountInput.value : '';
  const categoryValue = categoryInput ? categoryInput.value : '';

  // --- Validate ---
  const nameResult   = validateNameInput(nameValue);
  const amountResult = validateAmountInput(amountValue);

  let firstErrorField = null;

  if (!nameResult.valid) {
    if (errorName) errorName.textContent = nameResult.error;
    if (!firstErrorField) firstErrorField = nameInput;
  }

  if (!amountResult.valid) {
    if (errorAmount) errorAmount.textContent = amountResult.error;
    if (!firstErrorField) firstErrorField = amountInput;
  }

  // Move focus to the first field that failed (accessibility)
  if (firstErrorField) {
    firstErrorField.focus();
    return;
  }

  // --- Build and store the new Transaction (Req 1.2) ---
  const transaction = {
    id:       generateId(),
    name:     nameValue.trim(),
    amount:   parseFloat(amountValue.trim()),
    category: categoryValue,
    date:     new Date().toISOString(),
  };

  AppState.transactions.push(transaction);
  saveTransactions(AppState.transactions);
  render();

  // --- Reset form fields (Req 1.5) ---
  if (nameInput)     nameInput.value      = '';
  if (amountInput)   amountInput.value    = '';
  if (categoryInput) categoryInput.selectedIndex = 0;
}

/**
 * Remove the transaction with the given id from AppState, persist the
 * updated list, and re-render the UI.
 *
 * Requirements: 2.4, 3.3, 4.3
 *
 * @param {string} id - The unique identifier of the transaction to delete.
 */
function handleDelete(id) {
  AppState.transactions = AppState.transactions.filter(function(t) {
    return t.id !== id;
  });
  saveTransactions(AppState.transactions);
  render();
}

// ---------------------------------------------------------------------------
// handleMonthFilterChange / handleMonthFilterClear — Month filter handlers
// (Req 7.1, 7.2, 7.3)
// ---------------------------------------------------------------------------

/**
 * Handles the `change` event on `#month-filter`.
 *
 * Reads the input's value (a "YYYY-MM" string), parses it into a
 * `{ year, month }` object (month is 1-indexed), stores it in
 * `AppState.monthFilter`, and triggers a full re-render so every panel
 * reflects the newly-active filter.
 *
 * When the input value is empty (the user cleared the native picker without
 * using the Clear button), `AppState.monthFilter` is set to `null` so the
 * filter is effectively deactivated.
 *
 * @param {Event} event  The DOM change event fired by `#month-filter`.
 */
function handleMonthFilterChange(event) {
  const value = event.target.value; // e.g. "2024-10" or ""

  if (!value) {
    // Native picker was cleared — treat as "no filter"
    AppState.monthFilter = null;
  } else {
    const [yearStr, monthStr] = value.split('-');
    AppState.monthFilter = {
      year:  parseInt(yearStr,  10),
      month: parseInt(monthStr, 10), // 1-indexed
    };
  }

  render();
}

/**
 * Handles the `click` event on `#clear-month-filter`.
 *
 * Resets `AppState.monthFilter` to `null`, clears the visible value of the
 * `#month-filter` input so the picker shows its placeholder state again, and
 * triggers a full re-render so every panel reverts to showing all
 * transactions.
 */
function handleMonthFilterClear() {
  AppState.monthFilter = null;

  const input = document.getElementById('month-filter');
  if (input) {
    input.value = '';
  }

  render();
}

// ---------------------------------------------------------------------------
// handleSortChange — sort controls change handler (Req 8.1, 8.2, 8.4)
// ---------------------------------------------------------------------------

/**
 * Handles changes to the #sort-controls <select> element.
 * Updates AppState.sortOption, persists the selection to localStorage,
 * and re-renders the UI.
 *
 * @param {Event} event - The 'change' event from the sort <select>.
 */
function handleSortChange(event) {
  const value = event.target.value;
  // Map the selected value to a SORT_OPTIONS constant, or null for the
  // default/empty option (value === '' means "no sort selected").
  const validValues = Object.values(SORT_OPTIONS);
  AppState.sortOption = validValues.includes(value) ? value : null;
  saveSortOption(AppState.sortOption);
  render();
}

// ---------------------------------------------------------------------------
// handleAddCategory — Category form submit handler
// (Req 6.2, 6.3)
// ---------------------------------------------------------------------------

/**
 * Handles the `submit` event on `#add-category-form`.
 *
 * Behaviour:
 *  1. Prevents the default browser form submission.
 *  2. Clears any inline field error left from a previous attempt.
 *  3. Reads the current value of `#input-category-name`.
 *  4. Validates using `validateCategoryInput(name, AppState.categories)`.
 *  5. On failure: writes the error message into `#error-category-name`,
 *     moves focus to the input field, and returns without adding a category.
 *  6. On success: pushes the trimmed name to `AppState.categories`, persists
 *     via `saveCategories`, calls `renderCategorySelects()` to refresh all
 *     category `<select>` elements, and resets the input to an empty string.
 *
 * Requirements: 6.2, 6.3
 *
 * @param {Event} event  The DOM submit event fired by `#add-category-form`.
 */
function handleAddCategory(event) {
  event.preventDefault();

  // --- Grab DOM references ---
  const nameInput = document.getElementById('input-category-name');
  const errorSpan = document.getElementById('error-category-name');

  // --- Clear previous inline error (Req 6.3) ---
  if (errorSpan) errorSpan.textContent = '';

  // --- Read current field value ---
  const nameValue = nameInput ? nameInput.value : '';

  // --- Validate (Req 6.2) ---
  const result = validateCategoryInput(nameValue, AppState.categories);

  if (!result.valid) {
    if (errorSpan) errorSpan.textContent = result.error;
    if (nameInput) nameInput.focus();
    return;
  }

  // --- Persist new category (Req 6.2) ---
  AppState.categories.push(nameValue.trim());
  saveCategories(AppState.categories);
  renderCategorySelects();

  // --- Reset input field (Req 6.3) ---
  if (nameInput) nameInput.value = '';
}

// ---------------------------------------------------------------------------
// handleSetBudget — Budget limit form submit handler (Req 9.1, 9.5, 9.6)
// ---------------------------------------------------------------------------

/**
 * Handles the `submit` event on `#budget-form`.
 *
 * Behaviour:
 *  1. Prevents the default browser form submission.
 *  2. Clears any inline field error left from a previous attempt.
 *  3. Reads the current values of `#budget-category` and `#budget-amount`.
 *  4. Validates the amount using `validateBudgetInput(amountValue)`.
 *  5. On failure: writes the error message into `#error-budget-amount`,
 *     moves focus to `#budget-amount`, and returns without mutating state.
 *  6. On success: sets `AppState.budgetLimits[category]` to the parsed
 *     numeric value, persists via `saveBudgetLimits`, triggers a full
 *     `render()`, and resets `#budget-amount` to an empty string.
 *
 * Requirements: 9.1, 9.5, 9.6
 *
 * @param {Event} event  The DOM submit event fired by `#budget-form`.
 */
function handleSetBudget(event) {
  event.preventDefault();

  // --- Grab DOM references ---
  const categoryInput = document.getElementById('budget-category');
  const amountInput   = document.getElementById('budget-amount');
  const errorSpan     = document.getElementById('error-budget-amount');

  // --- Clear previous inline error (Req 9.6) ---
  if (errorSpan) errorSpan.textContent = '';

  // --- Read current field values ---
  const categoryValue = categoryInput ? categoryInput.value : '';
  const amountValue   = amountInput   ? amountInput.value   : '';

  // --- Validate amount (Req 9.1) ---
  const result = validateBudgetInput(amountValue);

  if (!result.valid) {
    // Show inline error and focus the amount field (Req 9.6)
    if (errorSpan)    errorSpan.textContent = result.error;
    if (amountInput)  amountInput.focus();
    return;
  }

  // --- Persist the budget limit (Req 9.5) ---
  AppState.budgetLimits[categoryValue] = parseFloat(amountValue);
  saveBudgetLimits(AppState.budgetLimits);
  render();

  // --- Reset amount field (Req 9.5) ---
  if (amountInput) amountInput.value = '';
}

// ---------------------------------------------------------------------------
// applyTheme / handleThemeToggle — Theme management (Req 10.1, 10.2, 10.3, 10.4)
// ---------------------------------------------------------------------------

/**
 * Applies a theme to the document and updates AppState.
 *
 * IMPORTANT: Call this before the first `render()` to prevent a theme flash
 * on page load (Req 10.2).
 *
 * Behaviour:
 *  - `'dark'`   → sets `data-theme="dark"` on `<html>`.
 *  - `'light'`  → sets `data-theme="light"` on `<html>`.
 *  - `'system'` (or any other value) → reads
 *    `window.matchMedia('(prefers-color-scheme: dark)').matches` and resolves
 *    to `'dark'` or `'light'` accordingly (Req 10.4).
 *  - Updates `AppState.theme` to the resolved canonical value (`'light'` or
 *    `'dark'`; never `'system'`).
 *  - Syncs the `#theme-toggle` visual state: when the element is a checkbox
 *    its `checked` property is set to `true` for dark, `false` for light
 *    (Req 10.1).
 *
 * @param {'light'|'dark'|'system'|string} theme  The desired theme.
 */
function applyTheme(theme) {
  // Resolve 'system' (or any unrecognised value) via media query (Req 10.4)
  let resolved;
  if (theme === 'dark') {
    resolved = 'dark';
  } else if (theme === 'light') {
    resolved = 'light';
  } else {
    // 'system' or unknown — follow OS preference
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    resolved = prefersDark ? 'dark' : 'light';
  }

  // Apply data-theme attribute to <html> (Req 10.1, 10.2)
  document.documentElement.setAttribute('data-theme', resolved);

  // Store the resolved canonical value in AppState (Req 10.3)
  AppState.theme = resolved;

  // Sync the toggle visual state (Req 10.1)
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    if (toggle.type === 'checkbox') {
      // Checkbox input: checked = dark mode active
      toggle.checked = resolved === 'dark';
    }
    // For <button> elements the visual state is managed by CSS via data-theme;
    // no JS property update is needed.
  }
}

/**
 * Handles the `click` / `change` event on `#theme-toggle`.
 *
 * Toggles `AppState.theme` between `'dark'` and `'light'`, applies the new
 * theme, and persists the choice to localStorage.  The `data-theme` attribute
 * on `<html>` is updated within the same synchronous call, well within the
 * 100 ms requirement (Req 10.1, 10.3).
 */
function handleThemeToggle() {
  // Toggle: dark → light, everything else → dark (Req 10.1)
  const nextTheme = AppState.theme === 'dark' ? 'light' : 'dark';

  applyTheme(nextTheme);
  saveTheme(AppState.theme); // persist the resolved canonical value (Req 10.3)
}

// ---------------------------------------------------------------------------
// init — Application bootstrap (Req 2.3, 5.3, 6.4, 8.4, 10.3)
// ---------------------------------------------------------------------------

/**
 * Bootstraps the application:
 *
 *  1. Loads all persisted state from localStorage into AppState.
 *  2. Applies the saved (or OS-default) theme to <html> *before* the first
 *     render to prevent a flash of the wrong theme (Req 10.3).
 *  3. Attaches all event listeners.
 *  4. Calls render() to paint the initial UI.
 */
function init() {
  // ------------------------------------------------------------------
  // 1. Load persisted state (Req 5.3, 6.4, 8.4, 10.3)
  // ------------------------------------------------------------------

  // Transactions
  AppState.transactions = loadTransactions();

  // Categories: built-ins always prepended in memory; custom ones follow
  const BUILT_IN_CATEGORIES = ['Food', 'Transport', 'Fun'];
  const customCategories = loadCategories(); // only custom names are stored
  AppState.categories = [
    ...BUILT_IN_CATEGORIES,
    ...customCategories.filter(function(c) {
      // Guard: skip any custom name that duplicates a built-in (case-insensitive)
      return !BUILT_IN_CATEGORIES.some(function(b) {
        return b.toLowerCase() === c.toLowerCase();
      });
    }),
  ];

  // Budget limits, sort option, theme
  AppState.budgetLimits = loadBudgetLimits();
  AppState.sortOption   = loadSortOption();
  const savedTheme      = loadTheme(); // 'light' | 'dark' | null

  // ------------------------------------------------------------------
  // 2. Apply theme before first render to prevent flash (Req 10.3, 10.4)
  // ------------------------------------------------------------------
  applyTheme(savedTheme || 'system');

  // ------------------------------------------------------------------
  // 3. Attach event listeners
  // ------------------------------------------------------------------

  // Transaction form submit (Req 1.1–1.5)
  const transactionForm = document.getElementById('transaction-form');
  if (transactionForm) {
    transactionForm.addEventListener('submit', handleAddTransaction);
  }

  // Delete transactions via event delegation on #transaction-list (Req 2.4)
  const transactionList = document.getElementById('transaction-list');
  if (transactionList) {
    transactionList.addEventListener('click', function(event) {
      const btn = event.target.closest('button[data-id]');
      if (btn) {
        handleDelete(btn.dataset.id);
      }
    });
  }

  // Category form submit (Req 6.2, 6.3)
  const addCategoryForm = document.getElementById('add-category-form');
  if (addCategoryForm) {
    addCategoryForm.addEventListener('submit', handleAddCategory);
  }

  // Month filter: change on <input type="month"> and click on clear button (Req 7.1–7.3)
  const monthFilterInput = document.getElementById('month-filter');
  if (monthFilterInput) {
    monthFilterInput.addEventListener('change', handleMonthFilterChange);
  }
  const clearMonthBtn = document.getElementById('clear-month-filter');
  if (clearMonthBtn) {
    clearMonthBtn.addEventListener('click', handleMonthFilterClear);
  }

  // Sort controls change (Req 8.1, 8.2, 8.4)
  const sortControls = document.getElementById('sort-controls');
  if (sortControls) {
    sortControls.addEventListener('change', handleSortChange);
  }

  // Budget limit form submit (Req 9.1, 9.5, 9.6)
  const budgetForm = document.getElementById('budget-form');
  if (budgetForm) {
    budgetForm.addEventListener('submit', handleSetBudget);
  }

  // Theme toggle button click (Req 10.1, 10.2, 10.3)
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', handleThemeToggle);
  }

  // ------------------------------------------------------------------
  // 4. Initial render (Req 2.3, 5.3)
  // ------------------------------------------------------------------
  render();
}

// ---------------------------------------------------------------------------
// Entry point — run init once the DOM is ready
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', init);
