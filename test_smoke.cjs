async function smokeTest() {
  const email = `test_smoke_${Date.now()}@example.com`;
  const password = 'password123';
  let res;

  // 1. Register
  console.log('Registering user...');
  res = await fetch('http://127.0.0.1:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, passwordConfirmation: password })
  });
  console.log('Register:', res.status, await res.text());

  // 2. Verify Email
  console.log('Verifying email...');
  await new Promise(r => setTimeout(r, 1000)); // wait for file write
  const fs = require('fs');
  const logs = fs.readFileSync('email.log', 'utf8');
  const tokenMatch = logs.match(/token=([a-zA-Z0-9_-]+)&email=/g);
  if (!tokenMatch) throw new Error('Token not found in email.log');
  const token = tokenMatch.pop().replace('token=', '').replace('&email=', '');
  
  res = await fetch('http://127.0.0.1:3000/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token })
  });
  console.log('Verify:', res.status, await res.text());

  // 3. Login
  console.log('Logging in...');
  res = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  console.log('Login:', res.status, await res.text());

  // 4. Me
  console.log('Fetching /me...');
  res = await fetch('http://127.0.0.1:3000/api/auth/me', {
    headers: { cookie }
  });
  console.log('Me:', res.status, await res.text());

  // 5. Create Workspace (Database)
  console.log('Creating database...');
  res = await fetch('http://127.0.0.1:3000/api/databases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ mode: 'create', dbType: 'SQLite', fullPath: 'SmokeTestDB.sqlite' })
  });
  console.log('Create Database:', res.status, await res.text());

  // 6. Fetch Invoices to verify DB connection
  console.log('Fetching invoices...');
  res = await fetch('http://127.0.0.1:3000/api/invoices', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', cookie },
  });
  console.log('Fetch Invoices:', res.status, await res.text());

}

smokeTest().catch(console.error);
