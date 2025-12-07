import React from 'react';

const AUTH_COOKIE = 'whereyoustand_token';

function getCookie(name) {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith(name + '='))
    ?.split('=')[1];
}

export function removeCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;
}

export function getAuthToken() {
  const token = getCookie(AUTH_COOKIE);
  return token ? decodeURIComponent(token) : null;
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  React.useEffect(() => {
    const token = getAuthToken();
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  return { isAuthenticated, setIsAuthenticated };
}
