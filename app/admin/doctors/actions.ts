'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { audit, requireArea, supabaseAdmin } from '@dokta/auth';

const doctorSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the doctor’s full name'),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().regex(/^\+27[6-8][0-9]{8}$/, 'Use South African format, for example +27821234567').optional().or(z.literal('')),
  speciality: z.string().trim().min(2, 'Enter a speciality'),
  hpcsaNumber: z.string().trim().regex(/^(MP|DP|PS|OT|PT)\s?[0-9]{5,7}$/i, 'Enter a valid HPCSA number'),
  practiceNumber: z.string().trim().optional().or(z.literal('')),
  yearsExperience: z.coerce.number().int().min(0).max(70),
  consultFee: z.coerce.number().min(0),
  followUpFee: z.union([z.coerce.number().min(0), z.literal('')]).optional(),
  city: z.string().trim().optional().or(z.literal('')),
  province: z.string().trim().optional().or(z.literal('')),
  languages: z.string().trim().default('English'),
  offersVideo: z.string().optional(),
  offersInPerson: z.string().optional(),
});

function target(message: string, type: 'ok' | 'error') {
  return `/admin/doctors?${type}=${encodeURIComponent(message)}`;
}

export async function createDoctor(formData: FormData) {
  const session = await requireArea('/admin/doctors');
  if (session.role !== 'admin') redirect('/dashboard');

  const parsed = doctorSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    speciality: formData.get('speciality'),
    hpcsaNumber: formData.get('hpcsaNumber'),
    practiceNumber: formData.get('practiceNumber'),
    yearsExperience: formData.get('yearsExperience'),
    consultFee: formData.get('consultFee'),
    followUpFee: formData.get('followUpFee'),
    city: formData.get('city'),
    province: formData.get('province'),
    languages: formData.get('languages'),
    offersVideo: formData.get('offersVideo') ?? undefined,
    offersInPerson: formData.get('offersInPerson') ?? undefined,
  });

  if (!parsed.success) redirect(target(parsed.error.issues[0].message, 'error'));

  const data = parsed.data;
  const admin = supabaseAdmin();

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(data.email, {
    data: { full_name: data.fullName },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/login`,
  });

  if (inviteError || !invited.user) {
    redirect(target(inviteError?.message || 'Could not invite this doctor.', 'error'));
  }

  const userId = invited.user.id;

  try {
    const { error: userError } = await admin.from('users').insert({
      id: userId,
      full_name: data.fullName,
      email: data.email,
      phone: data.phone || null,
      role: 'doctor',
      is_active: true,
    });
    if (userError) throw userError;

    const languages = data.languages
      .split(',')
      .map((language) => language.trim())
      .filter(Boolean);

    const { data: doctor, error: doctorError } = await admin
      .from('doctors')
      .insert({
        user_id: userId,
        speciality: data.speciality,
        hpcsa_number: data.hpcsaNumber.toUpperCase(),
        practice_number: data.practiceNumber || null,
        languages: languages.length ? languages : ['English'],
        years_experience: data.yearsExperience,
        consult_fee: data.consultFee,
        follow_up_fee: data.followUpFee === '' || data.followUpFee === undefined ? null : data.followUpFee,
        city: data.city || null,
        province: data.province || null,
        offers_video: data.offersVideo === 'on',
        offers_in_person: data.offersInPerson === 'on',
        verification: 'pending',
      })
      .select('id')
      .single();

    if (doctorError) throw doctorError;

    await audit({
      actorId: session.id,
      action: 'create',
      entity: 'Doctor',
      entityId: doctor.id,
      lawfulBasis: 'healthcare_administration',
      metadata: {
        invitedEmail: data.email,
        hpcsaNumber: data.hpcsaNumber.toUpperCase(),
        verification: 'pending',
      },
    });
  } catch (error) {
    await admin.from('users').delete().eq('id', userId);
    await admin.auth.admin.deleteUser(userId);
    const message = error instanceof Error ? error.message : 'Doctor onboarding failed. No profile was kept.';
    redirect(target(message, 'error'));
  }

  redirect(target(`Invitation sent to ${data.email}. Doctor profile created as pending verification.`, 'ok'));
}
