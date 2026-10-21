import { getOfflineUser, clearOfflineSession, offlineMode, setOfflineMode } from '../offline/offlineAuth.js';
const TOKEN_KEY = 'token';
const USER_KEY = 'user';
let authSessionVersion = 0;
export const getAuthSessionVersion = () => authSessionVersion;

const safeJsonParse = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const getAuthToken = () => {
  const sessionToken = sessionStorage.getItem(TOKEN_KEY);
  if (sessionToken) return sessionToken;

  const legacyToken = localStorage.getItem(TOKEN_KEY);
  if (legacyToken) {
    sessionStorage.setItem(TOKEN_KEY, legacyToken);
    localStorage.removeItem(TOKEN_KEY);
  }
  return legacyToken;
};

export const getStoredUser = () => {
  if (offlineMode()) return getOfflineUser({ readOnly: true });
  const sessionUser = sessionStorage.getItem(USER_KEY);
  if (sessionUser) return safeJsonParse(sessionUser);

  const legacyUser = localStorage.getItem(USER_KEY);
  if (legacyUser) {
    sessionStorage.setItem(USER_KEY, legacyUser);
    localStorage.removeItem(USER_KEY);
  }
  return safeJsonParse(legacyUser) || getOfflineUser();
};

export const setAuthSession = ({ token, user }) => {
  authSessionVersion++;
  const grant = getOfflineUser({ readOnly: true });
  if (user && grant && String(user.id) !== String(grant.id)) clearOfflineSession();
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  setOfflineMode(false);
};

export const getAccessSession = ({ onlineOnly = false } = {}) => {
  if (!onlineOnly && offlineMode()) {
    const user = getOfflineUser({ readOnly: true }), readOnly = Boolean(user && !getOfflineUser());
    return { kind: user ? 'offline' : 'locked', user, readOnly, reason: readOnly ? 'สิทธิ์ Offline หมดอายุ เปิดได้เฉพาะรายการและสำรองข้อมูล กรุณาต่ออายุออนไลน์ก่อนบันทึก' : user ? null : 'กรุณาปลดล็อก PIN หรือต่ออายุออนไลน์' };
  }
  const token = getAuthToken(), user = getOnlineUser();
  if (token?.split('.').length === 3) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (!payload.exp || payload.exp * 1000 <= Date.now()) return { kind: 'locked', user: null, reason: 'เซสชันออนไลน์หมดอายุ กรุณาเข้าสู่ระบบใหม่ หรือปลดล็อก Offline ด้วย PIN' };
    } catch { return { kind: 'locked', user: null, reason: 'เซสชันออนไลน์ไม่สมบูรณ์ กรุณาเข้าสู่ระบบใหม่' }; }
  }
  return { kind: user && token ? 'online' : 'locked', user: user && token ? user : null, reason: null };
};

export const getOnlineUser = () => safeJsonParse(sessionStorage.getItem(USER_KEY)) || safeJsonParse(localStorage.getItem(USER_KEY));

export const switchAccessMode = (offline) => {
  if (offline) {
    const grant = getOfflineUser(), online = getOnlineUser();
    if (!grant || (online && String(online.id) !== String(grant.id))) throw Error('กรุณาปลดล็อก PIN ของบัญชีนี้ก่อนทำงานในเครื่อง');
  } else if (getAccessSession({ onlineOnly: true }).kind !== 'online') {
    throw Error('กรุณาเข้าสู่ระบบออนไลน์ก่อนกลับโหมดเซิร์ฟเวอร์ งานในเครื่องยังอยู่ครบ');
  }
  setOfflineMode(offline);
};

// A device PIN can belong to a different account than the online session.
export const adoptOfflineIdentity = (user) => {
  const online = safeJsonParse(sessionStorage.getItem(USER_KEY)) || safeJsonParse(localStorage.getItem(USER_KEY));
  if (online && String(online.id) === String(user.id)) return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const clearAuthSession = () => {
  authSessionVersion++;
  clearOfflineSession();
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};
