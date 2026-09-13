import { admin, audit, caller, fail, json } from '../_shared/db.ts';
import { reference, round, vatFromInclusive } from '../_shared/money.ts';

/**
 * Turns an approved prescription into a priced order and takes the stock off
 * the shelf.
 *
 * This runs as an edge function rather than in the browser because it is the
 * one operation that must be atomic across three tables. A half-finished
 * dispense leaves either stock that vanished or medicine handed over with no
 * order against it.
 */
Deno.serve(async (request) => {
  if (request.method !== 'POST') return fail('POST only', 405);

  const user = await caller(request);
  if (!user) return fail('Sign in first', 401);
  if (!['pharmacy', 'admin'].includes(user.role)) return fail('Not permitted', 403);

  const { prescriptionId, pharmacyId, fulfilment, deliveryAddress, substitutions } =
    await request.json();

  const db = admin();

  // The caller must actually work at this pharmacy.
  const { data: staffs } = await db
    .from('pharmacy_staff')
    .select('can_dispense')
    .eq('pharmacy_id', pharmacyId)
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: owned } = await db
    .from('pharmacies')
    .select('id, name, delivery_fee, offers_delivery')
    .eq('id', pharmacyId)
    .maybeSingle();

  const isOwner = owned && (await db
    .from('pharmacies').select('owner_id').eq('id', pharmacyId).single()).data?.owner_id === user.id;

  if (!isOwner && !staffs) return fail('You do not work at that pharmacy', 403);
  if (!isOwner && !staffs.can_dispense) {
    return fail('Only a pharmacist may dispense', 403);
  }

  const { data: script } = await db
    .from('prescriptions')
    .select('id, patient_id, pharmacy_id, status, valid_until, repeats, repeats_used, prescription_items(*)')
    .eq('id', prescriptionId)
    .single();

  if (!script) return fail('Prescription not found', 404);
  if (script.pharmacy_id !== pharmacyId) return fail('That script was sent to another pharmacy', 409);
  if (new Date(script.valid_until) < new Date()) return fail('This prescription has expired', 409);
  if (script.status === 'dispensed' && script.repeats_used >= script.repeats) {
    return fail('No repeats left on this prescription', 409);
  }
  if (fulfilment === 'delivery' && !owned?.offers_delivery) {
    return fail('This pharmacy does not deliver', 409);
  }
  if (fulfilment === 'delivery' && !deliveryAddress) {
    return fail('A delivery needs an address', 400);
  }

  // Price every line against this pharmacy's own stock.
  const lines: {
    inventory_id: string;
    medicine_id: string;
    description: string;
    quantity: number;
    unit_price: number;
  }[] = [];

  for (const item of script.prescription_items) {
    const medicineId = substitutions?.[item.id] ?? item.medicine_id;
    if (!medicineId) return fail(`${item.medicine_name} is not linked to a product`, 409);
    if (substitutions?.[item.id] && !item.substitutable) {
      return fail(`${item.medicine_name} was marked no-substitution by the doctor`, 409);
    }

    const { data: stock } = await db
      .from('inventory_items')
      .select('id, selling_price, stock_on_hand, medicines(name, strength)')
      .eq('pharmacy_id', pharmacyId)
      .eq('medicine_id', medicineId)
      .maybeSingle();

    if (!stock) return fail(`${item.medicine_name} is not stocked here`, 409);
    if (stock.stock_on_hand < item.quantity) {
      return fail(`Only ${stock.stock_on_hand} of ${item.medicine_name} on hand`, 409);
    }

    lines.push({
      inventory_id: stock.id,
      medicine_id: medicineId,
      description: `${stock.medicines.name} ${stock.medicines.strength ?? ''}`.trim(),
      quantity: item.quantity,
      unit_price: Number(stock.selling_price),
    });
  }

  // Hand off to the stored procedure so stock, order and script move together
  // inside one transaction. An edge function cannot open a transaction itself.
  const deliveryFee = fulfilment === 'delivery' ? Number(owned!.delivery_fee) : 0;
  const subtotal = round(lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0));
  const total = round(subtotal + deliveryFee);

  const { data: order, error } = await db.rpc('dispense_prescription', {
    p_prescription_id: prescriptionId,
    p_pharmacy_id: pharmacyId,
    p_reference: reference('ORD'),
    p_fulfilment: fulfilment,
    p_delivery_address: deliveryAddress ?? null,
    p_delivery_fee: deliveryFee,
    p_subtotal: subtotal,
    p_vat: vatFromInclusive(subtotal),
    p_total: total,
    p_lines: lines,
  });

  if (error) {
    console.error('[dispense] transaction failed', error);
    return fail(error.message ?? 'Could not dispense. Nothing was changed.', 409);
  }

  await audit({
    actorId: user.id,
    action: 'update',
    entity: 'Prescription',
    entityId: prescriptionId,
    subjectId: script.patient_id,
    lawfulBasis: 'provision_of_healthcare',
    metadata: { orderReference: order.reference, lines: lines.length },
  });

  return json({ orderId: order.id, reference: order.reference, total });
});
