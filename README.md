# Suppliq

A multi-tenant SaaS ERP for electronics and industrial distributors. Covers the full operational cycle — point of sale, inventory, procurement, supplier invoice matching, stock transfers, expense tracking, customer credit, and an AI layer that turns historical data into actionable intelligence.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict, end-to-end) |
| Framework | Next.js 14 App Router |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL |
| ORM | Prisma 5 |
| Authentication | NextAuth.js v5 (credentials, JWT) |
| State management | Zustand (POS cart) |
| Charts | Recharts |
| Validation | Zod + React Hook Form |
| AI microservice | Python + FastAPI |
| AI model | Claude (Anthropic) |
| Billing | Stripe |
| Email | Resend |

---

## Plans

Three tiers gated in `lib/plans.ts` and enforced at the page level:

| Plan | Price | Included |
|---|---|---|
| **Starter** | €29/mo (14-day trial) | Full core ERP + Sales report |
| **Growth** | — | + P&L report, Stock Movements report, Reorder Alerts (top 5) |
| **Enterprise** | — | + all AI modules with full Claude reasoning |

---

## Features

### Point of Sale

- Live item search by name or SKU (debounced, branch-scoped)
- Three price tiers per item: **Retail**, **Wholesale**, **Special** — cart reprices instantly when switching
- Attach a customer, set payment as **Paid** or **On Credit**
- Discount input with live change calculation
- Stock validation on the server before committing — rejects the sale if any item is unavailable
- Atomic transaction: sale record + stock decrement + credit balance update in a single `$transaction()`
- Printable thermal receipt: receipt number (`RCP-YYYYMMDD-XXXX`), served-by, itemised lines with SKU and price snapshot, VAT breakdown, QR code for branch WhatsApp

---

### Dashboard

**Admin view**
- System-wide totals across all branches
- Per-branch cards: today's revenue, sales count, outstanding credit, low-stock alert count, 7-day revenue bar chart, top 5 items by quantity, top 5 debtors

**Manager / Cashier view**
- Today's sales count and revenue
- Low-stock alert list with item name and quantity vs. threshold

---

### Inventory

- Item records: SKU, name, category, supplier, three price tiers, cost price, lead time, reorder point
- Per-item, per-branch stock quantity and low-stock threshold
- Soft delete: deactivate/reactivate items without losing history
- Admin sees all branches; non-admin sees only their branch

---

### Purchase Orders

Full PO lifecycle with six statuses: **DRAFT → SENT → CONFIRMED → PARTIAL → RECEIVED / CANCELLED**

- Line items with unit cost and received quantity (supports partial deliveries)
- Supplier invoice matching on every PO: invoice reference, amount, date, and status (**NONE → RECEIVED → PAID / DISPUTED**)
- Payment recorded against invoice with timestamp and who approved it
- Payables summary: outstanding invoice totals by status and supplier

---

### Stock Transfers

Branch-to-branch stock movements with a four-step lifecycle: **PENDING → IN_TRANSIT → RECEIVED / CANCELLED**

- Raise a transfer request with line items
- **PENDING**: created, awaiting approval
- **IN_TRANSIT**: stock dispatched from source, TRANSFER_OUT log created; TRANSFER_IN log created on receipt
- **RECEIVED**: full audit trail of both legs in the stock log
- Stats: total transfers, in-transit value, completed this month

---

### Expenses

- Record operating expenses by category: Rent, Salaries, Utilities, Transport, Maintenance, Marketing, Other
- Branch-scoped or org-wide
- Summary stats: total spend, monthly breakdown, category totals
- Date-range filtering and branch filter for admin

---

### Customers

- Customer records with name, phone, address, and home branch
- Credit balance tracking: increases on credit sales, decreases when payments are recorded
- Record credit payment: atomic transaction creates the payment record and decrements the balance simultaneously
- Customer detail page: full purchase history + full payment history
- Filter by credit status: All / Has Credit / No Credit

---

### Suppliers

- Supplier records: name, phone, email, address, notes
- Summary stats: total items sourced, total POs, total spend from cost prices
- Supplier detail: lists all supplied items with current stock levels and full PO history

---

### Reports

Manager and Admin only.

- **Sales report**: revenue by date range, retail vs. wholesale breakdown, full receipt table, CSV export
- **P&L report** (Growth+): revenue, expenses, and purchases in one view
- **Stock Movements report** (Growth+): full stock log with reason codes
- Void a receipt (Admin only): marks the sale void, records reason and timestamp, restores all stock items atomically

---

### Employee Management

Admin only.

- Create accounts with role: **Cashier**, **Manager**, or **Admin**
- Assign to a branch
- Activate / deactivate (soft delete)
- Reset passwords (bcrypt, server-side)
- Per-employee sales stats: count and total revenue

