import { defineConfig } from '@prisma/client';

export default defineConfig({
  datasourceUrl: 'file:./dev.db',
});
