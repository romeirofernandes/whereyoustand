import * as cheerio from 'cheerio';

function bytesToBase64(bytes) {
  let binary = '';
  const len = bytes.length;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function encryptPayload(obj, base64Key) {
  if (!base64Key) throw new Error('ENCRYPTION_KEY not configured');
  const rawKey = base64ToBytes(base64Key);
  const cryptoKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(obj));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plaintext);
  const cipherBytes = new Uint8Array(cipher);
  const combined = new Uint8Array(iv.length + cipherBytes.length);
  combined.set(iv, 0);
  combined.set(cipherBytes, iv.length);
  return bytesToBase64(combined);
}

const LOGIN_URL = 'https://crce-students.contineo.in/parents/index.php?option=com_studentdashboard&controller=studentdashboard&task=dashboard';

const SUBJECT_MAP = {
  '25PCC13CE11': 'Computer Network',
  '25PCC13CE12': 'TCSCC',
  '25PCC13CE13': 'Operating Systems',
  '25PCC13CE14': 'Data Warehousing and Mining',
  '25PEC13CE12': 'DLRL',
  '25PECL13CE12': 'NLP',
  '25PECL13CE15': 'OSINT',
  '25OE13CE46': '3D Printing',
  '25OE13CE42': 'IoT',
  '25PEC13CE16': 'HMI',
  '25PECL13CE14': 'IPDL',
  '25MDM42': 'ESI',
  '25MDM41': 'HWP',
  '25OE13CE43': 'SCM',
  '25OE13CE45': 'E-Vehicle',
  'HXXXC501': 'Honors/Minor Degree Course',
};

function getSubjectName(code) {
  return SUBJECT_MAP[code] || code;
}

// Pointer calculation (mirrored from frontend for server-side sorting)
const POINTER_CATEGORIES = {
  category1: ['DLRL', 'HMI', 'Operating Systems', 'Data Warehousing and Mining', 'TCSCC', 'Computer Network'],
  category2: ['IPDL', 'NLP', 'OSINT'],
  category3: ['ESI', 'HWP', 'SCM', 'IoT', '3D Printing', 'E-Vehicle'],
};

const CATEGORY_MULTIPLIERS = { category1: 3, category2: 1, category3: 2 };
const CATEGORY_TOTALS = { category1: 150, category2: 50, category3: 100 };

function getPointerFromPercentage(pct) {
  if (pct >= 85) return 10;
  if (pct >= 80) return 9;
  if (pct >= 70) return 8;
  if (pct >= 60) return 7;
  if (pct >= 50) return 6;
  if (pct >= 45) return 5;
  if (pct >= 40) return 4;
  return 0;
}

function getSubjectCategory(subject) {
  if (POINTER_CATEGORIES.category1.includes(subject)) return 'category1';
  if (POINTER_CATEGORIES.category2.includes(subject)) return 'category2';
  if (POINTER_CATEGORIES.category3.includes(subject)) return 'category3';
  return null;
}

function calculateOverallPointerServer(subjects) {
  let totalWeighted = 0;
  for (const [subject, exams] of Object.entries(subjects)) {
    const cat = getSubjectCategory(subject);
    if (!cat) continue;
    const total = Object.values(exams).reduce((s, m) => s + (typeof m === 'number' ? m : 0), 0);
    const rounded = Math.round(total);
    const pct = (rounded / CATEGORY_TOTALS[cat]) * 100;
    totalWeighted += getPointerFromPercentage(pct) * CATEGORY_MULTIPLIERS[cat];
  }
  return totalWeighted / 20;
}

// Auth helper - verify token
function verifyToken(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const payload = JSON.parse(atob(token));
    
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload.level || 'normal';
  } catch {
    return null;
  }
}

