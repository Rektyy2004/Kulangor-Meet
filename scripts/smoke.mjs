import assert from 'node:assert/strict';

const base = process.env.SMOKE_URL || 'http://localhost:3000';
async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Organizer-Token': token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`${path} returned HTTP ${response.status} instead of JSON. Check that the app has finished compiling.`);
  }
  return { status: response.status, data: await response.json() };
}

const demo = await request('/api/sessions/demo');
assert.equal(demo.status, 200);
assert.equal(demo.data.session.participants.length, 20);
assert.equal(demo.data.session.mode, 'demo');
assert.equal(demo.data.configuration.persistentStorage, false, 'Run smoke tests against local development storage only.');
assert.equal(demo.data.configuration.googleConfigured, false, 'Smoke fixtures require no-key demo mode.');
const departureTime = new Date(Date.now() + 24 * 3600_000).toISOString();
const calculation = await request('/api/sessions/demo/calculate', { method: 'POST', body: { departureTime } });
assert.equal(calculation.status, 200);
assert.equal(calculation.data.winner.journeys.length, 20);
assert.ok(calculation.data.candidates.length >= 10);
assert.equal(calculation.data.mode, 'demo');
const past = await request('/api/sessions/demo/calculate', { method: 'POST', body: { departureTime: '2000-01-01T00:00:00Z' } });
assert.equal(past.status, 400);

const created = await request('/api/sessions', { method: 'POST', body: { name: 'Local verification group', capacity: 2 } });
assert.equal(created.status, 201);
const id = created.data.session.id;
const token = created.data.organizerToken;
assert.ok(token);
assert.equal(created.data.session.participants.length, 0);
assert.equal(created.data.session.mode, 'live');
assert.equal((await request(`/api/sessions/${id}`)).status, 200);
const publicInfo = await request(`/api/sessions/${id}/join`);
assert.equal(publicInfo.status, 200);
assert.equal(publicInfo.data.participantCount, 0);
assert.equal(publicInfo.data.participants, undefined);
assert.equal(publicInfo.data.organizerToken, undefined);
const unverified = await request(`/api/sessions/${id}/join`, { method: 'POST', body: { name: 'Smoke One', address: 'Raw unverified address' } });
assert.equal(unverified.status, 400);
const suggestions = await request('/api/places?q=Sunway&mode=demo&sessionToken=smoke');
assert.equal(suggestions.status, 200);
assert.ok(suggestions.data.suggestions.length);
const liveSuggestions = await request('/api/places?q=Sunway&mode=live&sessionToken=smoke');
assert.equal(liveSuggestions.status, 503);
const privateInfo = await request(`/api/sessions/${id}`, { token });
assert.equal(privateInfo.status, 200);
assert.equal(privateInfo.data.session.participants.length, 0);
console.log('HTTP smoke checks passed: 20-person demo matrix, future departure, empty live groups, shared-link access, secret exclusion, raw-text rejection, demo autocomplete, explicit missing-credential error and persistence.');
console.log(`Verification-only local group: ${id}`);
