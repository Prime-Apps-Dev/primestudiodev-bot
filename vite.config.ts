// vite.config.ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Указываем, что это не фронтенд-проект, а Node.js приложение (библиотека)
  build: {
    // Включаем дерево шейкинг
    target: 'node16', 
    outDir: 'dist', // Папка для собранного кода
    lib: {
      entry: resolve(__dirname, 'src/index.ts'), // Точка входа для нашего бота
      fileName: 'index', // Имя выходного файла (dist/index.js)
      formats: ['es'], // Формат CommonJS или ES Module
    },
    rollupOptions: {
      // Исключаем внешние зависимости (такие как telegraf, axios), 
      // чтобы они не включались в сборку, а загружались из node_modules.
      external: ['telegraf', 'axios'],
    },
    // Отключаем очистку консоли, так как это бэкенд
    minify: false,
    emptyOutDir: true,
  },
});