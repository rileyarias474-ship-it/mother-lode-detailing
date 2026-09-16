// Booking form endpoint. Validates a request and emails it to the shop.
// No database: the email is the record. Nothing is logged but the outcome.

const TO = process.env.BOOKING_TO || 'arias.riley@yahoo.com';
// The Resend integration provisions a sending domain and sets RESEND_EMAIL_DOMAIN.
const DOMAIN = process.env.RESEND_EMAIL_DOMAIN;
const FROM = process.env.BOOKING_FROM
  || (DOMAIN ? `Mother Lode Detailing <bookings@${DOMAIN}>` : 'Mother Lode Detailing <onboarding@resend.dev>');
const SERVICES = [
  'Basic exterior',
  'Basic interior',
  'Interior and exterior',
  'Paint correction',
  'Ceramic coating',
  'Not sure yet',
];
const LIMITS = { name: 80, phone: 30, vehicle: 100, town: 60, when: 120, notes: 1000 };
const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 1_500_000;

// Best effort throttle. Instances are reused, so this catches the obvious floods.
const hits = new Map();
function throttled(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) hits.clear();
  return recent.length > 6;
}

const clean = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const digits = v => (v.match(/\d/g) || []).join('');
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function photos(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const item of input.slice(0, MAX_PHOTOS)) {
    if (typeof item !== 'string') continue;
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(item);
    if (!match) continue;
    const bytes = Buffer.from(match[1], 'base64');
    // Only real JPEGs, so nothing else can ride along as an attachment.
    if (bytes.length < 1024 || bytes.length > MAX_PHOTO_BYTES) continue;
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) continue;
    out.push(match[1]);
  }
  return out;
}

function body(fields, count) {
  const rows = [
    ['Name', fields.name],
    ['Phone', fields.phone],
    ['Vehicle', fields.vehicle],
    ['Service', fields.service],
    ['Town', fields.town],
    ['Days that work', fields.when],
    ['Notes', fields.notes],
    ['Photos', count ? `${count} attached` : ''],
  ].filter(([, value]) => value);

  const text = rows.map(([label, value]) => `${label}: ${value}`).join('\n');
  const tel = digits(fields.phone);
  const reply = encodeURIComponent(
    `Hi ${fields.name}, this is Riley with Mother Lode Detailing about your ${fields.service.toLowerCase()} request. `
  );
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:10px 16px 10px 0;color:#5b6b64;font:600 13px system-ui,-apple-system,sans-serif;white-space:nowrap;vertical-align:top">${esc(label)}</td>` +
        `<td style="padding:10px 0;color:#12211c;font:400 16px system-ui,-apple-system,sans-serif">${esc(value)}</td></tr>`
    )
    .join('');
  const button = (href, label, bg, color) =>
    `<a href="${href}" style="display:inline-block;margin:0 10px 10px 0;padding:14px 22px;border-radius:8px;background:${bg};color:${color};font:700 16px system-ui,-apple-system,sans-serif;text-decoration:none">${label}</a>`;

  const html = `<div style="margin:0;padding:24px;background:#f4f6f5">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #dfe5e2">
    <div style="padding:20px 24px;background:#16342b">
      <p style="margin:0;color:#e2ae2d;font:700 12px/1 system-ui,-apple-system,sans-serif;letter-spacing:.14em;text-transform:uppercase">New detail request</p>
      <p style="margin:8px 0 0;color:#fff;font:700 22px/1.2 system-ui,-apple-system,sans-serif">${esc(fields.name)} &middot; ${esc(fields.vehicle)}</p>
    </div>
    <div style="padding:8px 24px 4px"><table style="width:100%;border-collapse:collapse">${cells}</table></div>
    <div style="padding:16px 24px 24px">
      ${tel ? button(`sms:+1${tel}?&body=${reply}`, `Text ${esc(fields.name.split(' ')[0])}`, '#16342b', '#ffffff') : ''}
      ${tel ? button(`tel:+1${tel}`, 'Call', '#eef1ee', '#16342b') : ''}
      <p style="margin:6px 0 0;color:#5b6b64;font:400 13px system-ui,-apple-system,sans-serif">Sent from the booking form on motherlodedetailing.com</p>
    </div>
  </div>
</div>`;

  return { text: `${text}\n\nSent from the booking form on motherlodedetailing.com`, html };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method' });
  }

  // Only our own pages may post here.
  const origin = req.headers.origin || '';
  const host = req.headers.host || '';
  let originHost = '';
  try { originHost = origin ? new URL(origin).host : ''; } catch { originHost = 'bad'; }
  if (originHost !== host) return res.status(403).json({ ok: false, error: 'origin' });

  let input;
  try {
    input = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
  } catch {
    return res.status(400).json({ ok: false, error: 'json' });
  }

  // Bots fill the hidden field and submit faster than a person can type.
  const quiet = typeof input.elapsed === 'number' && input.elapsed < 2500;
  if (clean(input.company, 80) || quiet) return res.status(200).json({ ok: true });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (throttled(ip)) return res.status(429).json({ ok: false, error: 'busy' });

  const fields = {
    name: clean(input.name, LIMITS.name),
    phone: clean(input.phone, LIMITS.phone),
    vehicle: clean(input.vehicle, LIMITS.vehicle),
    service: clean(input.service, 40),
    town: clean(input.town, LIMITS.town),
    when: clean(input.when, LIMITS.when),
    notes: typeof input.notes === 'string' ? input.notes.trim().slice(0, LIMITS.notes) : '',
  };
  const tel = digits(fields.phone);
  if (!fields.name || !fields.vehicle) return res.status(400).json({ ok: false, error: 'fields' });
  if (tel.length < 10 || tel.length > 11) return res.status(400).json({ ok: false, error: 'phone' });
  if (!SERVICES.includes(fields.service)) return res.status(400).json({ ok: false, error: 'service' });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(503).json({ ok: false, error: 'unconfigured' });

  const images = photos(input.photos);
  const { text, html } = body(fields, images.length);
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  // Lets a retry after a dropped connection land as one email, not two.
  if (/^[a-f0-9-]{36}$/i.test(input.token || '')) headers['Idempotency-Key'] = input.token;

  let sent;
  try {
    sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        subject: `Detail request: ${fields.name} - ${fields.vehicle} - ${fields.service}`.replace(/[\r\n]+/g, ' '),
        text,
        html,
        attachments: images.map((content, i) => ({ filename: `vehicle-${i + 1}.jpg`, content })),
      }),
    });
  } catch {
    return res.status(502).json({ ok: false, error: 'send' });
  }

  if (!sent.ok) {
    console.error('resend responded', sent.status);
    return res.status(502).json({ ok: false, error: 'send' });
  }
  return res.status(200).json({ ok: true });
};
