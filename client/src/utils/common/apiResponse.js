// Rewrite URLs only in JSON data. Binary downloads must retain their bytes/type.
export function rewriteApiUrls(data, origin) {
    if (typeof data === 'string') return data.replace(/http:\/\/localhost:3000/g, origin).replace(/^http:\/\/(.*\.onrender\.com)/g, 'https://$1');
    if (Array.isArray(data)) return data.map(item => rewriteApiUrls(item, origin));
    if (data && typeof data === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(data))) {
        return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, rewriteApiUrls(value, origin)]));
    }
    return data;
}
