#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const generateAllPath = path.join(__dirname, 'generate_all.js');
const args = process.argv.slice(2);

console.log('Forwarding to generate_all.js...');
const result = spawnSync('node', [generateAllPath, ...args], { stdio: 'inherit' });
process.exit(result.status);
