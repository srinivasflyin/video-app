import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: './index.html', // Main entry point
        //meeting: './meeting.html', // Additional entry point
      },
    },
  },
});