---

### Branch Management

Admin only. Create and manage locations (name, address, phone). Per-branch stats: employee count, customer count, total sales.

---

### Audit Log

Admin only. Immutable trail of all system events: sales, voids, stock movements, PO changes, user logins, credit payments. Each entry records the action type, entity, description, and the user who performed it.

---

### Settings

- **Profile**: name and password update
- **Organisation**: name, contact details, VAT number, currency, timezone — these populate receipts and documents
- **Billing**: Stripe-powered plan management with subscription status, current period, and upgrade/downgrade flow

---

## AI Layer (Enterprise)

A Python + FastAPI microservice called by the Next.js app via an internal HTTP client. All reasoning is generated by Claude.

### Reorder Alerts
Analyses sales velocity, current stock, lead times, and reorder points across all branches. Returns ranked recommendations with priority (critical / high / medium / low), suggested order quantity, estimated days until stockout, and Claude-generated reasoning. Growth plan gets the top-5 list without reasoning; Enterprise unlocks all items with full explanations.

### Overstock Detection
Identifies items where stock exceeds realistic demand. Calculates days of cover, excess units, and capital tied up. Flags transfer opportunities to understocked branches with estimated impact on days of cover at the destination.

### Transfer Recommendations
Finds cross-branch redistribution opportunities where moving stock from an overstocked branch to an understocked one avoids a reorder. Ranks by priority, shows capital freed, and estimates reorder savings.

### ABC/XYZ Analysis
Classifies every item on two axes:
- **ABC** (revenue contribution): A = top 80%, B = next 15%, C = bottom 5%
- **XYZ** (demand variability): X = stable, Y = variable, Z = erratic

Combined class (e.g. AX, BZ) drives stocking strategy. Includes a 3×3 matrix heatmap and per-item rank with action recommendation.

### Anomaly Detection
Scans recent stock logs and expense records against historical baselines. Detects four anomaly types:
- **Sales spike** — item sold far above its usual rate
- **Sales drop** — item with consistent history goes quiet
- **Stock shrinkage** — manual adjustment logs indicating unexplained loss
- **Expense outlier** — single expense significantly above category average

Each anomaly includes severity (critical / warning), description, and a suggested action.

### Cash Flow Forecasting
Projects daily cash flow for the current month. Combines actual revenue and expenses already recorded with expected purchase costs from pending and confirmed POs. Outputs a daily net cash curve with cumulative balance, plus itemised upcoming purchases that need funding.

### Weekly AI Briefing
Every Monday, Claude writes a plain-English digest for the org covering:
- Top stockout risks with days of cover
- Biggest anomaly of the week
- Supplier performance watch (order count, average lead days)
- A single recommended operational action

Delivered as an in-app card with an unread badge in the sidebar. Also generates an email-ready copy. Results are cached per org per week (no re-generation on page refresh).

### Market Intelligence
Fetches live supply-chain news and commodity prices relevant to the organisation's industry keywords. Claude summarises each article with a relevance score, sentiment (positive / negative / neutral), and impact tags. Commodity price section shows live spot prices with 24h change. FX rate strip for relevant currency pairs. Results cached for 2 hours.

---

## Architecture

### Multi-tenancy
Every row in every table carries `organizationId`. All queries are scoped to the authenticated user's org. Branches provide a second scope — non-admin users only see data for their assigned branch.

### Price snapshot
`SaleItem.unitPrice` stores the price at the time of sale. Price changes never affect historical receipts.

### Atomic transactions
All multi-step writes use `prisma.$transaction()`: sale + stock + credit, payment + balance, PO receipt + stock increment, void + stock restore, transfer dispatch + log.

### VAT
UK 20% VAT. Prices are stored and displayed VAT-inclusive. VAT is extracted from totals using `total × (20/120)` on the server.

### Role enforcement
Three roles: **CASHIER**, **MANAGER**, **ADMIN**. Access is checked in server components and server actions — no client-side role logic. Non-admin queries are automatically branch-scoped.

### Stock log
Every stock movement (sale, void, purchase receipt, transfer in/out, manual adjustment) writes an immutable `StockLog` row with reason code, reference ID, and recorder. This gives the AI microservice a complete auditable history to analyse.

---

## Database Models

```
Organization → Branch → User
                      → BranchStock ← Item ← Category
                                            ← Supplier → PurchaseOrder → PurchaseOrderItem
Organization → Sale → SaleItem
             → Customer → CreditPayment
             → StockTransfer → StockTransferItem
             → Expense
             → StockLog
             → Forecast
             → WeeklyBriefing
             → AuditLog
```

---

## Author

**Janice Ngugi**
GitHub: [@janicefoi](https://github.com/janicefoi)
