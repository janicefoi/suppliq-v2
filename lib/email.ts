import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM =
  process.env.EMAIL_FROM ?? "Suppliq Alerts <alerts@suppliq.com>";

export type LowStockEmailItem = {
  name: string;
  sku: string;
  stockQty: number;
  lowStockThreshold: number;
  branchName: string;
};

export async function sendLowStockAlert(
  toEmails: string[],
  orgName: string,
  items: LowStockEmailItem[]
): Promise<void> {
  if (!resend || toEmails.length === 0 || items.length === 0) return;

  const itemRows = items
    .map(
      (i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">${i.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:12px;color:#94a3b8;">${i.sku}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;">${i.branchName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:${i.stockQty === 0 ? "#dc2626" : "#d97706"};">${i.stockQty === 0 ? "OUT" : i.stockQty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#94a3b8;">${i.lowStockThreshold}</td>
    </tr>`
    )
    .join("");

  const subject =
    items.length === 1
      ? `Low stock: "${items[0].name}" needs restocking`
      : `Low stock alert: ${items.length} items need restocking`;

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;padding:0 16px;">
    <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">

      <div style="background:#1e293b;padding:20px 24px;">
        <p style="margin:0;color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Suppliq</p>
        <h1 style="margin:4px 0 0;color:white;font-size:20px;font-weight:700;">Low Stock Alert</h1>
      </div>

      <div style="padding:24px;">
        <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#0f172a;">
          ${items.length} item${items.length > 1 ? "s" : ""} below minimum stock
        </p>
        <p style="margin:0 0 20px;font-size:13px;color:#64748b;">
          The following items at <strong>${orgName}</strong> have dropped below their reorder threshold.
        </p>

        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e2e8f0;">Item</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e2e8f0;">SKU</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e2e8f0;">Branch</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e2e8f0;">Stock</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e2e8f0;">Min</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <div style="margin-top:20px;padding:12px 16px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;">
          <p style="margin:0;font-size:13px;color:#1d4ed8;">
            Log in to Suppliq to review inventory and create purchase orders.
          </p>
        </div>
      </div>

      <div style="padding:16px 24px;border-top:1px solid #f1f5f9;text-align:center;">
        <p style="margin:0;font-size:11px;color:#94a3b8;">
          You received this alert because you are an admin of <strong>${orgName}</strong> on Suppliq.
          These alerts fire when a sale pushes an item below its minimum stock threshold.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  await resend.emails.send({ from: FROM, to: toEmails, subject, html });
}
