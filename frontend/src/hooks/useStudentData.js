import React from 'react';
import { useQuery } from '@tanstack/react-query';
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
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    removeCookie('whereyoustand_token');
    throw new Error('Session expired');
  }

  const body = await response.json();

  if (body && body.encrypted && body.payload) {
    const ENC_KEY = import.meta.env.VITE_ENCRYPTION_KEY;
    try {
      const decrypted = await decryptPayload(body.payload, ENC_KEY);
      return decrypted;
    } catch (err) {
      console.error('Decryption failed', err);
      throw new Error('Failed to decrypt server response');
    }
  }

  return body;
}

export function useStudentData(isAuthenticated, setIsAuthenticated) {
  const { data: marksData, isLoading: marksLoading, error: marksError } = useQuery({
    queryKey: ['marks'],
    queryFn: () => fetchWithAuth(`${API_URL}/marks`),
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    onError: () => {
      removeCookie('whereyoustand_token');
      setIsAuthenticated(false);
    },
  });

  const { data: allStudents, isLoading: studentsLoading, error: studentsError } = useQuery({
    queryKey: ['students'],
    queryFn: () => fetchWithAuth(`${API_URL}/students`),
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    onError: () => {
      removeCookie('whereyoustand_token');
      setIsAuthenticated(false);
    },
  });

  React.useEffect(() => {
    if (marksError || studentsError) {
      removeCookie('whereyoustand_token');
      setIsAuthenticated(false);
    }
  }, [marksError, studentsError, setIsAuthenticated]);

  const studentsWithMarks = React.useMemo(() => {
    if (!marksData || !allStudents) return [];

    const marksMap = {};
    marksData.forEach((mark) => {
      if (!marksMap[mark.prn]) {
        marksMap[mark.prn] = {
          prn: mark.prn,
          name: mark.name,
          updated_at: mark.updated_at,
          subjects: {},
        };
      }
      if (!marksMap[mark.prn].subjects[mark.subject]) {
        marksMap[mark.prn].subjects[mark.subject] = {};
      }
      marksMap[mark.prn].subjects[mark.subject][mark.exam_type] = mark.marks;
    });

    return allStudents.map((student) => ({
      ...student,
      subjects: marksMap[student.prn]?.subjects || {},
    }));
  }, [marksData, allStudents]);

  return {
    studentsWithMarks,
    isLoading: marksLoading || studentsLoading,
  };
}
