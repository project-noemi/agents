#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const scriptsDir = __dirname;

console.log('=== NoéMI Context Generation ===\n');

try {
    console.log('--- Generating GEMINI.md ---');
    execSync(`node ${path.join(scriptsDir, 'generate_gemini.js')}`, { stdio: 'inherit' });

    console.log('\n--- Generating CLAUDE.md ---');
    execSync(`node ${path.join(scriptsDir, 'generate_claude.js')}`, { stdio: 'inherit' });

    console.log('\n=== All context files generated successfully. ===');
} catch (err) {
    console.error('\nGeneration failed:', err.message);
    process.exit(1);
}
