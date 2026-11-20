import { showNotice } from '../i18n/alerts.js';
import schema from '../../../../backend/config/publicIdRoutes.json' with { type: 'json' };
import { getAuthToken } from '../../auth/authStorage.js';

export const publicIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const origin = () => (import.meta.env?.VITE_API_URL || 'http://localhost:3000').replace(/\/api\/?$/, '').replace(/\/$/, '');
const storageKey = () => `volley-public-urls-v1:${origin()}`;
const mappings = new Map();
let hydrated = false;
function hydrate() {
    if (hydrated) return;
    hydrated = true;
    try { for (const row of JSON.parse(localStorage.getItem(storageKey()) || '[]')) remember(row, false); } catch { /* Storage may be disabled. */ }
}
function persist() {
    try { localStorage.setItem(storageKey(), JSON.stringify([...new Set(mappings.values())])); } catch { /* The current session still works. */ }
}
export function remember(row, save = true) {
    if (!row?.id || !publicIdPattern.test(row.public_id)) return;
    const entry = { entity: row.entity, id: String(row.id), public_id: row.public_id.toLowerCase() };
    if (entry.entity === 'matches') {
        const previous = mappings.get(`matches:${entry.id}`) || mappings.get(`matchRecords:${entry.id}`);
        if (previous && previous.public_id !== entry.public_id) {
            mappings.delete(`matches:${previous.public_id}`);
            mappings.delete(`matchRecords:${previous.public_id}`);
        }
        if (row.replacedPublicId || previous?.replacedPublicId || (previous && previous.public_id !== entry.public_id)) {
            entry.replacedPublicId = true;
        }
    }
    mappings.set(`${entry.entity}:${entry.id}`, entry);
    mappings.set(`${entry.entity}:${entry.public_id}`, entry);
    if (['matches','custom_vis_matches'].includes(entry.entity)) {
        mappings.set(`matchRecords:${entry.id}`, { ...entry, entity: 'matchRecords' });
        mappings.set(`matchRecords:${entry.public_id}`, { ...entry, entity: 'matchRecords' });
    }
    if (save) persist();
}

export function hasReplacedMatchPublicId(id) {
    hydrate();
    return Boolean(mappings.get(`matches:${id}`)?.replacedPublicId);
}

export function cachedMatchPublicId(id) {
    hydrate();
    return mappings.get(`matches:${id}`)?.public_id;
}

export function rememberOfflineMatch(record) {
    hydrate();
    const id = String(record.id);
    const match = record.cache?.[`/scorer/match/${id}`];
    if (!mappings.has(`matchRecords:${id}`)) {
        remember({ entity: 'matchRecords', id, public_id: match?.public_id || crypto.randomUUID() });
    }
}

// Seed mappings from records already authorized by normal API reads. This also
// keeps prepared matches usable without another network request when offline.
export function rememberResponse(value, requestUrl = '') {
    hydrate();
    const collection = { competitions:'competitions', matches:'matches', match:'matches', teams:'teams', team:'teams', players:'players', users:'users', staff:'team_staff', entries:'team_entries', referees:'referees', scorers:'scorers', 'line-judges':'line_judges', stadiums:'stadiums', custom:'custom_vis_matches' };
    const path = new URL(requestUrl || '/', 'http://internal').pathname;
    const last = path.split('/').filter(Boolean).pop();
    const root = collection[last] || (path === '/me' ? 'users' : path === '/my-team' ? 'teams' : path === '/vis-custom' ? 'custom_vis_matches' : path.includes('manual-matches') || path.includes('manual-vis-matches') ? 'matches' : pathReferences(path,'api')[0]?.entity);
    const visit = (item,entity) => {
        if (Array.isArray(item)) { item.forEach(row => visit(row,entity)); return; }
        if (!item || typeof item !== 'object') return;
        if (item.public_id && item.id && entity) remember({ entity: /^custom-/.test(String(item.id)) ? 'custom_vis_matches' : entity, id: item.id, public_id: item.public_id },false);
        for (const [key,child] of Object.entries(item)) if (child && typeof child === 'object') visit(child,collection[key]);
    };
    visit(value,root); persist();
}

