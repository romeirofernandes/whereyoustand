import React from 'react';

const AUTH_COOKIE = 'whereyoustand_token';

export function getAuthToken() {
  const cookies = document.cookie.split(';');
  const authCookie = cookies.find(c => c.trim().startsWith(`${AUTH_COOKIE}=`));
  return authCookie ? decodeURIComponent(authCookie.split('=')[1]) : null;
}

export function getAuthLevel() {
  const token = getAuthToken();
  if (!token) return null;
  
  try {
    const payload = JSON.parse(atob(token));
    return payload.level || 'normal';
  } catch {
    return null;
  }
}

export function removeCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [authLevel, setAuthLevel] = React.useState(null);

  React.useEffect(() => {
    const token = getAuthToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token));
        if (payload.exp > Math.floor(Date.now() / 1000)) {
          setIsAuthenticated(true);
          setAuthLevel(payload.level || 'normal');
        } else {
          removeCookie(AUTH_COOKIE);
        }
      } catch {
        removeCookie(AUTH_COOKIE);
      }
    }
  }, []);

  return { isAuthenticated, setIsAuthenticated, authLevel, setAuthLevel };
}
