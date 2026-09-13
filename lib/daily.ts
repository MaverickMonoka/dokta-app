/**
 * Daily.co video rooms for telemedicine consultations.
 *
 * Wired for real — this makes an actual API call, not a stub — but
 * DAILY_API_KEY is a placeholder until a real one is set. Until then, room
 * creation fails loudly and booking falls back to in-person, rather than
 * silently handing out a broken video link.
 *
 * A room is created once, at booking time, not per join: both patient and
 * doctor open the same room_url stored on the appointment.
 */
const DAILY_API = 'https://api.daily.co/v1';

export interface DailyRoom {
  url: string;
  name: string;
}

export async function createConsultationRoom(reference: string, scheduledFor: Date): Promise<DailyRoom> {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) {
    throw new Error('Video calling is not configured yet (DAILY_API_KEY is a placeholder).');
  }

  // Room opens 10 minutes early and closes itself 2 hours after the slot —
  // long enough for a consultation that overruns, short enough that a room
  // never sits open indefinitely and does not need manual cleanup.
  const nbfSeconds = Math.floor(scheduledFor.getTime() / 1000) - 600;
  const expSeconds = Math.floor(scheduledFor.getTime() / 1000) + 7200;

  const response = await fetch(`${DAILY_API}/rooms`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `dokta-${reference.toLowerCase()}`,
      privacy: 'private',
      properties: {
        nbf: nbfSeconds,
        exp: expSeconds,
        enable_chat: true,
        enable_screenshare: true,
        max_participants: 2,
        eject_at_room_exp: true,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Daily room creation failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  return { url: data.url, name: data.name };
}

/**
 * A signed, time-limited token so a room stays private (no link-sharing
 * access) while still letting either party join without a Daily account.
 */
export async function createRoomToken(roomName: string, userName: string, isOwner: boolean): Promise<string> {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) throw new Error('Video calling is not configured yet.');

  const response = await fetch(`${DAILY_API}/meeting-tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { room_name: roomName, user_name: userName, is_owner: isOwner },
    }),
  });

  if (!response.ok) throw new Error(`Daily token creation failed (${response.status})`);
  const data = await response.json();
  return data.token;
}