const pending = new Map();
let scheduled = false;
async function flush() {
    scheduled = false;
    const batch = [...pending.values()]; pending.clear();
    for (let start = 0; start < batch.length; start += 100) {
        const chunk = batch.slice(start,start+100);
        try {
            const token = getAuthToken();
            const response = await fetch(`${origin()}/api/public-identifiers`, {
                method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ references: chunk.map(item => item.ref) }), signal: AbortSignal.timeout(15000),
            });
            const body = await response.json();
            if (!response.ok || !Array.isArray(body.references) || body.references.length !== chunk.length) {
                throw Object.assign(Error(body.error || 'Unable to resolve public identifiers'), { status: response.status });
            }
            body.references.forEach(row => remember(row,false)); persist();
            chunk.forEach((item,index) => item.resolve(body.references[index]));
        } catch (error) { chunk.forEach(item => item.reject(error)); }
    }
}
export async function identifier(entity, value, direction = 'public') {
    hydrate();
    value = String(value);
    const cached = mappings.get(`${entity}:${value}`);
    if (cached) return direction === 'public' ? cached.public_id : cached.id;
    if (direction === 'public' && publicIdPattern.test(value)) return value.toLowerCase();
    if (direction === 'public' && /^custom-/.test(value) && publicIdPattern.test(value.slice(7))) {
        const row = { entity, id: value, public_id: value.slice(7) };
        remember(row); return row.public_id;
    }
    // Local references never travel to the server. Their URL UUID survives reloads.
    if (/^local-/.test(value) || (entity === 'competitions' && value.startsWith('manual:'))) {
        if (direction !== 'public') throw Error('A public UUID is required in URLs');
        const row = { entity, id: value, public_id: crypto.randomUUID() };
        remember(row); return row.public_id;
    }
    if (direction === 'internal' && !publicIdPattern.test(value)) throw Error('ลิงก์นี้ใช้รหัสเดิม กรุณาเปิดรายการจากเมนูอีกครั้ง');
    const key = `${entity}:${value}`;
    let item = pending.get(key);
    if (!item) {
        item = { ref: { entity, value } };
        item.promise = new Promise((resolve,reject) => { item.resolve = resolve; item.reject = reject; });
        pending.set(key,item);
    }
    if (!scheduled) { scheduled = true; queueMicrotask(flush); }
    const row = await item.promise;
    return direction === 'public' ? row.public_id : row.id;
}

export function pathReferences(path, mode = 'web') {
    const refs = new Map();
    for (const [pattern, groups] of schema[mode]) {
        const match = new RegExp(pattern,'d').exec(path);
        if (!match) continue;
        for (const [group, entity] of Object.entries(groups)) {
            const [start,end] = match.indices[Number(group)];
            const value = decodeURIComponent(match[Number(group)]);
            if (!['all','open','entries'].includes(value)) refs.set(start,{ entity, value, start, end });
        }
    }
    return [...refs.values()];
}

export async function translateUrl(to, { mode = 'web', direction = 'public', params, base } = {}) {
    if (typeof to !== 'string' || /^(?:blob:|data:|mailto:|tel:|#)/i.test(to)) return to;
    const browserOrigin = globalThis.location?.origin || 'http://localhost';
    const url = new URL(to, base || `${browserOrigin}/`);
    if (mode === 'web' && url.origin !== browserOrigin) {
        // API download links also pass through the same URL contract.
        if (url.origin !== origin() || !url.pathname.startsWith('/api/')) return to;
        mode = 'api';
    }
    const prefix = mode === 'api' && url.pathname.startsWith('/api/') ? '/api' : '';
    const path = url.pathname.slice(prefix.length);
    if (params) for (const [key,value] of Object.entries(params)) if (value !== undefined && value !== null) url.searchParams.set(key,String(value));
    for (const key of ['returnTo','next','redirect']) {
        const nested = url.searchParams.get(key);
        if (nested?.startsWith('/') && !nested.startsWith('//')) url.searchParams.set(key,await translateUrl(nested,{ direction, mode: 'web' }));
    }
    const refs = pathReferences(path,mode);
    for (const [key,value] of url.searchParams) if (schema.query[key] && value) refs.push({ entity: schema.query[key], value, key });
    // Reject old inbound links even when their mapping is already cached.
    if (direction === 'internal' && refs.some(ref => !publicIdPattern.test(ref.value))) throw Error('ลิงก์นี้ใช้รหัสเดิม กรุณาเปิดรายการจากเมนูอีกครั้ง');
    const values = await Promise.all(refs.map(ref => identifier(ref.entity,ref.value,direction)));
    let pathname = path;
    refs.map((ref,index) => ({ ...ref, value: values[index] })).filter(ref => !ref.key).sort((a,b) => b.start-a.start).forEach(ref => {
        pathname = pathname.slice(0,ref.start)+encodeURIComponent(ref.value)+pathname.slice(ref.end);
    });
    refs.forEach((ref,index) => { if (ref.key) url.searchParams.set(ref.key,values[index]); });
    url.pathname = prefix+pathname;
    return /^https?:\/\//i.test(to) ? url.href : `${url.pathname}${url.search}${url.hash}`;
}

export const publicUrl = (to, options) => translateUrl(to, options);
export const internalUrl = to => translateUrl(to, { direction: 'internal' });

export function openPublicWindow(to, target = '_blank') {
    const popup = window.open('about:blank', target);
    void publicUrl(to).then(url => { if (popup) { popup.opener = null; popup.location.replace(url); } }).catch(error => { popup?.close(); void showNotice(error.message, 'error'); });
}
