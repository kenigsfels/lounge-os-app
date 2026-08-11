const { spawn } = require('node:child_process');

async function main() {
  const { createServer } = await import('vite');
  const electronPath = require('electron');
  const server = await createServer({
    server: {
      host: '127.0.0.1',
      port: 8765,
      strictPort: true
    }
  });

  await server.listen();

  const electron = spawn(electronPath, ['.'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SYLON_DEV_SERVER_URL: 'http://127.0.0.1:8765'
    },
    stdio: 'inherit'
  });

  electron.on('exit', async (code) => {
    await server.close();
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
