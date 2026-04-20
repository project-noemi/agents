#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const scriptsDir = __dirname;
const extraArgs = process.argv.slice(2);

console.log('=== NoéMI Context Generation ===\n');

try {
    console.log('--- Generating GEMINI.md ---');
    let result = spawnSync('node', [path.join(scriptsDir, 'generate_gemini.js'), ...extraArgs], { stdio: 'inherit' });
    if (result.status !== 0) {
        process.exit(result.status || 1);
    }

    console.log('\n--- Generating CLAUDE.md ---');
    result = spawnSync('node', [path.join(scriptsDir, 'generate_claude.js'), ...extraArgs], { stdio: 'inherit' });
    if (result.status !== 0) {
        process.exit(result.status || 1);
    }

    console.log('\n=== All context files generated successfully. ===');
} catch (err) {
    console.error('\nGeneration failed:', err.message);
    process.exit(1);
}
