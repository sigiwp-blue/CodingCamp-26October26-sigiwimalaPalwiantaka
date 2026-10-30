# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application built with HTML, CSS, and Vanilla JavaScript. It enables users to track personal expenses by category, visualize spending distribution through an interactive pie chart, and manage a budget — all without a backend server. All data is persisted in the browser's Local Storage. The app runs as a standalone web page or browser extension and targets modern browsers (Chrome, Firefox, Edge, Safari).

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense record consisting of an item name, amount, and category.
- **Category**: A label grouping transactions (e.g., Food, Transport, Fun, or a user-defined custom category).
- **Balance**: The running total computed by summing all transaction amounts.
- **Chart**: The pie chart rendered by Chart.js showing spending distribution across categories.
- **Local_Storage**: The browser's Web Storage API used to persist all application data client-side.
- **Transaction_List**: The scrollable UI element displaying all recorded transactions.
- **Input_Form**: The form UI element used to enter a new transaction.
- **Category_Manager**: The component responsible for managing built-in and custom categories.
- **Budget_Limit**: A user-defined spending threshold per category used to trigger highlight warnings.
- **Monthly_Summary**: An aggregated view of transactions filtered to a specific calendar month and year.
- **Theme**: The visual color scheme of the App, either light or dark mode.

---

## Requirements

### Requirement 1: Transaction Input

**User Story:** As a user, I want to add expense transactions through a form, so that I can record my spending quickly and accurately.

#### Acceptance Criteria

1. THE Input_Form SHALL contain a text field for Item Name (maximum 100 characters), a numeric field for Amount (accepting values from 0.01 to 999,999,999.99 with up to 2 decimal places), and a Category select field populated with all available categories.
2. WHEN the user submits the Input_Form with all fields filled and an Amount within the valid range, THE App SHALL create a new Transaction and add it to the Transaction_List.
3. WHEN the user submits the Input_Form with one or more empty fields, THE App SHALL display an inline validation error message adjacent to each empty field and SHALL NOT create a Transaction.
4. WHEN the user submits the Input_Form with an Amount that is zero, negative, non-numeric, exceeds 999,999,999.99, or has more than 2 decimal places, THE App SHALL display an inline validation error message adjacent to the Amount field and SHALL NOT create a Transaction.
5. WHEN a Transaction is successfully added, THE Input_Form SHALL reset the Item Name field to empty, the Amount field to empty, and the Category field to the first option (Food).

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see all my recorded transactions in a scrollable list, so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all stored Transactions, each showing the Item Name (up to 100 characters), Amount (formatted as a non-negative decimal number with exactly 2 decimal places), Category, and the date the Transaction was recorded.
2. WHILE the number of Transactions exceeds the visible area of the Transaction_List, THE App SHALL render the Transaction_List as a scrollable container.
3. THE Transaction_List SHALL display Transactions sorted by recorded date in descending order, with the most recent Transaction shown first.
4. WHEN the user deletes a Transaction, THE App SHALL remove that Transaction from the Transaction_List within 1 second without a page reload.
5. IF no Transactions are stored, THEN THE App SHALL display a message in the Transaction_List indicating that no transactions have been recorded.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total balance update automatically, so that I always know the current sum of my recorded expenses.

#### Acceptance Criteria

1. THE App SHALL display the current Balance as the first visible element in the main content area, above the Transaction list.
2. WHEN a Transaction is added, THE App SHALL recalculate and update the Balance display without a page reload.
3. WHEN a Transaction is deleted, THE App SHALL recalculate and update the Balance display without a page reload.
4. THE App SHALL display the Balance formatted with a "$" currency symbol prefix and exactly two decimal places (e.g., $1,234.56).
5. IF the Balance is negative, THEN THE App SHALL display the Balance with a "-" sign preceding the currency symbol (e.g., -$50.00).
6. IF no Transactions exist, THEN THE App SHALL display a Balance of $0.00.

---

### Requirement 4: Spending Distribution Chart

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can understand where my money is going at a glance.

#### Acceptance Criteria

1. THE Chart SHALL render a pie chart where each slice represents a Category that has at least one Transaction, sized proportionally to that Category's percentage of total spending, and labeled with its percentage value.
2. WHEN a Transaction is added, THE App SHALL update the Chart to reflect the new spending distribution within 1 second, without a page reload.
3. WHEN a Transaction is deleted, THE App SHALL update the Chart to reflect the revised spending distribution within 1 second, without a page reload.
4. THE Chart SHALL display a legend in which each Category is identified by its name and a unique color, where the color matches the corresponding slice in the pie chart.
5. WHEN all Transactions are removed, THE App SHALL display a message indicating that no spending data is available, in place of the Chart.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved between sessions, so that I do not lose my data when I close or refresh the browser.

#### Acceptance Criteria

1. WHEN a Transaction is added, THE App SHALL serialize the updated Transaction collection and write it to Local_Storage.
2. WHEN a Transaction is deleted, THE App SHALL serialize the updated Transaction collection and write it to Local_Storage.
3. WHEN the App loads, THE App SHALL read and deserialize the Transaction collection from Local_Storage and populate the Transaction_List, Balance, and Chart accordingly.
4. IF Local_Storage is unavailable or returns data that is not valid JSON or does not conform to the expected Transaction schema, THEN THE App SHALL initialize with an empty Transaction collection and display a non-blocking warning message to the user, where "non-blocking" means the user can continue to interact with the App without dismissing the warning.
5. THE App SHALL ensure that for any valid Transaction collection, serializing then deserializing the collection SHALL produce a collection that is identical in item count, item order, and all named per-item fields.

