import { createHash } from 'node:crypto';
export function visPwa() {
    return {
        name: 'vis-offline-shell',
        enforce: 'post',
        generateBundle: { order: 'post', handler(_options, bundle) {
            const fonts = ['THSarabunNew', 'Sarabun-Regular', 'BaiJamjuree-ExtraLight', 'BaiJamjuree-Light', 'BaiJamjuree-Regular', 'BaiJamjuree-Medium', 'BaiJamjuree-SemiBold', 'BaiJamjuree-Bold'].map(name => `/fonts/${name}.ttf`);
            const files = ['/index.html', '/manifest.webmanifest', '/vis-icon.svg', ...fonts, ...Object.values(bundle).map(file => file.fileName).filter(path => !path.endsWith('.map')).map(path => `/${path}`)];
            const cache = `vis-shell-${createHash('sha256').update(JSON.stringify(bundle)).digest('hex').slice(0, 12)}`;
            this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const CACHE = ${JSON.stringify(cache)};
const FILES = [...new Set(${JSON.stringify(files)})];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('vis-shell-') && key !== CACHE).map(key => caches.delete(key))))])));
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
    if (event.request.mode === 'navigate' && /^\\/(vis\\/login(?:\\/|$)|workspaces(?:\\/|$)|scorer-offline(?:\\/|$)|scorer(?:\\/|$)|adminscorer(?:\\/|$)|adminvis(?:\\/|$)|login(?:\\/|$))/.test(url.pathname)) {
        event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html')))); return;
    }
    if (FILES.includes(url.pathname)) event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.pathname)) || fetch(event.request)));
});
` });
        } },
    };
}
