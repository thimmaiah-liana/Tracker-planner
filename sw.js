const CACHE = 'tp-v11';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

let pendingReminders = [];
let scheduledTimers = [];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  checkReminders();

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SET_REMINDERS') {
    pendingReminders = e.data.reminders || [];
    scheduledTimers.forEach(t => clearTimeout(t));
    scheduledTimers = [];
    scheduleAllReminders();
  }
});

self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-reminders') {
    e.waitUntil(checkReminders());
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(cl => {
      if (cl.length > 0) return cl[0].focus();
      return clients.openWindow('./');
    })
  );
});

function scheduleAllReminders() {
  const now = Date.now();
  pendingReminders.forEach(r => {
    const ms = r.fireAt - now;
    if (ms > 0 && ms < 24 * 60 * 60 * 1000) {
      const t = setTimeout(() => fireReminder(r), ms);
      scheduledTimers.push(t);
    }
  });
}

function checkReminders() {
  const now = Date.now();
  const due = pendingReminders.filter(r => r.fireAt <= now && !r.fired);
  due.forEach(r => {
    r.fired = true;
    fireReminder(r);
  });
  pendingReminders = pendingReminders.filter(r => r.fireAt > now);
}

function fireReminder(r) {
  self.registration.showNotification(r.title, {
    body: r.body,
    tag: r.tag,
    icon: 'icon-192.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
  });
}
