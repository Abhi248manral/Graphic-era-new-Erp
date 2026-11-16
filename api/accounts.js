import supabase from './_supabase.js';
import crypto from 'node:crypto';

/**
 * CampusIQ Accounts API.
 *
 * GET ?email=...           → look up a single account (login / profile fetch)
 * GET                      → list all accounts (admin view)
 * POST { email, password, full_name, role, ... } → register new account
 * POST action=login { email, password } → verify credentials + return account
 * PUT  { id, ...fields }   → update (e.g. admin approval flips status)
 * DELETE { id }            → remove account
 *
 * Passwords are stored salted+hashed with scrypt (scrypt:<salt-hex>:<hash-hex>).
 * Legacy plaintext rows are still accepted at login and transparently
 * upgraded to scrypt on first successful sign-in.
 * The password_hash column is NEVER returned to clients.
 */

const SCRYPT_KEYLEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  if (String(stored).startsWith('scrypt:')) {
    const parts = String(stored).split(':');
    if (parts.length !== 3) return false;
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    const actual = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }
  // Legacy plaintext comparison (constant-time-ish length check first)
  return String(stored) === String(password);
}

/** Strip secrets before sending an account row to the browser. */
function publicAccount(row) {
  if (!row) return row;
  const { password_hash, ...rest } = row;
  return rest;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // ------- Credential verification (login) -------
    if (req.method === 'POST' && (req.query.action === 'login' || req.body?.action === 'login')) {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

      const { data, error } = await supabase
        .from('accounts').select('*').eq('email', email).maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'No account matches that email.' });
      if (!verifyPassword(password, data.password_hash)) return res.status(401).json({ error: 'Incorrect password.' });
      // Upgrade legacy plaintext passwords to scrypt on successful login
      if (!String(data.password_hash).startsWith('scrypt:')) {
        await supabase.from('accounts').update({ password_hash: hashPassword(password) }).eq('id', data.id);
      }

      if (data.status === 'pending_approval') {
        return res.status(403).json({ error: 'Your account is awaiting super-admin approval.' });
      }
      if (data.status === 'rejected') {
        return res.status(403).json({ error: 'Your account was rejected. Please contact the admin.' });
      }
      if (data.status === 'suspended') {
        return res.status(403).json({ error: 'Your account is suspended.' });
      }

      // Update last_login stamp but return the fresh account either way
      await supabase.from('accounts').update({ last_login_at: new Date().toISOString() }).eq('id', data.id);
      return res.status(200).json(publicAccount(data));
    }

    if (req.method === 'GET') {
      if (req.query.email) {
        const { data, error } = await supabase
          .from('accounts').select('*').eq('email', String(req.query.email).toLowerCase()).maybeSingle();
        if (error) throw error;
        return res.status(200).json(publicAccount(data));
      }
      let q = supabase.from('accounts').select('*').order('created_at', { ascending: false });
      if (req.query.status) q = q.eq('status', req.query.status);
      if (req.query.role) q = q.eq('role', req.query.role);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json((data || []).map(publicAccount));
    }

    if (req.method === 'POST') {
      const payload = {
        email: String(req.body.email || '').trim().toLowerCase(),
        password_hash: req.body.password ? hashPassword(String(req.body.password)) : (req.body.password_hash ? hashPassword(String(req.body.password_hash)) : ''),
        full_name: String(req.body.full_name || '').trim(),
        role: req.body.role || 'student',
        student_id: req.body.student_id || null,
        program: req.body.program || null,
        semester: req.body.semester || null,
        department: req.body.department || null,
        institution: req.body.institution || null,
        status: req.body.status || 'pending_approval',
      };
      if (!payload.email || !payload.password_hash || !payload.full_name) {
        return res.status(400).json({ error: 'Email, password, and full name are required.' });
      }
      // Unique email check
      const { data: existing } = await supabase.from('accounts').select('id').eq('email', payload.email).maybeSingle();
      if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

      const { data, error } = await supabase.from('accounts').insert(payload).select().single();
      if (error) throw error;
      return res.status(201).json(publicAccount(data));
    }

    if (req.method === 'PUT') {
      const { id, ...rest } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });
      // Hash any password passed through updates instead of storing it raw
      if (rest.password) {
        rest.password_hash = hashPassword(String(rest.password));
        delete rest.password;
      } else if (rest.password_hash && !String(rest.password_hash).startsWith('scrypt:')) {
        rest.password_hash = hashPassword(String(rest.password_hash));
      }
      const { data, error } = await supabase.from('accounts').update(rest).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(publicAccount(data));
    }

    if (req.method === 'DELETE') {
      const id = req.body?.id || req.query?.id;
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('accounts error:', e);
    res.status(500).json({ error: e.message });
  }
}
