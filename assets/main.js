// Mother Lode Detailing

// Social links show in the footer once a URL is filled in.
const CONTACT = {
  phone: '+15595055164',
  phoneDisplay: '(559) 505-5164',
  email: 'arias.riley@yahoo.com',
};
const SOCIAL = [
  { label: 'Instagram', url: 'https://www.instagram.com/motherlodedetailing/' },
  { label: 'Facebook', url: 'https://www.facebook.com/motherlodedetailing' },
  { label: 'Google reviews', url: 'https://www.google.com/maps?cid=17763241738423924689' },
  { label: 'TikTok', url: '' },
];

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const coarsePointer = matchMedia('(pointer: coarse)').matches;

function fillContact() {
  for (const a of document.querySelectorAll('[data-contact="phone"]')) {
    a.href = `tel:${CONTACT.phone}`;
    a.textContent = CONTACT.phoneDisplay;
  }
  for (const a of document.querySelectorAll('[data-contact="email"]')) {
    a.href = `mailto:${CONTACT.email}`;
    a.textContent = CONTACT.email;
  }
  // Built with DOM methods and limited to https links, so a mistyped or hostile URL can't inject markup or script.
  const list = document.querySelector('.social');
  const live = SOCIAL.filter(s => {
    try { return new URL(s.url).protocol === 'https:'; } catch { return false; }
  });
  if (list && live.length) {
    for (const s of live) {
      const a = document.createElement('a');
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = s.label;
      const li = document.createElement('li');
      li.append(a);
      list.append(li);
    }
    list.hidden = false;
  }
  const year = document.querySelector('.year');
  if (year) year.textContent = new Date().getFullYear();
}

