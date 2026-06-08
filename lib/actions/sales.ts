"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function voidSale(
  saleId: string,
  reason: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.role !== "ADMIN") return { success: false, error: "Only admins can void receipts." };

  const trimmedReason = reason.trim();
  if (!trimmedReason) return { success: false, error: "A reason is required to void a receipt." };

  try {
    await db.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: true },
      });

      if (!sale) throw new Error("Receipt not found.");
      if (sale.isVoid) throw new Error("This receipt is already voided.");

      await tx.sale.update({
        where: { id: saleId },
        data: { isVoid: true, voidReason: trimmedReason, voidedAt: new Date() },
      });

      if (sale.branchId) {
        for (const line of sale.items) {
          await tx.branchStock.update({
            where: { itemId_branchId: { itemId: line.itemId, branchId: sale.branchId! } },
            data: { stockQty: { increment: line.quantity } },
          });
        }
      }

      if (sale.paymentStatus === "CREDIT" && sale.customerId) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { creditBalance: { decrement: Number(sale.totalAmount) } },
        });
      }
    });

    revalidatePath("/dashboard");
    revalidatePath("/reports");

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to void receipt.";
    return { success: false, error: msg };
  }
}
