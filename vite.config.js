import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

const __dirname = path.resolve();
console.log('gggggggggggg', fs.readFileSync(path.resolve(__dirname, './ssl/server.crt')));
export default defineConfig({
  server: {
    https: {
      key: fs.readFileSync(path.resolve(__dirname, './ssl/server.key')),
      cert: fs.readFileSync(path.resolve(__dirname, './ssl/server.crt')),
    },
  },
  port: 3000
});