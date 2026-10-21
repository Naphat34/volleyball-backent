export function navigateBrowser(browser, to, options = {}) {
    if (typeof to === 'number') {
        browser.history.go(to);
        return false; // popstate supplies the location after history traversal.
    }

    const target = new URL(to, browser.location.href);
    const current = browser.location;
    if (target.pathname === current.pathname && target.search === current.search
        && target.hash === current.hash && Object.is(browser.history.state?.usr ?? null, options.state ?? null)) return false;

    const method = options.replace ? 'replaceState' : 'pushState';
    browser.history[method]({ usr: options.state ?? null }, '', to);
    return true;
}
