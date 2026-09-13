'use server';

import { revalidatePath } from 'next/cache';
import { requireArea } from '@dokta/auth';
import { db } from '@/lib/db';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function reference() {
  let body = '';
  for (let i = 0; i < 6; i += 1) body += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  const now = new Date();
  const stamp = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `POS-${body}-${stamp}`;
}

export async function lookupBarcode(pharmacyId: string, barcode: string) {
  await requireArea('/pharmacy/pos');
  const supabase = db();

  const { data: medicine } = await supabase
    .from('medicines')
    .select('id, name, strength, schedule')
    .eq('barcode', barcode.trim())
    .maybeSingle();

  if (!medicine) {
    return { ok: false as const, error: 'That barcode is not in the medicine catalogue.' };
  }

  const { data: item } = await supabase
    .from('inventory_items')
    .select('id, selling_price, stock_on_hand, is_active')
    .eq('pharmacy_id', pharmacyId)
    .eq('medicine_id', medicine.id)
    .maybeSingle();

  if (!item?.is_active) {
    return { ok: false as const, error: `${medicine.name} is not on your stock list. Add it first.` };
  }
  if (item.stock_on_hand === 0) {
    return { ok: false as const, error: `${medicine.name} is out of stock.` };
  }

  return {
    ok: true as const,
    product: {
      inventoryId: item.id,
      medicineId: medicine.id,
      name: medicine.name,
      strength: medicine.strength,
      unitPrice: Number(item.selling_price),
      stockOnHand: item.stock_on_hand,
      requiresPharmacist: medicine.schedule !== 'S0' && medicine.schedule !== 'S1',
    },
  };
}

export async function completeSale(input: {
  pharmacyId: string;
  lines: { inventoryId: string; medicineId: string; description: string; quantity: number; unitPrice: number }[];
  discount: number;
  gateway: 'cash' | 'yoco' | 'snapscan';
  tendered?: number;
}) {
  const session = await requireArea('/pharmacy/pos');

  // ring_up_sale deducts stock first-expiry-first and writes the sale in one
  // transaction, so a receipt can never exist for goods not in the shop.
  const { data, error } = await db().rpc('ring_up_sale', {
    p_pharmacy_id: input.pharmacyId,
    p_cashier_id: session.id,
    p_reference: reference(),
    p_lines: input.lines.map((l) => ({
      inventory_id: l.inventoryId,
      medicine_id: l.medicineId,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unitPrice,
    })),
    p_discount: input.discount,
    p_gateway: input.gateway,
    p_tendered: input.tendered ?? null,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/pharmacy/inventory');
  revalidatePath('/pharmacy/reports');

  return {
    ok: true as const,
    receipt: {
      ...(data as Record<string, unknown>),
      lines: input.lines,
      gateway: input.gateway,
      tendered: input.tendered ?? null,
      at: new Date().toISOString(),
    },
  };
}
