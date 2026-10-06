const { createHash, randomBytes, randomUUID, scrypt: scryptCallback, timingSafeEqual } = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(scryptCallback);
const PASSWORD_HASH_BYTES = 64;

/**
 * Normalizza un indirizzo email prima di usarlo come identificatore univoco.
 * @param {unknown} value Valore email ricevuto dalla richiesta.
 * @returns {string} Email normalizzata in minuscolo.
 */
function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Deriva un hash password resistente agli attacchi a dizionario con un sale casuale.
 * @param {string} password Password in chiaro fornita dall'utente.
 * @returns {Promise<string>} Coppia sale/hash codificata in esadecimale.
 */
async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, PASSWORD_HASH_BYTES);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Confronta una password con il formato sale/hash persistito nel database.
 * @param {string} password Password in chiaro da verificare.
 * @param {string} storedHash Valore sale/hash salvato per l'utente.
 * @returns {Promise<boolean>} Indica se la password corrisponde.
 */
async function verifyPassword(password, storedHash) {
  const [saltHex, expectedHex] = String(storedHash || '').split(':');
  if (!saltHex || !expectedHex || !/^[a-f0-9]{32}$/i.test(saltHex) || !/^[a-f0-9]{128}$/i.test(expectedHex)) return false;
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), PASSWORD_HASH_BYTES);
  const expected = Buffer.from(expectedHex, 'hex');
  return timingSafeEqual(actual, expected);
}

/**
 * Crea accesso account, sessioni server-side e recupero password su SQLite.
 * @param {import('better-sqlite3').Database} db Connessione SQLite condivisa dal server.
 * @param {{ sessionDurationMs?: number, recoveryDurationMs?: number }} options Durate configurabili dei token.
 * @returns {object} Operazioni account da usare negli endpoint HTTP.
 */
function createAuthService(db, options = {}) {
  const sessionDurationMs = options.sessionDurationMs || 30 * 24 * 60 * 60 * 1000;
  const recoveryDurationMs = options.recoveryDurationMs || 60 * 60 * 1000;

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const digestToken = token => createHash('sha256').update(token).digest('hex');

  /**
   * Registra un account e restituisce una sessione opaca non persistita in chiaro.
   * @param {string} emailAddress Email da associare all'account.
   * @param {string} password Password scelta dall'utente.
   * @returns {Promise<{user: object, token: string}>} Profilo pubblico e token sessione.
   */
  async function register(emailAddress, password) {
    const email = normalizeEmail(emailAddress);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      const error = new Error('Enter a valid email address.');
      error.code = 'INVALID_EMAIL';
      throw error;
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      const error = new Error('Password must contain 8 to 128 characters.');
      error.code = 'INVALID_PASSWORD';
      throw error;
    }
    const passwordHash = await hashPassword(password);
    const user = { id: randomUUID(), email, createdAt: new Date().toISOString() };
    try {
      db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
        .run(user.id, user.email, passwordHash, user.createdAt);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        const duplicate = new Error('An account with this email already exists.');
        duplicate.code = 'EMAIL_EXISTS';
        throw duplicate;
      }
      throw error;
    }
    return { user, token: createSession(user.id) };
  }

  /**
   * Verifica le credenziali e crea una nuova sessione per l'account.
   * @param {string} emailAddress Email di accesso.
   * @param {string} password Password da verificare.
   * @returns {Promise<{user: object, token: string}|null>} Sessione creata oppure null.
   */
  async function login(emailAddress, password) {
    const row = db.prepare('SELECT id, email, password_hash, created_at FROM users WHERE email = ? COLLATE NOCASE')
      .get(normalizeEmail(emailAddress));
    const valid = await verifyPassword(String(password || ''), row?.password_hash || '');
    if (!valid || !row) return null;
    return {
      user: { id: row.id, email: row.email, createdAt: row.created_at },
      token: createSession(row.id),
    };
  }

  /**
   * Crea una sessione casuale e salva nel database soltanto il suo digest.
   * @param {string} userId Identificativo dell'utente autenticato.
   * @returns {string} Token da consegnare esclusivamente nel cookie HttpOnly.
   */
  function createSession(userId) {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run(digestToken(token), userId, new Date(now.getTime() + sessionDurationMs).toISOString(), now.toISOString());
    return token;
  }

  /**
   * Risolve un token sessione attivo nel profilo pubblico dell'utente.
   * @param {string} token Token letto dal cookie HttpOnly.
   * @returns {object|null} Profilo pubblico o null per sessioni scadute/non valide.
   */
  function getSessionUser(token) {
    if (!token) return null;
    const now = new Date().toISOString();
    const row = db.prepare(`
      SELECT users.id, users.email, users.created_at
      FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id
      WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?
    `).get(digestToken(token), now);
    return row ? { id: row.id, email: row.email, createdAt: row.created_at } : null;
  }

  /**
   * Revoca una sessione specifica senza invalidare gli altri dispositivi.
   * @param {string} token Token sessione da revocare.
   * @returns {void} Nessun valore restituito.
   */
  function revokeSession(token) {
    if (token) db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(digestToken(token));
  }

  /**
   * Genera un token monouso solo per account esistenti, evitando di esporre l'esistenza dell'email.
   * @param {string} emailAddress Email che ha richiesto il recupero.
   * @returns {{token: string, email: string}|null} Credenziale da inviare via email oppure null.
   */
  function createRecoveryToken(emailAddress) {
    const user = db.prepare('SELECT id, email FROM users WHERE email = ? COLLATE NOCASE').get(normalizeEmail(emailAddress));
    if (!user) return null;
    const now = new Date();
    const token = randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
    db.prepare('INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run(digestToken(token), user.id, new Date(now.getTime() + recoveryDurationMs).toISOString(), now.toISOString());
    return { token, email: user.email };
  }

  /**
   * Consuma atomicamente un token di recupero, cambia password e revoca le sessioni esistenti.
   * @param {string} token Token monouso ricevuto nel link email.
   * @param {string} password Nuova password scelta dall'utente.
   * @returns {Promise<boolean>} Indica se il token era valido ed è stato consumato.
   */
  async function resetPassword(token, password) {
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      const error = new Error('Password must contain 8 to 128 characters.');
      error.code = 'INVALID_PASSWORD';
      throw error;
    }
    const tokenHash = digestToken(String(token || ''));
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    const consume = db.transaction(() => {
      const reset = db.prepare('SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND expires_at > ?')
        .get(tokenHash, now);
      if (!reset) return false;
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, reset.user_id);
      db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(reset.user_id);
      db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(reset.user_id);
      return true;
    });
    return consume();
  }

  return { register, login, getSessionUser, revokeSession, createRecoveryToken, resetPassword };
}

module.exports = { createAuthService, normalizeEmail };