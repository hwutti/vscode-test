const { spawn } = require('child_process');
const fetch = global.fetch || require('node-fetch');

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('Starting server...');
  const server = spawn(process.execPath, ['src/index.js'], { cwd: __dirname + '/..', env: { ...process.env, PORT: '49615' }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', d => process.stdout.write('[srv] ' + d));
  server.stderr.on('data', d => process.stderr.write('[srv err] ' + d));

  // wait for server to boot
  await wait(1200);

  try {
    console.log('Checking GET /api/services');
    let res = await fetch('http://127.0.0.1:49615/api/services');
    if (res.status !== 200) throw new Error('GET services failed: ' + res.status);
    console.log('GET services ok');

    console.log('Creating test service');
    res = await fetch('http://127.0.0.1:49615/api/services', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'test', url: 'https://example.com', enabled: true }) });
    if (res.status !== 201) throw new Error('POST service failed: ' + res.status);
    const svc = await res.json();
    console.log('Created service id', svc.id);

    console.log('Verifying service in list');
    res = await fetch('http://127.0.0.1:49615/api/services');
    const list = await res.json();
    if (!Array.isArray(list) || !list.find(s => s.id === svc.id)) throw new Error('Created service not found');
    console.log('Integration test passed');
  } catch (e) {
    console.error('Test failed:', e);
    process.exitCode = 2;
  } finally {
    console.log('Stopping server');
    server.kill('SIGINT');
    await wait(500);
  }
}

run();
