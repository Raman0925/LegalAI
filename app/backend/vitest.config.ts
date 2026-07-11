import { defineConfig } from 'vitest/config';
import 'dotenv/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      COHERE_API_KEY: 'test-cohere-api-key',
      ANTHROPIC_API_KEY: 'test-anthropic-api-key',
      OPENAI_API_KEY: 'test-openai-api-key',
    },
  },
});
