export type Role = 'patient' | 'doctor' | 'pharmacy' | 'clinic' | 'admin';

/**
 * Which area of the app each role lands in. RLS decides what data they can
 * reach; this only decides what they are shown.
 */
export const homeFor: Record<Role, string> = {
  patient: '/patient/appointments',
  doctor: '/doctor/appointments',
  pharmacy: '/pharmacy/pos',
  clinic: '/clinic/queue',
  admin: '/dashboard',
};

/** Route prefixes each role may open. Admin may open everything. */
export const areasFor: Record<Role, string[]> = {
  patient: ['/patient', '/dashboard'],
  doctor: ['/doctor', '/dashboard'],
  pharmacy: ['/pharmacy', '/dashboard'],
  clinic: ['/clinic', '/dashboard'],
  admin: ['/patient', '/doctor', '/pharmacy', '/clinic', '/dashboard'],
};

export function mayOpen(role: Role | null | undefined, path: string): boolean {
  if (!role) return false;
  return areasFor[role].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
