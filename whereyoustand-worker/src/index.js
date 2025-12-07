import * as cheerio from 'cheerio';

// --- encryption helpers ---
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

// Auth helper - verify token
function verifyToken(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice(7);
  return token === env.AUTH_TOKEN;
}

async function generateToken(password, env) {
  if (password !== env.PASSWORD) {
    return null;
  }
  return env.AUTH_TOKEN;
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

async function loginAndScrapeMarks(prn, dobDay, dobMonth, dobYear) {
  try {
    const getResp = await fetch(LOGIN_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!getResp.ok) {
      console.error(`Failed to fetch login page for ${prn}`);
      return null;
    }

    const loginPageHtml = await getResp.text();
    const $login = cheerio.load(loginPageHtml);

    const dayStr = String(dobDay).padStart(2, '0') + ' ';
    const monthStr = String(dobMonth).padStart(2, '0');
    const yearStr = String(dobYear);
    const passwordString = `${yearStr}-${monthStr}-${dayStr.trim()}`;

    const formData = new URLSearchParams();
    formData.append('username', prn);
    formData.append('dd', dayStr);
    formData.append('mm', monthStr);
    formData.append('yyyy', yearStr);
    formData.append('passwd', passwordString);

    $login('form#login-form input[type="hidden"]').each((_, el) => {
      const name = $login(el).attr('name');
      const value = $login(el).attr('value') || '';
      if (name && name !== 'passwd') {
        formData.append(name, value);
      }
    });

    const cookies = getResp.headers.get('set-cookie');
    let cookieHeader = '';
    if (cookies) {
      cookieHeader = cookies.split(',').map(c => c.split(';')[0].trim()).join('; ');
    }

    const postResp = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieHeader,
      },
      body: formData.toString(),
      redirect: 'manual',
    });

    let welcomeHtml;
    if (postResp.status === 303 || postResp.status === 302) {
      const redirectUrl = postResp.headers.get('location');
      const newCookies = postResp.headers.get('set-cookie');
      if (newCookies) {
        cookieHeader = newCookies.split(',').map(c => c.split(';')[0].trim()).join('; ');
      }

      if (redirectUrl) {
        const fullUrl = new URL(redirectUrl, LOGIN_URL).toString();
        const redirectResp = await fetch(fullUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Cookie': cookieHeader,
          },
        });
        welcomeHtml = await redirectResp.text();
      } else {
        return null;
      }
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
  
  let cieData = {};
  
  scripts.each((_, el) => {
    const scriptContent = $(el).text().trim();
    
    if (!scriptContent.includes('stackedBarChart_1') || !scriptContent.includes('type: "bar"')) {
      return;
    }

    const categoriesMatch = scriptContent.match(/categories\s*:\s*(\[[\s\S]*?\])/);
    if (!categoriesMatch) return;

    const subjects = Array.from(
      categoriesMatch[1].matchAll(/['"]([^'"]+)['"]/g),
      m => m[1]
    );

    const columnsMatch = scriptContent.match(/columns\s*:\s*(\[[\s\S]*?\])\s*,\s*type\s*:\s*["']bar["']/);
    if (!columnsMatch) return;

    const seriesMatches = Array.from(
      columnsMatch[1].matchAll(/\[\s*['"]([^'"]+)['"]\s*([^\]]*)\]/g)
    );

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
  });

  return Object.keys(cieData).length > 0 ? cieData : null;
}

async function updateMarks(db, prn, marksData) {
  try {
    const now = new Date().toISOString();
    
    await db.prepare(
      'UPDATE students SET updated_at = ? WHERE prn = ?'
    ).bind(now, prn).run();

    for (const [subject, exams] of Object.entries(marksData)) {
      for (const [examType, marks] of Object.entries(exams)) {
        if (marks !== null) {
          const updateResult = await db.prepare(
            'UPDATE marks SET marks = ? WHERE prn = ? AND subject = ? AND exam_type = ?'
          ).bind(marks, prn, subject, examType).run();

          if (updateResult.meta.changes === 0) {
            await db.prepare(
              'INSERT INTO marks (prn, subject, exam_type, marks) VALUES (?, ?, ?, ?)'
            ).bind(prn, subject, examType, marks).run();
          }
        }
      }
    }

    return true;
  } catch (error) {
    console.error(`Database error for ${prn}:`, error);
    return false;
  }
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
        // if (!verifyToken(request, env)) {
        //   return unauthorizedResponse();
        // }

        const { results } = await env.DB.prepare(`
          SELECT s.prn, s.name, m.subject, m.exam_type, m.marks, s.updated_at
          FROM marks m
          JOIN students s ON m.prn = s.prn
          ORDER BY s.name, m.subject, m.exam_type
        `).all();

        try {
          const encrypted = await encryptPayload(results, env.ENCRYPTION_KEY);
          return jsonResponse({ encrypted: true, payload: encrypted });
        } catch (err) {
          console.error('Encryption failed:', err);
          return jsonResponse({ error: 'Encryption failed' }, 500);
        }
      }

      if (url.pathname === '/api/students' && request.method === 'GET') {
        if (!verifyToken(request, env)) {
          return unauthorizedResponse();
        }

        const { results } = await env.DB.prepare(`
          SELECT prn, name, updated_at FROM students ORDER BY name
        `).all();

        try {
          const encrypted = await encryptPayload(results, env.ENCRYPTION_KEY);
          return jsonResponse({ encrypted: true, payload: encrypted });
        } 
        catch (err) {
          console.error('Encryption failed for /api/students:', err);
          return jsonResponse({ error: 'Encryption failed' }, 500);
        }
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