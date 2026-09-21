const CACHE = 'pilates34-release-1.0.3';
const REQUIRED_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./mp4/1_hundreds.mp4",
  "./mp4/2_Roll-Up.mp4",
  "./mp4/3_Roll-Over.mp4",
  "./mp4/4_Single-Leg-Circles.mp4",
  "./mp4/5_Rolling-Like-Ball.mp4",
  "./mp4/6_Single-Leg-Stretch.mp4",
  "./mp4/7_Double-Leg-Stretch.mp4",
  "./mp4/8_Spine-Stretch-Forward.mp4",
  "./mp4/9_Open-Leg-Rocker.mp4",
  "./mp4/10_Corkscrew.mp4",
  "./mp4/11_Saw.mp4",
  "./mp4/12_Swan.mp4",
  "./mp4/13_Single-Leg-Kicks.mp4",
  "./mp4/14-DoubleLegKicks.mp4",
  "./mp4/15_Neck-Roll.mp4",
  "./mp4/16_Raised-Scissors.mp4",
  "./mp4/17_High-Bicycle.mp4",
  "./mp4/18_Shoulder-Bridge.mp4",
  "./mp4/19_Spine-Twist.mp4",
  "./mp4/20_JackKnife.mp4",
  "./mp4/21_SideKicks.mp4",
  "./mp4/22_Teasers.mp4",
  "./mp4/23_Hip-Twists.mp4",
  "./mp4/24_Swimming.mp4",
  "./mp4/25_Leg-Pull-Down.mp4",
  "./mp4/26_Leg-Pull-Up.mp4",
  "./mp4/27_Kneeling-Side-Kicks.mp4",
  "./mp4/28_Side-Bend.mp4",
  "./mp4/29_Boomerang.mp4",
  "./mp4/30_Seal.mp4",
  "./mp4/31_Crab.mp4",
  "./mp4/32_Rocking.mp4",
  "./mp4/33_Balance.mp4",
  "./mp4/34_PushUps.mp4"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(REQUIRED_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

async function rangeResponse(request) {
  const rangeHeader = request.headers.get('range');
  const cached = await caches.match(request.url);

  if (!cached) {
    return fetch(request);
  }

  if (!rangeHeader) {
    return cached;
  }

  const buffer = await cached.arrayBuffer();
  const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);

  if (!match) {
    return cached;
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : buffer.byteLength - 1;
  const end = Math.min(requestedEnd, buffer.byteLength - 1);

  if (!Number.isFinite(start) || start < 0 || start > end || start >= buffer.byteLength) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${buffer.byteLength}` }
    });
  }

  const chunk = buffer.slice(start, end + 1);

  return new Response(chunk, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'video/mp4',
      'Content-Length': String(chunk.byteLength),
      'Content-Range': `bytes ${start}-${end}/${buffer.byteLength}`,
      'Accept-Ranges': 'bytes'
    }
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = new URL(request.url);

  // iPhone/Safari commonly requests MP4 files with Range headers.
  // Serve byte ranges from the offline cache so looping video works without a network connection.
  if (url.origin === self.location.origin && url.pathname.toLowerCase().endsWith('.mp4')) {
    event.respondWith(rangeResponse(request));
    return;
  }

  // Network-first for page navigation so future releases update cleanly.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first for remaining app assets.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
          return response;
        });
      })
    );
  }
});