function initNav() {
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('solid', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initReveal() {
  const groups = document.querySelectorAll('.reveal, .track');
  for (const g of groups) {
    if (!g.classList.contains('reveal')) continue;
    [...g.children].forEach((child, i) => child.style.setProperty('--i', i));
  }
  const io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      el.classList.add('in');
      io.unobserve(el);
      // Once the entrance has played, drop the stagger so later hovers respond instantly.
      setTimeout(() => el.classList.add('done'), 700 + el.children.length * 80);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  groups.forEach(g => io.observe(g));
}

function initClips() {
  const shots = document.querySelectorAll('.shot.clip');
  const io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const shot = entry.target;
      if (entry.isIntersecting && !shot.userPaused) shot.video.play().catch(() => {});
      else shot.video.pause();
    }
  }, { threshold: 0.35 });

  for (const shot of shots) {
    const video = shot.querySelector('video');
    const btn = shot.querySelector('.clip-toggle');
    shot.video = video;
    shot.userPaused = reduceMotion.matches;
    const sync = () => {
      const playing = !video.paused;
      btn.textContent = playing ? 'Pause' : 'Play';
      btn.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} video of the ${shot.dataset.name}`);
    };
    btn.addEventListener('click', () => {
      if (video.paused) {
        shot.userPaused = false;
        video.play().catch(() => {});
      } else {
        shot.userPaused = true;
        video.pause();
      }
    });
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    sync();
    io.observe(shot);
  }
}

// Hero: a film of foothill dust over the paint. Wipe it off.
function initDust() {
  const hero = document.querySelector('.hero');
  const canvas = hero && hero.querySelector('.dust');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const decal = hero.querySelector('.hero-decal');
  const hint = hero.querySelector('.wipe-hint');
  const readout = hero.querySelector('.wipe-readout');
  const pctEl = readout.querySelector('b');
  const btn = hero.querySelector('.wipe-btn');
  const status = hero.querySelector('.wipe-status');

  const CELL = 24;
  const FINISH_BELOW = 45;
  let W = 0, H = 0, dpr = 1, cols = 0, rows = 0, grid = null;
  let radius = 50, brush = null;
  let done = false, autoRun = false, raf = 0, pending = false, introPlayed = false;
  const pointerStroke = { last: null, t: 0 };

  const rand = (a, b) => a + Math.random() * (b - a);

  function grainTile() {
    const c = document.createElement('canvas');
    c.width = c.height = 180;
    const g = c.getContext('2d');
    const img = g.createImageData(180, 180);
    for (let i = 0; i < img.data.length; i += 4) {
      const light = Math.random() > 0.5;
      img.data[i] = light ? 222 : 88;
      img.data[i + 1] = light ? 204 : 66;
      img.data[i + 2] = light ? 168 : 46;
      img.data[i + 3] = Math.random() * 42;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function makeBrush() {
    const size = Math.ceil(radius * 2 * dpr);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(0,0,0,.35)');
    grad.addColorStop(0.5, 'rgba(0,0,0,.22)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  function paint() {
    const rect = hero.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    // Base film, heavier toward the lower panels.
    const film = ctx.createLinearGradient(0, 0, W * 0.35, H);
    film.addColorStop(0, 'rgba(186,162,124,.4)');
    film.addColorStop(0.55, 'rgba(172,142,104,.52)');
    film.addColorStop(1, 'rgba(150,110,76,.66)');
    ctx.fillStyle = film;
    ctx.fillRect(0, 0, W, H);

    const splash = ctx.createLinearGradient(0, H * 0.55, 0, H);
    splash.addColorStop(0, 'rgba(128,84,54,0)');
    splash.addColorStop(1, 'rgba(128,84,54,.26)');
    ctx.fillStyle = splash;
    ctx.fillRect(0, 0, W, H);

    // Blotches of red clay and pale dust.
    const big = Math.max(W, H);
    for (let i = 0; i < 28; i++) {
      const x = rand(0, W), y = rand(0, H), r = rand(40, big * 0.2);
      const tone = Math.random() < 0.4 ? '152,94,60' : '208,190,154';
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${tone},${rand(0.08, 0.2)})`);
      g.addColorStop(1, `rgba(${tone},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const specks = Math.round((W * H) / 900);
    for (let i = 0; i < specks; i++) {
      const dark = Math.random() < 0.55;
      ctx.fillStyle = dark ? `rgba(92,62,40,${rand(0.25, 0.6)})` : `rgba(232,218,190,${rand(0.2, 0.5)})`;
      ctx.beginPath();
      ctx.arc(rand(0, W), rand(0, H), rand(0.5, 1.7), 0, Math.PI * 2);
      ctx.fill();
    }

    // Rain streaks and dried water spots already cut through the dust.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    const streaks = Math.round(W / 26);
    for (let i = 0; i < streaks; i++) {
      let x = rand(0, W), y = rand(-40, H * 0.75);
      const len = rand(50, 220);
      ctx.lineWidth = rand(1.2, 3.6);
      ctx.strokeStyle = `rgba(0,0,0,${rand(0.1, 0.24)})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < len; s += 12) {
        x += rand(-1.5, 1.5);
        ctx.lineTo(x, y + s);
      }
      ctx.stroke();
    }
    const spots = Math.round((W * H) / 8000);
    for (let i = 0; i < spots; i++) {
      const x = rand(0, W), y = rand(0, H), r = rand(2, 7);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,.1)';
      ctx.fill();
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = 'rgba(0,0,0,.26)';
      ctx.stroke();
    }

    cols = Math.ceil(W / CELL);
    rows = Math.ceil(H / CELL);
    grid = new Float32Array(cols * rows).fill(1);
    radius = Math.max(40, Math.min(72, Math.min(W, H) * 0.07));
    brush = makeBrush();
    pointerStroke.last = null;
    hero.dataset.paintedW = W;
    hero.dataset.paintedH = H;
    update();
  }

  function stampAt(x, y) {
    ctx.drawImage(brush, x - radius, y - radius, radius * 2, radius * 2);
    const c0 = Math.max(0, Math.floor((x - radius) / CELL));
    const c1 = Math.min(cols - 1, Math.floor((x + radius) / CELL));
    const r0 = Math.max(0, Math.floor((y - radius) / CELL));
    const r1 = Math.min(rows - 1, Math.floor((y + radius) / CELL));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const d = Math.hypot((c + 0.5) * CELL - x, (r + 0.5) * CELL - y);
        if (d >= radius) continue;
        const i = r * cols + c;
        grid[i] = Math.max(0, grid[i] - 0.25 * (1 - d / radius));
      }
    }
  }

  // Stamp at even spacing along the path so slow and fast movement wipe the same.
  function strokeTo(stroke, x, y) {
    if (!stroke.last) {
      stampAt(x, y);
      stroke.last = { x, y };
      return;
    }
    const spacing = radius * 0.33;
    let dx = x - stroke.last.x, dy = y - stroke.last.y, dist = Math.hypot(dx, dy);
    while (dist >= spacing) {
      const k = spacing / dist;
      stroke.last = { x: stroke.last.x + dx * k, y: stroke.last.y + dy * k };
      stampAt(stroke.last.x, stroke.last.y);
      dx = x - stroke.last.x;
      dy = y - stroke.last.y;
      dist = Math.hypot(dx, dy);
    }
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      update();
    });
  }

  function update() {
    if (!grid || done) return;
    let sum = 0;
    for (let i = 0; i < grid.length; i++) sum += grid[i];
    const pct = (sum / grid.length) * 100;
    pctEl.textContent = `${Math.ceil(pct)}%`;
    if (!autoRun && pct < FINISH_BELOW) finish();
  }

  function finish() {
    if (done) return;
    done = true;
    autoRun = false;
    cancelAnimationFrame(raf);
    hero.classList.add('clean');
    canvas.classList.add('gone');
    hint.hidden = true;
    btn.hidden = true;
    readout.removeAttribute('aria-hidden');
    const next = document.createElement('a');
    next.href = '#book';
    next.textContent = 'Yours is next.';
    readout.replaceChildren('All clean. ', next);
    status.textContent = 'All clean.';
  }

  function runPath(points, duration, onEnd) {
    const lens = [0];
    for (let i = 1; i < points.length; i++) {
      lens.push(lens[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    }
    const total = lens[lens.length - 1];
    const pointAt = dist => {
      let s = 0;
      while (s < points.length - 2 && lens[s + 1] < dist) s++;
      const f = Math.min(1, Math.max(0, (dist - lens[s]) / (lens[s + 1] - lens[s] || 1)));
      return { x: points[s].x + (points[s + 1].x - points[s].x) * f, y: points[s].y + (points[s + 1].y - points[s].y) * f };
    };
    const stroke = { last: null };
    const t0 = performance.now();
    autoRun = true;
    let covered = 0;
    const frame = now => {
      if (done) return;
      const k = Math.min(1, (now - t0) / duration);
      const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const target = eased * total;
      // Walk the path itself so slow frames still follow the corners.
      for (let d = covered + radius * 0.33; d < target; d += radius * 0.33) {
        const p = pointAt(d);
        strokeTo(stroke, p.x, p.y);
      }
      const p = pointAt(target);
      strokeTo(stroke, p.x, p.y);
      covered = target;
      autoRun = k < 1;
      schedule();
      if (k < 1) raf = requestAnimationFrame(frame);
      else if (onEnd) onEnd();
    };
    raf = requestAnimationFrame(frame);
  }

  // One pass across the logo so the idea lands before anyone touches it.
  function intro() {
    if (introPlayed || done || reduceMotion.matches || window.scrollY > H * 0.4) return;
    introPlayed = true;
    const hr = hero.getBoundingClientRect();
    const dr = decal.getBoundingClientRect();
    const left = dr.left - hr.left + dr.width * 0.08;
    const right = dr.right - hr.left - dr.width * 0.08;
    const top = dr.top - hr.top;
    const pts = [];
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push({ x: left + (right - left) * t, y: top + dr.height * (0.36 + Math.sin(t * Math.PI * 2) * 0.04) });
    }
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push({ x: right - (right - left) * t, y: top + dr.height * (0.62 + Math.sin(t * Math.PI * 2) * 0.04) });
    }
    runPath(pts, 1600);
  }

  function wipeAll() {
    if (done || autoRun) return;
    if (reduceMotion.matches) return finish();
    btn.disabled = true;
    const pts = [];
    const gap = radius * 1.2;
    let dir = 0;
    for (let y = radius * 0.6; y < H + radius; y += gap) {
      pts.push({ x: dir ? W + radius : -radius, y });
      pts.push({ x: dir ? -radius : W + radius, y });
      dir = 1 - dir;
    }
    runPath(pts, Math.min(2400, 260 * (pts.length / 2)), finish);
  }

  hero.addEventListener('pointermove', e => {
    if (done || autoRun || !grid) return;
    const rect = hero.getBoundingClientRect();
    if (e.timeStamp - pointerStroke.t > 140) pointerStroke.last = null;
    pointerStroke.t = e.timeStamp;
    strokeTo(pointerStroke, e.clientX - rect.left, e.clientY - rect.top);
    schedule();
  });
  hero.addEventListener('pointerleave', () => { pointerStroke.last = null; });
  hero.addEventListener('pointerdown', () => { pointerStroke.last = null; });
  btn.addEventListener('click', wipeAll);

  new ResizeObserver(() => {
    if (done || autoRun) return;
    const rect = hero.getBoundingClientRect();
    // Mobile toolbars change the height a little while scrolling; only repaint on real resizes.
    if (grid && Math.abs(rect.width - W) < 2 && Math.abs(rect.height - H) < 140) return;
    paint();
  }).observe(hero);

  const ready = decal.complete ? Promise.resolve() : new Promise(r => decal.addEventListener('load', r, { once: true }));
  ready.then(() => setTimeout(() => { if (grid) intro(); }, 450));
}

