// src/index.ts

import { runMainAgent } from './agents/main.js';

async function main() {
  try {
    await runMainAgent();
  } catch (error) {
    console.error('ERROR [main]:', error);
    process.exit(1);
  }
}

main();
