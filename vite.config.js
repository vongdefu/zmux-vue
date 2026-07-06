import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  base: '/zmux-vue/',
  server: {
    port: 5173,
    proxy: {
      '/api/proxy/netease': {
        target: 'https://music.163.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/proxy\/netease/, ''),
        headers: {
          Referer: 'https://music.163.com/'
        }
      }
    }
  }
});
