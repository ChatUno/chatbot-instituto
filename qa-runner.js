#!/usr/bin/env node

const { main } = require('./qa-evaluator/index.js');

main().catch(console.error);
