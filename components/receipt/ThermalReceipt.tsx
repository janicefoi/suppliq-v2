import QRCode from "react-qr-code";
import type { SaleResult } from "@/lib/actions/pos";
import { SHOP } from "@/lib/constants/shop";

function toWaNumber(phone: string) {
  return phone.replace(/\D/g, "");
}

function money(v: string | number) {
  return Number(v).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Dashes() {
  return <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }} />;
}

interface ThermalReceiptProps {
  sale: SaleResult;
  amountGiven?: number;
}

export function ThermalReceipt({ sale, amountGiven = 0 }: ThermalReceiptProps) {
  const shopName    = SHOP.name;
  const shopAddress = sale.branch?.address ?? SHOP.address;
  const shopPhone   = sale.branch?.phone   ?? SHOP.phone;
  const shopPin     = sale.branch?.pin     ?? "";
  const shopPaybill = sale.branch?.paybill ?? "";
  const waUrl       = `https://wa.me/${toWaNumber(shopPhone)}`;

  const createdAt = new Date(sale.createdAt);
  const dayName   = createdAt.toLocaleDateString("en-KE", { weekday: "long" });
  const datePart  = createdAt.toLocaleDateString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  const timePart  = createdAt.toLocaleTimeString("en-KE", {
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

      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "6px" }}>
        <div style={{ backgroundColor: "#38bdf8", borderRadius: "6px", padding: "4px 10px", display: "inline-block" }}>
          <img src="/logo.svg" alt="JSH" style={{ width: "160px", height: "55px", display: "block" }} />
        </div>
      </div>

      {/* ── Shop header ───────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "13px", letterSpacing: "0.5px" }}>
        {shopName}
      </div>

      <div style={{ fontSize: "10px", marginTop: "3px" }}>{shopAddress}</div>

      <div style={{ fontSize: "10px" }}>
        Phone:{shopPhone}
        {shopPin ? `  PIN: ${shopPin}` : ""}
      </div>

      <div style={{ fontSize: "10px" }}>Date :{fullDate}</div>

      {sale.customer && (
        <div style={{ fontSize: "10px" }}>
          Client :{sale.customer.name.toUpperCase()}
        </div>
      )}

      <div style={{ fontSize: "10px" }}>Served By :{sale.employee.name}</div>

      <div style={{ fontSize: "10px" }}>
        {shopPaybill ? `PAYBILL NO: ${shopPaybill}  ` : ""}
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
          {/* Item name */}
          <div style={{ fontSize: "11px", fontWeight: "600" }}>
            {line.item.name}
          </div>
          {/* SKU + columns */}
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
        <span>SUB-TOTAL (Ksh):</span>
        <span>{money(subTotalExVat)}</span>
      </div>
      <div style={row}>
        <span>VAT:</span>
        <span>{money(tax)}</span>
      </div>

      <Dashes />

      {/* ── Grand total ───────────────────────────────────────────────── */}
      <div style={{ ...row, fontWeight: "bold", fontSize: "13px" }}>
        <span>TOTAL (Ksh):</span>
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
          <span>KES {money(sale.customer.creditBalance)}</span>
        </div>
      )}

      <div style={row}>
        <span>CHANGE:</span>
        <span>{money(Math.max(0, amountGiven - total))}</span>
      </div>

      <Dashes />

      {/* ── VAT codes footer ──────────────────────────────────────────── */}
      <div style={{ ...row, marginBottom: "8px" }}>
        <span>CODE V: VAT= 16%</span>
        <span>CODE E: EXEMPT= 0%</span>
      </div>

      {/* ── Thank you message ─────────────────────────────────────────── */}
      <div style={{ textAlign: "center", fontSize: "11px", fontWeight: "600", margin: "6px 0 4px" }}>
        Thank you for choosing JSH Motorcycle Spare Parts!
      </div>
      <div style={{ textAlign: "center", fontSize: "10px", color: "#333", marginBottom: "6px" }}>
        We appreciate your business. See you again!
      </div>

      {/* ── QR code ───────────────────────────────────────────────────── */}
      <Dashes />
      <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 4px" }}>
        <QRCode value={waUrl} size={64} fgColor="#000000" bgColor="#ffffff" level="M" />
      </div>
      <div style={{ textAlign: "center", fontSize: "9px", color: "#555" }}>
        Scan to chat with us on WhatsApp
      </div>

    </div>
  );
}