const MAX_PHOTOS = 4;
const MAX_EDGE = 1500;

// Re-encoding in the browser shrinks the upload and drops EXIF, so a photo's
// location data never leaves the customer's phone.
async function shrinkPhoto(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (bitmap.close) bitmap.close();
  let data = canvas.toDataURL('image/jpeg', 0.82);
  if (data.length > 1_400_000) data = canvas.toDataURL('image/jpeg', 0.6);
  return data;
}

function initBooking() {
  const form = document.querySelector('.book-form');
  if (!form) return;
  const panel = form.parentElement;
  const done = panel.querySelector('.book-done');
  const errorEl = form.querySelector('.form-error');
  const submit = form.querySelector('button[type="submit"]');
  const alt = form.querySelector('.alt-send');
  const fine = form.querySelector('.fine-method');
  const photoInput = form.elements.photos;
  const photoList = form.querySelector('.photo-list');
  const opened = Date.now();
  const handoff = coarsePointer ? 'sms' : 'email';
  let photos = [];
  let sending = false;

  alt.textContent = handoff === 'sms' ? 'Send by text instead' : 'Send by email instead';
  fine.textContent = 'Your request comes straight to us, photos and all.';

  for (const cta of document.querySelectorAll('.card-cta[data-service]')) {
    cta.addEventListener('click', () => { form.elements.service.value = cta.dataset.service; });
  }

  const required = [
    ['name', 'your name'],
    ['phone', 'a phone number'],
    ['vehicle', 'the vehicle'],
    ['service', 'a service'],
  ];

  function validate() {
    const missing = [];
    let first = null;
    for (const [name, label] of required) {
      const el = form.elements[name];
      const bad = !el.value.trim();
      el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      if (bad) {
        missing.push(label);
        first = first || el;
      }
    }
    if (missing.length) {
      const list = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing.at(-1)}` : missing[0];
      fail(`Add ${list} so we can quote it.`);
      first.focus();
      return false;
    }
    const phone = form.elements.phone;
    const digits = (phone.value.match(/\d/g) || []).length;
    if (digits < 10) {
      phone.setAttribute('aria-invalid', 'true');
      fail('That phone number looks short. We need all ten digits to text you back.');
      phone.focus();
      return false;
    }
    errorEl.hidden = true;
    return true;
  }

  function fail(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function values() {
    const v = name => form.elements[name].value.trim();
    return {
      name: v('name'),
      phone: v('phone'),
      vehicle: v('vehicle'),
      service: v('service'),
      town: v('town'),
      when: v('when'),
      notes: v('notes'),
    };
  }

  function compose() {
    const d = values();
    const lines = [
      `Detail request from ${d.name}`,
      `Phone: ${d.phone}`,
      `Vehicle: ${d.vehicle}`,
      `Service: ${d.service}`,
    ];
    if (d.town) lines.push(`Town: ${d.town}`);
    if (d.when) lines.push(`Days that work: ${d.when}`);
    if (d.notes) lines.push(`Notes: ${d.notes}`);
    return lines.join('\n');
  }

  function finish(head, note) {
    done.querySelector('.done-head').textContent = head;
    done.querySelector('.done-note').textContent = note;
    form.hidden = true;
    done.hidden = false;
    done.focus();
  }

  if (photoInput) {
    photoInput.addEventListener('change', async () => {
      const files = [...photoInput.files].slice(0, MAX_PHOTOS);
      photoList.replaceChildren();
      photos = [];
      for (const file of files) {
        const li = document.createElement('li');
        li.textContent = `Adding ${file.name}`;
        photoList.append(li);
        try {
          const data = await shrinkPhoto(file);
          photos.push(data);
          const img = document.createElement('img');
          img.src = data;
          img.alt = '';
          const caption = document.createElement('span');
          caption.textContent = file.name;
          li.replaceChildren(img, caption);
        } catch {
          li.textContent = `Couldn't read ${file.name}. Skip it or text it to us.`;
        }
      }
    });
  }

  // Hands the request to the customer's own texting or email app.
  function handOff(method) {
    const body = encodeURIComponent(compose());
    const subject = encodeURIComponent(`Detail request: ${form.elements.vehicle.value.trim()}`);
    window.location.href = method === 'sms'
      ? `sms:${CONTACT.phone}?&body=${body}`
      : `mailto:${CONTACT.email}?subject=${subject}&body=${body}`;
    finish(
      method === 'sms' ? 'Hit send in your texting app.' : 'Hit send in your email app.',
      'Your request is filled in and ready. Nothing reaches us until you press send.'
    );
  }

  async function send() {
    if (sending || !validate()) return;
    sending = true;
    const label = submit.textContent;
    submit.textContent = 'Sending...';
    submit.disabled = true;
    try {
      const response = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values(),
          photos,
          company: form.elements.company.value,
          elapsed: Date.now() - opened,
          token: crypto.randomUUID ? crypto.randomUUID() : '',
        }),
      });
      const result = await response.json().catch(() => ({}));
      // Before the mail service is wired up, quietly fall back to the customer's own app.
      if (response.status === 503 || result.error === 'unconfigured') {
        handOff(handoff);
        return;
      }
      if (!response.ok || !result.ok) throw new Error(result.error || 'send');
      finish('Request sent.', `We'll get back to you at ${values().phone} with a price and the next open day.`);
    } catch {
      fail(`That didn't send. Use "${alt.textContent}" below, or call ${CONTACT.phoneDisplay}.`);
    } finally {
      sending = false;
      submit.textContent = label;
      submit.disabled = false;
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    send();
  });
  alt.addEventListener('click', () => {
    if (validate()) handOff(handoff);
  });
  form.addEventListener('input', e => {
    if (e.target.getAttribute('aria-invalid') === 'true' && e.target.value.trim()) {
      e.target.setAttribute('aria-invalid', 'false');
    }
  });
  done.querySelector('.done-edit').addEventListener('click', () => {
    done.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  });
  // Handlers are attached; now it's safe to show the form.
  form.hidden = false;
}

fillContact();
initNav();
initReveal();
initClips();
initDust();
initBooking();