async function generateToken(password, env) {
  if (password === env.PASSWORD) {
    const payload = { 
      exp: Math.floor(Date.now() / 1000) + (2 * 24 * 60 * 60),
      level: 'normal'
    };
    return btoa(JSON.stringify(payload));
  }
  
  if (password === env.SECRET_PASSWORD) {
    const payload = { 
      exp: Math.floor(Date.now() / 1000) + (2 * 24 * 60 * 60),
      level: 'admin'
    };
    return btoa(JSON.stringify(payload));
  }
  
  return null;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

function unauthorizedResponse() {
  return jsonResponse({ error: 'Unauthorized' }, 401);
}

function extractCookies(response) {
  // Use getSetCookie() if available (modern runtimes / CF Workers)
  if (typeof response.headers.getSetCookie === 'function') {
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) {
      return cookies.map(c => c.split(';')[0].trim()).join('; ');
    }
    return '';
  }
  // Fallback: get('set-cookie') merges with commas which breaks cookies with dates
  const raw = response.headers.get('set-cookie');
  if (!raw) return '';
  return raw.split(',').map(c => c.split(';')[0].trim()).join('; ');
}

async function loginAndScrapeMarks(prn, dobDay, dobMonth, dobYear) {
  try {
    // 1) GET login page
    const getResp = await fetch(LOGIN_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
        'Referer': LOGIN_URL,
      },
    });

    if (!getResp.ok) {
      console.error(`Failed to fetch login page for ${prn}`, getResp.status);
      return null;
    }

    const loginPageHtml = await getResp.text();
    const $login = cheerio.load(loginPageHtml);

    const loginForm = $login('form#login-form');
    if (!loginForm || loginForm.length === 0) {
      console.error('Could not find login form with id=login-form');
      return null;
    }

    // Extract form action URL (may differ from LOGIN_URL)
    const formAction = loginForm.attr('action');
    const actualPostUrl = formAction
      ? new URL(formAction, LOGIN_URL).toString()
      : LOGIN_URL;

    const dayStr = String(dobDay).padStart(2, '0') + ' ';
    const monthStr = String(dobMonth).padStart(2, '0');
    const yearStr = String(dobYear);
    const passwordString = `${yearStr}-${monthStr}-${dayStr.trim()}`;

    // Build form body: credentials first, then hidden fields
    const formData = new URLSearchParams();
    formData.append('username', prn);
    formData.append('dd', dayStr);
    formData.append('mm', monthStr);
    formData.append('yyyy', yearStr);

    // Add hidden inputs in order, including duplicates
    loginForm.find('input[type="hidden"]').each((_, el) => {
      const name = $login(el).attr('name');
      const value = $login(el).attr('value') || '';
      if (name) {
        if (name === 'passwd') {
          formData.append(name, passwordString);
        } else {
          formData.append(name, value);
        }
      }
    });

    let cookieHeader = extractCookies(getResp);

    // 2) POST login
    const postResp = await fetch(actualPostUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
        'Referer': LOGIN_URL,
        'Origin': new URL(LOGIN_URL).origin,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
      },
      body: formData.toString(),
      redirect: 'manual',
    });

    // 3) Follow redirect
    let welcomeHtml;
    if (postResp.status === 303 || postResp.status === 302) {
      const redirectUrl = postResp.headers.get('location');

      // Update cookies from POST response
      const newCookies = extractCookies(postResp);
      if (newCookies) {
        cookieHeader = newCookies;
      }

      if (redirectUrl) {
        const fullUrl = new URL(redirectUrl, LOGIN_URL).toString();
        const redirectResp = await fetch(fullUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
            'Referer': LOGIN_URL,
            ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
          },
        });
        welcomeHtml = await redirectResp.text();
      } else {
        console.error('No location header in redirect response');
        return null;
      }
    } else if (!postResp.ok) {
      console.error('Login POST failed', postResp.status);
      return null;
    } else {
      welcomeHtml = await postResp.text();
    }

    return extractMarksFromPage(welcomeHtml);
  } catch (error) {
    console.error(`Error scraping marks for ${prn}:`, error);
    return null;
  }
}

