const assert = require('node:assert/strict');
const test = require('node:test');
const Database = require('better-sqlite3');
const { createAuthService } = require('./auth');

/**
 * Verifica registrazione, login, sessione, recupero monouso e revoca delle sessioni.
 * @returns {Promise<void>} Il test termina dopo aver verificato il ciclo completo account.
 */
test('account auth lifecycle stores safe hashes and consumes recovery tokens once', async () => {
  const db = new Database(':memory:');
  const auth = createAuthService(db, { sessionDurationMs: 60_000, recoveryDurationMs: 60_000 });

  const registered = await auth.register('  PERSON@example.com ', 'correct horse battery staple');
  assert.equal(registered.user.email, 'person@example.com');
  assert.equal(auth.getSessionUser(registered.token).id, registered.user.id);
  assert.equal(db.prepare('SELECT password_hash FROM users WHERE id = ?').get(registered.user.id).password_hash.includes('correct horse'), false);

  const login = await auth.login('person@example.com', 'correct horse battery staple');
  assert.equal(login.user.id, registered.user.id);
  assert.equal(await auth.login('person@example.com', 'wrong password'), null);

  const recovery = auth.createRecoveryToken('PERSON@example.com');
  assert.equal(await auth.resetPassword(recovery.token, 'another secure password'), true);
  assert.equal(await auth.resetPassword(recovery.token, 'third secure password'), false);
  assert.equal(auth.getSessionUser(registered.token), null);
  assert.equal((await auth.login('person@example.com', 'another secure password')).user.id, registered.user.id);

  db.close();
});

/**
 * Verifica che email duplicate e password deboli siano rifiutate con codici distinguibili.
 * @returns {Promise<void>} Il test termina dopo le verifiche dei vincoli di registrazione.
 */
test('account registration validates email, password and duplicate addresses', async () => {
  const db = new Database(':memory:');
  const auth = createAuthService(db);
  await assert.rejects(auth.register('not-an-email', 'long enough password'), { code: 'INVALID_EMAIL' });
  await assert.rejects(auth.register('valid@example.com', 'short'), { code: 'INVALID_PASSWORD' });
  await auth.register('valid@example.com', 'valid password');
  await assert.rejects(auth.register('VALID@example.com', 'valid password'), { code: 'EMAIL_EXISTS' });
  db.close();
});