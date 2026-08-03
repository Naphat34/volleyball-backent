const TOKEN_KEY = 'token';
const USER_KEY = 'user';

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
  const sessionUser = sessionStorage.getItem(USER_KEY);
  if (sessionUser) return safeJsonParse(sessionUser);

  const legacyUser = localStorage.getItem(USER_KEY);
  if (legacyUser) {
    sessionStorage.setItem(USER_KEY, legacyUser);
    localStorage.removeItem(USER_KEY);
  }
  return safeJsonParse(legacyUser);
};

export const setAuthSession = ({ token, user }) => {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const clearAuthSession = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};