function extractMarksFromPage(html) {
  const $ = cheerio.load(html);
  const scripts = $('script');
  
  console.log(`Found ${scripts.length} script tags`);
  
  let cieData = {};
  let found = false;
  
  scripts.each((_, el) => {
    if (found) return;
    const scriptContent = $(el).text().trim();
    
    if (
      !scriptContent.includes('stackedBarChart_1') ||
      !scriptContent.includes('type: "bar"') ||
      !scriptContent.includes('categories:')
    ) {
      return;
    }

    console.log('Found chart script!');

    // Extract bb.generate({ ... bindto: "#stackedBarChart_1" ... });
    const chartConfigMatch = scriptContent.match(
      /bb\.generate\s*\(\s*(\{[\s\S]*?bindto\s*:\s*['"]#stackedBarChart_1['"][\s\S]*?\})\s*\)\s*;/
    );
    if (!chartConfigMatch) {
      console.log('bb.generate config not found, trying fallback...');
      // Fallback: try original approach
    }

    const chartConfigStr = chartConfigMatch ? chartConfigMatch[1] : scriptContent;

    const categoriesMatch = chartConfigStr.match(/categories\s*:\s*(\[[\s\S]*?\])/);
    if (!categoriesMatch) {
      console.log('Categories not found');
      return;
    }

    const subjects = Array.from(
      categoriesMatch[1].matchAll(/['"]([^'"]+)['"]/g),
      m => m[1]
    );
    console.log(`Found ${subjects.length} subjects:`, subjects);

    if (!subjects.length) return;

    const columnsMatch = chartConfigStr.match(/columns\s*:\s*(\[[\s\S]*?\])\s*,\s*type\s*:\s*["']bar["']/);
    if (!columnsMatch) {
      console.log('Columns not found');
      return;
    }

    const seriesMatches = Array.from(
      columnsMatch[1].matchAll(/\[\s*['"]([^'"]+)['"]\s*([^\]]*)\]/g)
    );
    console.log(`Found ${seriesMatches.length} exam series`);

    for (const series of seriesMatches) {
      const examType = series[1];
      const valuesStr = series[2] || '';

      const rawItems = valuesStr.split(',').map(v => v.trim()).filter(v => v.length > 0);

      const parsedMarks = rawItems.map(item => {
        if (item.toLowerCase() === 'null') return null;
        
        if (item.startsWith('"') && item.endsWith('"')) {
          const inner = item.slice(1, -1);
          if (!inner || inner.toLowerCase() === 'null') return null;
          const num = Number(inner);
          return !isNaN(num) ? num : inner;
        }

        const num = Number(item);
        return !isNaN(num) ? num : item;
      });

      subjects.forEach((subjectCode, idx) => {
        const subjectName = getSubjectName(subjectCode);
        if (!cieData[subjectName]) cieData[subjectName] = {};
        cieData[subjectName][examType] = idx < parsedMarks.length ? parsedMarks[idx] : null;
      });
    }

    found = true;
  });

  if (!found) {
    console.log('Chart script not found. Page title:', $('title').text());
    // Check if login form is still on the page (meaning login failed)
    if ($('form#login-form').length > 0) {
      console.log('LOGIN FAILED - login form still present on page');
    } else {
      console.log('Login seems OK but no chart data found');
      console.log('Page contains gaugeTypeMulti:', html.includes('gaugeTypeMulti'));
      console.log('Page contains stackedBarChart:', html.includes('stackedBarChart'));
    }
  }

  console.log(`Extracted ${Object.keys(cieData).length} subjects total`);
  return Object.keys(cieData).length > 0 ? cieData : null;
}

async function updateMarks(db, prn, marksData) {
  try {
    const now = new Date().toISOString();
    
    const statements = [
      db.prepare('UPDATE students SET updated_at = ? WHERE prn = ?').bind(now, prn)
    ];

    for (const [subject, exams] of Object.entries(marksData)) {
      for (const [examType, marks] of Object.entries(exams)) {
        if (marks !== null) {
          statements.push(
            db.prepare(
              `INSERT INTO marks (prn, subject, exam_type, marks) VALUES (?, ?, ?, ?)
               ON CONFLICT(prn, subject, exam_type) DO UPDATE SET marks = excluded.marks`
            ).bind(prn, subject, examType, marks)
          );
        }
      }
    }

    await db.batch(statements);
    return true;
  } catch (error) {
    console.error(`Database error for ${prn}:`, error);
    return false;
  }
}

async function handlePaginatedMarks(env, authLevel, url) {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
  const sortBy = url.searchParams.get('sortBy') || 'none';
  const search = (url.searchParams.get('search') || '').trim();

  const hiddenPRNs = authLevel === 'normal' ? [] : [];

  // Fetch students and marks (two parallel queries)
  const [studentsRes, marksRes] = hiddenPRNs.length > 0
    ? await Promise.all([
        env.DB.prepare(
          `SELECT prn, name, updated_at FROM students WHERE prn NOT IN (${hiddenPRNs.map(() => '?').join(',')}) ORDER BY name`
        ).bind(...hiddenPRNs).all(),
        env.DB.prepare(
          `SELECT prn, subject, exam_type, marks FROM marks WHERE prn NOT IN (${hiddenPRNs.map(() => '?').join(',')})`
        ).bind(...hiddenPRNs).all(),
      ])
    : await Promise.all([
        env.DB.prepare('SELECT prn, name, updated_at FROM students ORDER BY name').all(),
        env.DB.prepare('SELECT prn, subject, exam_type, marks FROM marks').all(),
      ]);

  // Group marks by student → subject → exam
  const marksMap = {};
  for (const m of marksRes.results) {
    if (!marksMap[m.prn]) marksMap[m.prn] = {};
    if (!marksMap[m.prn][m.subject]) marksMap[m.prn][m.subject] = {};
    marksMap[m.prn][m.subject][m.exam_type] = m.marks;
  }

  let students = studentsRes.results.map((s) => ({
    prn: s.prn,
    name: s.name,
    updated_at: s.updated_at,
    subjects: marksMap[s.prn] || {},
  }));

  // Search filter
  if (search) {
    const q = search.toLowerCase();
    students = students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.prn.toLowerCase().includes(q)
    );
  }

  // Sort
  if (sortBy === 'highest' || sortBy === 'lowest') {
    students.sort((a, b) => {
      const sum = (s) =>
        Object.values(s.subjects).reduce(
          (t, exams) => t + Object.values(exams).reduce((s2, m) => s2 + (typeof m === 'number' ? m : 0), 0),
          0
        );
      return sortBy === 'highest' ? sum(b) - sum(a) : sum(a) - sum(b);
    });
  } else if (sortBy === 'pointer') {
    students.forEach((s) => {
      s._p = calculateOverallPointerServer(s.subjects);
    });
    students.sort((a, b) => b._p - a._p);
    students.forEach((s) => delete s._p);
  } else if (sortBy.startsWith('subject:')) {
    const subj = sortBy.slice('subject:'.length);
    students = students.filter((s) => s.subjects[subj]);
    students.sort((a, b) => {
      const tot = (s) =>
        Object.values(s.subjects[subj] || {}).reduce((sum, m) => sum + (typeof m === 'number' ? m : 0), 0);
      return tot(b) - tot(a);
    });
  }

  const total = students.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const pageStudents = students.slice((page - 1) * pageSize, page * pageSize);

  return { students: pageStudents, total, page, pageSize, totalPages };
}

async function scrapeOneStudent(env, offset = 0) {
  const { results: students } = await env.DB.prepare(
    'SELECT prn, name, dob_day, dob_month, dob_year, email FROM students ORDER BY prn LIMIT 1 OFFSET ?'
  ).bind(offset).all();

  if (students.length === 0) {
    return { success: false, message: 'No students to scrape' };
  }

  const student = students[0];
  console.log(`Scraping ${student.name} (${student.prn})...`);
  
  try {
    const marksData = await loginAndScrapeMarks(
      student.prn, 
      student.dob_day, 
      student.dob_month, 
      student.dob_year
    );
    
    if (marksData) {
      const success = await updateMarks(env.DB, student.prn, marksData);
      if (success) {
        console.log(`✓ Updated ${student.name}`);
        return { success: true, student: student.name, prn: student.prn, email: student.email || null};
      }
    }
    
    return { success: false, student: student.name, prn: student.prn, email: student.email || null,error: 'Scraping failed' };
  } catch (error) {
    return { success: false, student: student.name, prn: student.prn, email: student.email || null, error: error.message };
  }
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(),
        });
      }

      if (url.pathname === '/api/auth' && request.method === 'POST') {
        const body = await request.json();
        const token = await generateToken(body.password, env);
        
        if (token) {
          return jsonResponse({ token, expiresIn: '2d' });
        }
        return jsonResponse({ error: 'Invalid password' }, 401);
      }
      
      if (url.pathname === '/api/marks' && request.method === 'GET') {
        const authLevel = verifyToken(request, env);
        if (!authLevel) {
          return unauthorizedResponse();
        }

        let query = `
          SELECT s.prn, s.name, m.subject, m.exam_type, m.marks, s.updated_at
          FROM marks m
          JOIN students s ON m.prn = s.prn
          ORDER BY s.name, m.subject, m.exam_type
        `;

        // Filter hidden students for normal users
        if (authLevel === 'normal') {
          const hiddenPRNs = [
          ];
          const placeholders = hiddenPRNs.map(() => '?').join(',');
          query = `
            SELECT s.prn, s.name, m.subject, m.exam_type, m.marks, s.updated_at
            FROM marks m
            JOIN students s ON m.prn = s.prn
            WHERE s.prn NOT IN (${placeholders})
            ORDER BY s.name, m.subject, m.exam_type
          `;
          const { results } = await env.DB.prepare(query).bind(...hiddenPRNs).all();
          
          try {
            const encrypted = await encryptPayload(results, env.ENCRYPTION_KEY);
            return jsonResponse({ encrypted: true, payload: encrypted });
          } catch (err) {
            console.error('Encryption failed:', err);
            return jsonResponse({ error: 'Encryption failed' }, 500);
          }
        }

        // Admin gets all students
        const { results } = await env.DB.prepare(query).all();
        try {
          const encrypted = await encryptPayload(results, env.ENCRYPTION_KEY);
          return jsonResponse({ encrypted: true, payload: encrypted });
        } catch (err) {
          console.error('Encryption failed:', err);
          return jsonResponse({ error: 'Encryption failed' }, 500);
        }
      }

      if (url.pathname === '/api/students' && request.method === 'GET') {
        const authLevel = verifyToken(request, env);
        if (!authLevel) {
          return unauthorizedResponse();
        }

        let query = `SELECT prn, name, updated_at FROM students ORDER BY name`;

        // Filter hidden students for normal users
        if (authLevel === 'normal') {
          const hiddenPRNs = [
          ];
          const placeholders = hiddenPRNs.map(() => '?').join(',');
          query = `
            SELECT prn, name, updated_at 
            FROM students 
            WHERE prn NOT IN (${placeholders})
            ORDER BY name
          `;
          const { results } = await env.DB.prepare(query).bind(...hiddenPRNs).all();
          
          try {
            const encrypted = await encryptPayload(results, env.ENCRYPTION_KEY);
            return jsonResponse({ encrypted: true, payload: encrypted });
          } catch (err) {
            console.error('Encryption failed for /api/students:', err);
            return jsonResponse({ error: 'Encryption failed' }, 500);
          }
        }

        // Admin gets all students
        const { results } = await env.DB.prepare(query).all();
        try {
          const encrypted = await encryptPayload(results, env.ENCRYPTION_KEY);
          return jsonResponse({ encrypted: true, payload: encrypted });
        } catch (err) {
          console.error('Encryption failed for /api/students:', err);
          return jsonResponse({ error: 'Encryption failed' }, 500);
        }
      }

      if (url.pathname === '/api/marks/paginated' && request.method === 'GET') {
        const authLevel = verifyToken(request, env);
        if (!authLevel) {
          return unauthorizedResponse();
        }

        try {
          const result = await handlePaginatedMarks(env, authLevel, url);
          const encrypted = await encryptPayload(result, env.ENCRYPTION_KEY);
          return jsonResponse({ encrypted: true, payload: encrypted });
        } catch (err) {
          console.error('Paginated marks error:', err);
          return jsonResponse({ error: 'Failed to fetch paginated marks' }, 500);
        }
      }

      if (url.pathname === '/api/scrape/count' && request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT COUNT(*) as count FROM students').all();
        return jsonResponse({ count: results[0].count });
      }

      if (url.pathname === '/api/scrape/one' && request.method === 'POST') {
      
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        const result = await scrapeOneStudent(env, offset);
        return jsonResponse(result);
      }

      return jsonResponse({ error: 'Not Found' }, 404);
    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: error.message || 'Internal Server Error' }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    console.log('Starting scheduled scrape...');

    const { results } = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM students'
    ).all();
    const total = results[0].count;

    for (let offset = 0; offset < total; offset++) {
      const result = await scrapeOneStudent(env, offset);
      console.log(`Scraped offset ${offset}:`, result);
    }

    console.log('Scheduled scrape complete.');
  },
};