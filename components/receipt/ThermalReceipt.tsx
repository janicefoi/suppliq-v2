import type { SaleResult } from "@/lib/actions/pos";
import { SHOP } from "@/lib/constants/shop";

function Dashes() {
  return <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }} />;
}

interface ThermalReceiptProps {
  sale: SaleResult;
  amountGiven?: number;
  currency?: string;
}

export function ThermalReceipt({ sale, amountGiven = 0, currency = "EUR" }: ThermalReceiptProps) {
  function money(v: string | number) {
    return Number(v).toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  const shopName    = SHOP.name;
  const shopAddress = sale.branch?.address ?? SHOP.address;
  const shopPhone   = sale.branch?.phone   ?? SHOP.phone;
  const shopPin     = sale.branch?.pin     ?? "";
  const shopPaybill = sale.branch?.paybill ?? "";

  const createdAt = new Date(sale.createdAt);
  const dayName   = createdAt.toLocaleDateString("en-GB", { weekday: "long" });
  const datePart  = createdAt.toLocaleDateString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  const timePart  = createdAt.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const fullDate  = `${dayName}, ${datePart} ${timePart}`;

  const total         = Number(sale.totalAmount);
  const tax           = Number(sale.taxAmount);
  const discount      = Number(sale.discountAmount);
  const subTotalExVat = total - tax;
  const isCreditSale  = sale.paymentStatus === "CREDIT";

  const base: React.CSSProperties = {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: "11px",
    maxWidth: "302px",
    width: "100%",
    color: "#000",
    backgroundColor: "#fff",
    padding: "12px 8px",
    lineHeight: 1.45,
  };

  const row: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "10px",
  };

  return (
    <div className="thermal-receipt-print" style={base}>

      {/* ── Shop header ───────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "15px", letterSpacing: "0.5px", marginBottom: "2px" }}>
        {shopName}
      </div>

      <div style={{ fontSize: "10px", marginTop: "3px" }}>{shopAddress}</div>

      <div style={{ fontSize: "10px" }}>
        Phone:{shopPhone}
        {shopPin ? `  Tax ID: ${shopPin}` : ""}
      </div>

      <div style={{ fontSize: "10px" }}>Date :{fullDate}</div>

      {sale.customer && (
        <div style={{ fontSize: "10px" }}>
          Client :{sale.customer.name.toUpperCase()}
        </div>
      )}

      <div style={{ fontSize: "10px" }}>Served By :{sale.employee.name}</div>

      <div style={{ fontSize: "10px" }}>
        {shopPaybill ? `Pay Ref: ${shopPaybill}  ` : ""}
        Ord No: {sale.receiptNumber}
      </div>

      <Dashes />

      {/* ── Column headers ────────────────────────────────────────────── */}
      <div style={{ display: "flex", fontSize: "10px", fontWeight: "600" }}>
        <span style={{ flex: 1 }}>Description</span>
        <span style={{ width: "26px", textAlign: "right" }}>Qty</span>
        <span style={{ width: "56px", textAlign: "right" }}>Price</span>
        <span style={{ width: "62px", textAlign: "right" }}>Subtotal</span>
        <span style={{ width: "14px", textAlign: "right" }}>TC</span>
      </div>

      <Dashes />

      {/* ── Items ─────────────────────────────────────────────────────── */}
      {sale.items.map((line, idx) => (
        <div key={idx} style={{ marginBottom: "5px" }}>
          <div style={{ fontSize: "11px", fontWeight: "600" }}>
            {line.item.name}
          </div>
          <div style={{ display: "flex", fontSize: "10px", color: "#222" }}>
            <span style={{ flex: 1 }}>{line.item.sku}</span>
            <span style={{ width: "26px", textAlign: "right" }}>{line.quantity}</span>
            <span style={{ width: "56px", textAlign: "right" }}>{money(line.unitPrice)}</span>
            <span style={{ width: "62px", textAlign: "right" }}>{money(line.subtotal)}</span>
            <span style={{ width: "14px", textAlign: "right" }}>V</span>
          </div>
        </div>
      ))}

      {/* ── Item count ────────────────────────────────────────────────── */}
      <div style={{
        textAlign: "center",
        fontSize: "10px",
        borderTop: "1px dashed #000",
        borderBottom: "1px dashed #000",
        padding: "3px 0",
        margin: "4px 0",
      }}>
        ---- {sale.items.length} Item(s) ----
      </div>

      {/* ── Subtotals ─────────────────────────────────────────────────── */}
      <div style={row}>
        <span>SUB-TOTAL:</span>
        <span>{money(subTotalExVat)}</span>
      </div>
      <div style={row}>
        <span>VAT:</span>
        <span>{money(tax)}</span>
      </div>

      <Dashes />

      {/* ── Grand total ───────────────────────────────────────────────── */}
      <div style={{ ...row, fontWeight: "bold", fontSize: "13px" }}>
        <span>TOTAL:</span>
        <span>{money(total)}</span>
      </div>

      <div style={row}>
        <span>DISCOUNT:</span>
        <span>{money(discount)}</span>
      </div>

      {/* ── Credit status ─────────────────────────────────────────────── */}
      {isCreditSale && (
        <div style={{ ...row, fontWeight: "bold" }}>
          <span>PAYMENT STATUS:</span>
          <span>CREDIT</span>
        </div>
      )}
      {isCreditSale && sale.customer && (
        <div style={row}>
          <span>CREDIT BALANCE:</span>
          <span>{currency} {money(sale.customer.creditBalance)}</span>
        </div>
      )}

      <div style={row}>
        <span>CHANGE:</span>
        <span>{money(Math.max(0, amountGiven - total))}</span>
      </div>

      <Dashes />

      {/* ── Thank you message ─────────────────────────────────────────── */}
      <div style={{ textAlign: "center", fontSize: "11px", fontWeight: "600", margin: "6px 0 2px" }}>
        Thank you for shopping with {shopName}!
      </div>

    </div>
  );
}
