import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { navigateBrowser } from './utils/navigation/routerNavigation';
import { publicUrl, internalUrl } from './utils/navigation/publicUrls.js';
import PublicAnchor from './components/ui/PublicAnchor';

const RouterContext = createContext(null);
const ParamsContext = createContext({});

const getLocationSnapshot = () => ({
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash,
  state: window.history.state?.usr ?? null,
});

const pathToRegex = (path) => {
  if (path === '*') return { regex: /^.*$/, names: [] };
  const names = [];
  const escaped = path
    .replace(/\/+$/, '')
    .split('/')
    .map((part) => {
      if (part.startsWith(':')) {
        names.push(part.slice(1));
        return '([^/]+)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');

  return {
    regex: new RegExp(`^${escaped || '/'}$`),
    names,
  };
};

const matchPath = (path, pathname) => {
  const { regex, names } = pathToRegex(path);
  const match = pathname.replace(/\/+$/, '') || '/';
  const result = regex.exec(match);
  if (!result) return null;

  return names.reduce((params, name, index) => ({
    ...params,
    [name]: decodeURIComponent(result[index + 1] || ''),
  }), {});
};

export function BrowserRouter({ children }) {
  const [location, setLocation] = useState(getLocationSnapshot);
  const [decoded, setDecoded] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void internalUrl(`${location.pathname}${location.search}${location.hash}`).then(to => {
      if (!active) return;
      const url = new URL(to, window.location.origin);
      setDecoded({ pathname: url.pathname, search: url.search, hash: url.hash, state: location.state });
      setError('');
    }).catch(failure => { if (active) { setDecoded(null); setError(failure.message); } });
    return () => { active = false; };
  }, [location]);

  useEffect(() => {
    const refresh = () => setLocation(getLocationSnapshot());
    window.addEventListener('popstate', refresh);
    return () => window.removeEventListener('popstate', refresh);
  }, []);

  const navigate = useCallback(async (to, options = {}) => {
    try {
      const target = typeof to === 'number' ? to : await publicUrl(to);
      if (navigateBrowser(window, target, options)) setLocation(getLocationSnapshot());
    } catch (failure) { setError(failure.message); }
  }, []);

  const value = useMemo(() => ({ location, decoded, navigate }), [location, decoded, navigate]);
  return <RouterContext.Provider value={value}>{error ? <main role="alert" className="p-8"><p>{error}</p><a href="/">กลับหน้าหลัก</a></main> : decoded ? children : <p role="status" className="p-8">กำลังเปิดหน้า…</p>}</RouterContext.Provider>;
}

export function Routes({ children }) {
  const { decoded: location } = useContext(RouterContext);
  const routeList = React.Children.toArray(children);

  for (const route of routeList) {
    if (!React.isValidElement(route)) continue;
    const params = matchPath(route.props.path || '/', location.pathname);
    if (!params) continue;

    return (
      <ParamsContext.Provider value={params}>
        {route.props.element}
      </ParamsContext.Provider>
    );
  }

  return null;
}

export function Route() {
  return null;
}

export function Navigate({ to, replace = false }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, replace, to]);
  return null;
}

export function Link({ to, state, replace = false, onClick, children, ...props }) {
  const navigate = useNavigate();
  const href = typeof to === 'string' ? to : '#';

  const handleClick = (event) => {
    onClick?.(event);
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.altKey
      || event.ctrlKey
      || event.shiftKey
      || props.target
    ) {
      return;
    }

    event.preventDefault();
    navigate(to, { state, replace });
  };

  return (
    <PublicAnchor href={href} onClick={handleClick} {...props}>
      {children}
    </PublicAnchor>
  );
}

export const NavLink = Link;

export function useNavigate() {
  return useContext(RouterContext).navigate;
}

export function useLocation() {
  return useContext(RouterContext).location;
}

export function useParams() {
  return useContext(ParamsContext);
}

export function useSearchParams() {
  const { decoded: location, navigate } = useContext(RouterContext);
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const setSearchParams = useCallback((nextInit) => {
    const nextParams = nextInit instanceof URLSearchParams
      ? nextInit
      : new URLSearchParams(nextInit);
    const query = nextParams.toString();
    navigate(`${location.pathname}${query ? `?${query}` : ''}${location.hash}`, { replace: true });
  }, [location.pathname, location.hash, navigate]);

  return [params, setSearchParams];
}