---

### Requirement 6: Category Management

**User Story:** As a user, I want to add custom categories beyond the defaults, so that I can tailor expense tracking to my own spending habits.

#### Acceptance Criteria

1. THE Category_Manager SHALL provide the built-in categories Food, Transport, and Fun as default options in the Category select field.
2. WHEN the user submits a new custom Category name that is non-empty, 50 characters or fewer, and not already present (compared case-insensitively), THE Category_Manager SHALL add the new Category to the Category select field and persist it to Local_Storage.
3. WHEN the user submits a custom Category name that is empty, exceeds 50 characters, or matches an existing Category name using a case-insensitive comparison, THE App SHALL display an inline validation error and SHALL NOT add the Category.
4. WHEN the App loads, THE Category_Manager SHALL restore all previously saved custom categories from Local_Storage and include them in the Category select field.
5. THE Category_Manager SHALL persist custom categories independently of Transactions so that removing all Transactions does not delete custom categories.

---

### Requirement 7: Monthly Summary View

**User Story:** As a user, I want to filter my transactions by month, so that I can review and compare my spending across different time periods.

#### Acceptance Criteria

1. THE App SHALL provide a month and year selector that filters the Transaction_List, Balance, and Chart to show only Transactions recorded in the selected month and year; on initial load, no filter SHALL be active and all Transactions SHALL be displayed.
2. WHEN the user selects a month and year, THE App SHALL update the Transaction_List, Balance, and Chart to reflect only the Transactions matching that period without a page reload.
3. WHEN the user clears the month filter, THE App SHALL restore the Transaction_List, Balance, and Chart to display all Transactions.
4. THE App SHALL display the total Balance for the filtered period when a monthly filter is active.

---

### Requirement 8: Transaction Sorting

**User Story:** As a user, I want to sort my transaction list by amount or category, so that I can find and compare expenses more easily.

#### Acceptance Criteria

1. THE Transaction_List SHALL provide sort controls allowing the user to sort Transactions by Amount (ascending and descending) or by Category (alphabetical ascending and descending); when no sort is selected, Transactions SHALL be displayed in descending date order (most recent first).
2. WHEN the user selects a sort option, THE App SHALL re-render the Transaction_List in the specified order without a page reload.
3. WHEN a new Transaction is added while a sort is active, THE App SHALL insert the new Transaction into the Transaction_List in the position consistent with the active sort order; if two Transactions have the same sort-key value, the one with the more recent recorded date SHALL appear first.
4. THE App SHALL preserve the active sort selection across page reloads by storing it in Local_Storage.

---

### Requirement 9: Budget Limit Warnings

**User Story:** As a user, I want to set a spending limit per category and be alerted when I exceed it, so that I can stay within my budget.

#### Acceptance Criteria

1. THE App SHALL allow the user to set a numeric Budget_Limit for any Category, accepting values from 0.01 to 999,999,999.99 with up to 2 decimal places.
2. WHEN the total Amount of Transactions in a Category exceeds the Budget_Limit for that Category, THE App SHALL highlight all Transactions belonging to that Category in the Transaction_List using a visually distinct background color that differs from the default Transaction row background.
3. WHEN the total Amount of Transactions in a Category exceeds the Budget_Limit for that Category, THE App SHALL display a warning message identifying the Category and the amount by which the limit has been exceeded.
4. WHEN Transactions are deleted and the total Amount for a Category falls at or below the Budget_Limit, THE App SHALL remove the highlight and warning for that Category.
5. THE App SHALL persist Budget_Limit values in Local_Storage and restore them on load.
6. WHEN the user submits a Budget_Limit that is zero, negative, non-numeric, exceeds 999,999,999.99, or has more than 2 decimal places, THE App SHALL display an inline validation error and SHALL NOT save the Budget_Limit.

---

### Requirement 10: Dark/Light Mode Toggle

**User Story:** As a user, I want to switch between dark and light themes, so that I can use the app comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE App SHALL provide a toggle control that switches the Theme between light mode and dark mode.
2. WHEN the user activates the toggle, THE App SHALL apply the selected Theme to all UI elements within 100 milliseconds, without a page reload.
3. THE App SHALL persist the user's Theme preference in Local_Storage and apply it on subsequent loads before the first render to prevent a flash of the default theme.
4. IF no Theme preference is stored in Local_Storage, THEN THE App SHALL default to the operating system's preferred color scheme as reported by the `prefers-color-scheme` media query.

---

### Requirement 11: Performance and Compatibility

**User Story:** As a user, I want the app to load quickly and respond without lag, so that I can add and review expenses without interruption.

#### Acceptance Criteria

1. THE App SHALL load and render the initial UI in under 2 seconds when loaded over a simulated 10 Mbps connection.
2. WHEN the user adds or deletes a Transaction, THE App SHALL update the Balance, Transaction_List, and Chart within 100 milliseconds of the action.
3. THE App SHALL pass all acceptance criteria defined in this document when tested on the latest stable versions of Chrome, Firefox, Edge, and Safari.
4. THE App SHALL use exactly one CSS file located in the `css/` directory and exactly one JavaScript file located in the `js/` directory.
