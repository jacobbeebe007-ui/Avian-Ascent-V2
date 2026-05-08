import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { transformSync } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function concatLegacy(root, minify) {
  const manifestPath = path.join(root, 'js/bootstrap/load-order.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const gameShellScripts = manifest.gameShellScripts || manifest;
  let code = '';
  for (const f of gameShellScripts) {
    code += `\n;/* === ${f} === */\n`;
    code += fs.readFileSync(path.join(root, f), 'utf8');
  }
  if (minify) {
    code = transformSync(code, {
      minify: true,
      loader: 'js',
      legalComments: 'none',
      target: 'es2018',
    }).code;
  }
  return code;
}

export default defineConfig(({ command, mode }) => ({
  root: __dirname,
  base: './',
  plugins: [
    {
      name: 'avian-legacy-concat',
      configureServer(server) {
        const root = server.config.root;
        server.middlewares.use((req, res, next) => {
          const url = (req.url || '').split('?')[0];
          if (url === '/__avian_legacy_game.js') {
            const body = concatLegacy(root, false);
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.end(body);
            return;
          }
          if (url === '/sw.js') {
            try {
              const body = fs.readFileSync(path.join(__dirname, 'sw.js'));
              res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
              res.end(body);
              return;
            } catch {
              /* fall through */
            }
          }
          next();
        });
      },
      closeBundle() {
        if (command !== 'build') return;
        try {
          fs.copyFileSync(path.join(__dirname, 'sw.js'), path.join(__dirname, 'dist', 'sw.js'));
        } catch (e) {
          console.warn('[avian-legacy-concat] copy sw.js:', e.message);
        }
      },
      generateBundle() {
        if (command !== 'build') return;
        const source = concatLegacy(__dirname, mode === 'production');
        this.emitFile({
          type: 'asset',
          fileName: 'assets/avian-game.js',
          source,
        });
      },
    },
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
}));
