export default function Guide() {
  return (
    <div className="page" style={{ paddingBottom: 100 }}>
      <h1 className="page-title">Financial Module Guide</h1>

      <Section title="1. Income Pool">
        <P>The Income Pool is the total money you have available for the current period (month). Every financial operation in BudgetWise revolves around this pool.</P>
        <P><B>Adding Income:</B> Navigate to the Budget page. Tap "Add Income" at the top of the Income Pool card. Enter the amount and source description. If you are currently in deficit (allocated more than earned), you must provide a deficit note explaining the income source.</P>
        <P><B>Income Pool Balance</B> = Total Income - Total Allocated Across All Budgets.</P>
        <P><B>Deleting Income:</B> Open the Income Pool card to see the income history. You can delete an income entry, but only if the resulting balance does not exceed your configured negative limit. If you need to delete an income but budgets are in the way, delete or reduce budgets first.</P>
      </Section>

      <Section title="2. Budgets">
        <P>A budget is a spending allocation drawn from your Income Pool. Each budget has a name, category, allocated amount, and remaining amount.</P>
        <P><B>Creating a Budget:</B> Tap the + button on the Budget page. Choose a name, category, and amount. The system checks that your pool balance (after this allocation) does not go below the negative limit. If funds are insufficient, the creation is rejected.</P>
        <P><B>How Allocation Works:</B> When you create a budget for PKR 5,000, that amount is deducted from your pool balance and assigned to the budget. The budget starts with remaining = allocated.</P>
        <P><B>Editing a Budget:</B> Open the budget detail (tap the card), then tap the pencil icon. You can rename the budget and change its category. You cannot change the allocated amount directly -- use "Add Funds" instead.</P>
        <P><B>Add Funds:</B> When a budget is exhausted (remaining = 0), the "Add Funds" button appears. This draws additional funds from the Income Pool into the budget. A note is required explaining why extra funds are needed. The same pool balance check applies.</P>
        <P><B>Deleting a Budget:</B> Deleting a budget removes it and all its expenses permanently. The allocated amount returns to the Income Pool automatically (since the pool balance is calculated from existing budgets).</P>
        <P><B>Categories:</B> Budgets are grouped by category on the Budget page. Categories are: General, Food, Transport, Shopping, Bills, Health, Education, Entertainment, Other.</P>
      </Section>

      <Section title="3. Expenses">
        <P>Expenses are individual spending records logged against a specific budget.</P>
        <P><B>Logging an Expense:</B> On the Budget page, tap "Log Expense" on any budget card. Enter description and amount. The amount cannot exceed the budget's remaining balance. If the budget is exhausted, you must add funds first.</P>
        <P><B>Editing an Expense:</B> Open the budget detail, then tap the pencil icon on any expense. You can change the description and amount. If you increase the amount, the difference is deducted from the budget's remaining balance. If you decrease the amount, the difference is returned to the remaining balance.</P>
        <P><B>Deleting an Expense:</B> Deleting an expense restores its full amount back to the budget's remaining balance.</P>
        <P><B>Important:</B> Expenses only reduce the budget's remaining amount, not the Income Pool. The pool is only affected by budget creation, deletion, and add-funds.</P>
      </Section>

      <Section title="4. Negative Limit">
        <P>The negative limit (configured in Settings) controls how far your Income Pool balance can go into the negative when allocating budgets.</P>
        <P><B>Example:</B> If your total income is PKR 50,000 and negative limit is PKR 5,000, you can allocate up to PKR 55,000 across budgets. This is useful when you expect income later in the month but need to plan budgets now.</P>
        <P><B>Setting it to 0</B> means you cannot allocate more than you have earned. This is the safest option.</P>
        <P>The negative limit applies to: creating budgets, adding funds to budgets, and deleting income. It does not apply to logging expenses (expenses are limited by the budget's remaining amount, not the pool).</P>
      </Section>

      <Section title="5. Period System">
        <P>BudgetWise operates on a monthly period system. All income, budgets, and expenses belong to a specific month/year period.</P>
        <P><B>Current Period:</B> Displayed in Settings. By default, it matches the current calendar month. All new income and budgets are assigned to the current period.</P>
        <P><B>Viewing Past Periods:</B> Go to the History page. Select any of the past 12 months to see what budgets existed, how much was allocated, spent, and remaining. Tap any budget to see its individual expenses.</P>
        <P>Past period data is read-only in the History view. It serves as a record of your financial activity.</P>
      </Section>

      <Section title="6. Month-End Rollover">
        <P>Rollover is the process of capturing unspent money at the end of a month and recording it as savings. This is a manual action you must trigger yourself.</P>

        <P><B>When to Run Rollover:</B></P>
        <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <li>Run rollover after a month ends and before you start the new month's budgeting.</li>
          <li>Typically, on the 1st of each month, run rollover for the previous month.</li>
          <li>You should run rollover before deleting any budgets from the past month, as deleted budgets are excluded from the calculation.</li>
        </ul>

        <P><B>How Rollover Works:</B></P>
        <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <li>For each budget in the selected month that has remaining amount greater than 0, a savings entry is created with that amount.</li>
          <li>If your total income exceeds total allocated (money you never assigned to any budget), a savings entry labeled "Unallocated Income" is created for that surplus.</li>
          <li>Rollover does not delete or modify budgets, expenses, or income. It only creates savings records.</li>
        </ul>

        <P><B>How to Run:</B> Go to the History page. In the "Month-End Rollover" section at the top, select the month and year, then tap "Run Rollover".</P>
        <P><B>Rollover is one-time per period.</B> Once you rollover a month, you cannot run it again for the same month. This prevents duplicate savings records.</P>
        <P><B>If all budgets were fully spent</B> and all income was allocated, rollover creates zero entries. This is normal.</P>
      </Section>

      <Section title="7. Savings">
        <P>The Savings page shows all savings entries created by rollover, grouped by year and month.</P>
        <P>Each entry shows: the budget name (or "Unallocated Income"), the saved amount, and the original allocation for context.</P>
        <P>Savings are display-only. They serve as a historical record of money you did not spend each month. The yearly and monthly totals are calculated automatically.</P>
      </Section>

      <Section title="8. Data Safety">
        <P><B>Export Backup:</B> In Settings, tap "Export Backup" to download a complete snapshot of all your data as a JSON file. Do this regularly, and always before using "Delete All Data".</P>
        <P><B>Import Backup:</B> In Settings, tap "Import Backup" and select a previously exported JSON file. This replaces all current data with the backup. If the import fails for any reason, your previous data is automatically restored.</P>
        <P><B>Delete All Data:</B> In Settings under Danger Zone. This permanently removes all income, budgets, expenses, routines, savings, notes, and tags. Settings are reset to defaults. This action cannot be undone unless you have a backup.</P>
      </Section>

      <Section title="9. Common Scenarios">
        <P><B>Scenario: Starting a new month.</B></P>
        <P>1. Go to History. Run rollover for the previous month. 2. Verify savings appear in the Savings page. 3. Go to Budget page. Add your new month's income. 4. Create budgets for the new month.</P>

        <P><B>Scenario: Budget runs out mid-month.</B></P>
        <P>1. The budget card shows "Add Funds" instead of "Log Expense". 2. Tap "Add Funds", enter the additional amount and a note. 3. The funds are drawn from the remaining Income Pool balance. 4. Continue logging expenses.</P>

        <P><B>Scenario: You receive unexpected income mid-month.</B></P>
        <P>1. Go to Budget page, tap "Add Income". 2. Enter amount and source. 3. The Income Pool balance increases. 4. You can now create new budgets or add funds to existing ones.</P>

        <P><B>Scenario: You logged an expense by mistake.</B></P>
        <P>1. Tap the budget card to open detail. 2. Find the expense and tap the pencil icon to edit, or the trash icon to delete. 3. The budget's remaining balance is adjusted automatically.</P>

        <P><B>Scenario: You want to see last month's spending.</B></P>
        <P>1. Go to History page. 2. Tap the month you want to review. 3. All budgets from that month appear with their allocation, spent, and remaining amounts. 4. Tap any budget to see individual expenses.</P>
      </Section>

      <Section title="10. Rules Summary">
        <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <li>Income Pool Balance = Total Income - Total Allocated.</li>
          <li>You cannot allocate beyond Income + Negative Limit.</li>
          <li>You cannot log an expense exceeding the budget's remaining amount.</li>
          <li>You cannot delete income if the resulting balance would breach the negative limit.</li>
          <li>Deleting a budget returns its allocation to the pool and removes all its expenses.</li>
          <li>Deleting an expense restores its amount to the budget's remaining balance.</li>
          <li>Rollover captures unspent budget amounts and unallocated income as savings.</li>
          <li>Rollover is irreversible and one-time per month.</li>
          <li>All currency calculations are rounded to 2 decimal places to prevent floating-point errors.</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>{title}</h2>
      {children}
    </div>
  );
}

function P({ children }) {
  return <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 10 }}>{children}</p>;
}

function B({ children }) {
  return <strong style={{ color: 'var(--text-primary)' }}>{children}</strong>;
}
