import React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getAuthToken, removeCookie } from './useAuth';

const API_URL = 'https://whereyoustand-worker.theromeirofernandes.workers.dev/api';

function base64ToUint8Array(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importKeyFromBase64(base64Key) {
  const keyBytes = base64ToUint8Array(base64Key);
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
}

async function decryptPayload(payloadB64, base64Key) {
  if (!base64Key) throw new Error('ENCRYPTION_KEY not configured in frontend env');
  const combined = base64ToUint8Array(payloadB64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const cryptoKey = await importKeyFromBase64(base64Key);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(plain)));
}

async function fetchWithAuth(url) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    removeCookie('whereyoustand_token');
    throw new Error('Session expired');
  }

  const body = await response.json();

  if (body && body.encrypted && body.payload) {
    const ENC_KEY = import.meta.env.VITE_ENCRYPTION_KEY;
    return await decryptPayload(body.payload, ENC_KEY);
  }

  return body;
}

/**
 * Custom hook for paginated student marks.
 * Returns { students, total, page, pageSize, totalPages } from the server.
 */
export function usePaginatedMarks(isAuthenticated, setIsAuthenticated, { page, pageSize, sortBy, search }) {
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['paginatedMarks', page, pageSize, sortBy, search],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        search,
      });
      return fetchWithAuth(`${API_URL}/marks/paginated?${params}`);
    },
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    placeholderData: keepPreviousData,
  });

  React.useEffect(() => {
    if (error) {
      removeCookie('whereyoustand_token');
      setIsAuthenticated(false);
    }
  }, [error, setIsAuthenticated]);

  return {
    students: data?.students || [],
    total: data?.total || 0,
    page: data?.page || page,
    pageSize: data?.pageSize || pageSize,
    totalPages: data?.totalPages || 1,
    isLoading,
    isFetching,
  };
}

/**
 * Lightweight hook for the full student list (name + prn only).
 * Used by CommandKSearch and ComparePage's selection grid.
 */
export function useStudentList(isAuthenticated, setIsAuthenticated) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['studentList'],
    queryFn: () => fetchWithAuth(`${API_URL}/students`),
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });

  React.useEffect(() => {
    if (error) {
      removeCookie('whereyoustand_token');
      setIsAuthenticated(false);
    }
  }, [error, setIsAuthenticated]);

  return { students: data || [], isLoading };
}
