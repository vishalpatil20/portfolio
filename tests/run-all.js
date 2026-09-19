#!/usr/bin/env node

/**
 * tests/run-all.js - Master Opaque-Box E2E Test Suite Runner
 * Coordinates Tiers 1-4 with rich reporting and exit code contracts.
 */

const path = require('node:path');
const fs = require('node:fs');
const { performance } = require('node:perf_hooks');
const { createHarness, ANSI } = require('./harness');

const TIER_MANIFEST = [
  {
    tier: 1,
    name: 'Tier 1: Feature Coverage',
    file: 'tier1_features.test.js',
    targetTests: 165,
    description: 'Isolated functional tests for all 33 features (>=5 tests per feature)'
  },
  {
    tier: 2,
    name: 'Tier 2: Boundary & Corner Cases',
    file: 'tier2_boundary.test.js',
    targetTests: 165,
    description: 'Extreme states, invalid FENs, pinned pieces, transit checks, en passant expiration'
  },
  {
    tier: 3,
    name: 'Tier 3: Cross-Feature Combinations',
    file: 'tier3_combinations.test.js',
    targetTests: 33,
    description: 'Pairwise cross-module interactions and state synergies'
  },
  {
    tier: 4,
    name: 'Tier 4: Real-World Scenarios',
    file: 'tier4_realworld.test.js',
    targetTests: 17,
    description: 'Complete games, tactical puzzles, mobile touch, console error audit'
  }
];

// CLI Argument Parser
function parseArgs(argv) {
  const options = {
    tiers: [1, 2, 3, 4],
    feature: null,
    filter: null,
    bail: false,
    verbose: false,
    compact: false,
    json: false,
    help: false
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--tier=')) {
      const val = arg.split('=')[1];
      options.tiers = val === 'all' ? [1, 2, 3, 4] : val.split(',').map(Number);
    } else if (arg === '-t' && argv[i + 1]) {
      const val = argv[++i];
      options.tiers = val === 'all' ? [1, 2, 3, 4] : val.split(',').map(Number);
    } else if (arg.startsWith('--feature=')) {
      options.feature = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--filter=')) {
      options.filter = arg.split('=')[1];
    } else if (arg === '-f' && argv[i + 1]) {
      options.filter = argv[++i];
    } else if (arg === '--bail') {
      options.bail = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--compact') {
      options.compact = true;
    } else if (arg === '--json') {
      options.json = true;
    } else {
      console.error(`${ANSI.red}Unknown argument: ${arg}${ANSI.reset}`);
      process.exit(2);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
${ANSI.bold}Portfolio & Chess Engine E2E Test Runner${ANSI.reset}

Usage:
  node tests/run-all.js [options]

Options:
  --tier=<1|2|3|4|all>    Run specific tier(s) (e.g. --tier=1 or --tier=1,2)
  -t <tier>               Alias for --tier
  --feature=<1..33>       Filter tests targeting specific feature number
  --filter=<substring>    Filter test names matching substring
  -f <substring>          Alias for --filter
  --bail                  Halt execution immediately on first failure
  --verbose               Show verbose test execution logs
  --compact               Minimal progress logging
  --json                  Output raw JSON statistics
  --help, -h              Show this help message
`);
}

async function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const selectedTiers = TIER_MANIFEST.filter(t => options.tiers.includes(t.tier));

  if (selectedTiers.length === 0) {
    console.error(`${ANSI.red}Error: No valid tiers selected.${ANSI.reset}`);
    process.exit(2);
  }

  if (!options.json) {
    console.log(`\n${ANSI.bold}${ANSI.cyan}══════════════════════════════════════════════════════════════════════════${ANSI.reset}`);
    console.log(`${ANSI.bold}  PORTFOLIO & CHESS ENGINE OPAQUE-BOX E2E TEST SUITE${ANSI.reset}`);
    console.log(`${ANSI.gray}  Selected Tiers: ${selectedTiers.map(t => `Tier ${t.tier}`).join(', ')}${ANSI.reset}`);
    if (options.feature) console.log(`${ANSI.gray}  Feature Filter: Feature #${options.feature}${ANSI.reset}`);
    if (options.filter) console.log(`${ANSI.gray}  Name Filter: "${options.filter}"${ANSI.reset}`);
    console.log(`${ANSI.bold}${ANSI.cyan}══════════════════════════════════════════════════════════════════════════${ANSI.reset}\n`);
  }

  const globalStart = performance.now();
  const results = [];
  let hasFailures = false;

  for (const tierConfig of selectedTiers) {
    const harness = createHarness();

    // Export harness functions to global scope for the test file
    global.describe = harness.describe;
    global.it = harness.it;
    global.test = harness.test;
    global.expect = harness.expect;
    global.beforeAll = harness.beforeAll;
    global.afterAll = harness.afterAll;
    global.beforeEach = harness.beforeEach;
    global.afterEach = harness.afterEach;

    const testFilePath = path.resolve(__dirname, tierConfig.file);

    let loadError = null;
    try {
      if (!fs.existsSync(testFilePath)) {
        throw new Error(`Test file does not exist: ${tierConfig.file}`);
      }
      // Clear require cache for isolated execution
      delete require.cache[require.resolve(testFilePath)];
      require(testFilePath);
    } catch (err) {
      loadError = err;
    }

    if (loadError) {
      if (!options.json) {
        console.error(`${ANSI.red}[ERROR] Failed to load test file ${tierConfig.file}:${ANSI.reset}`, loadError.message);
      }
      results.push({
        tier: tierConfig.tier,
        name: tierConfig.name,
        total: 0,
        passed: 0,
        failed: 1,
        skipped: 0,
        durationMs: 0,
        loadError: loadError.message
      });
      hasFailures = true;
      if (options.bail) break;
      continue;
    }

    // Build filter string
    let effectiveFilter = options.filter;
    if (options.feature) {
      effectiveFilter = `Feature ${options.feature}`;
    }

    if (!options.json && !options.compact) {
      console.log(`\n${ANSI.bold}${ANSI.yellow}--- Running ${tierConfig.name} ---${ANSI.reset}`);
    }

    const tierStats = await harness.runSuite({
      verbose: options.verbose,
      compact: options.compact,
      filter: effectiveFilter,
      bail: options.bail
    });

    tierStats.tier = tierConfig.tier;
    tierStats.name = tierConfig.name;
    tierStats.targetTests = tierConfig.targetTests;
    results.push(tierStats);

    if (tierStats.failed > 0) {
      hasFailures = true;
      if (options.bail) break;
    }
  }

  const totalDuration = Math.round(performance.now() - globalStart);

  if (options.json) {
    const jsonOutput = {
      timestamp: new Date().toISOString(),
      durationMs: totalDuration,
      success: !hasFailures,
      tiers: results
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
    process.exit(hasFailures ? 1 : 0);
  }

  // Render ANSI Summary Table
  console.log(`\n${ANSI.bold}${ANSI.cyan}══════════════════════════════════════════════════════════════════════════${ANSI.reset}`);
  console.log(`${ANSI.bold}  SUITE SUMMARY REPORT${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}══════════════════════════════════════════════════════════════════════════${ANSI.reset}`);

  console.log(`\n┌───────┬──────────────────────────────────┬────────┬────────┬────────┬────────┬─────────┐`);
  console.log(`│ Tier  │ Suite Name                       │ Total  │ Passed │ Failed │ Skip   │ Time    │`);
  console.log(`├───────┼──────────────────────────────────┼────────┼────────┼────────┼────────┼─────────┤`);

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const r of results) {
    totalTests += r.total;
    totalPassed += r.passed;
    totalFailed += r.failed;
    totalSkipped += r.skipped;

    const tierCol = `Tier ${r.tier}`.padEnd(5);
    const nameCol = r.name.length > 32 ? r.name.slice(0, 31) + '…' : r.name.padEnd(32);
    const totalCol = String(r.total).padStart(6);
    const passCol = `${ANSI.green}${String(r.passed).padStart(6)}${ANSI.reset}`;
    const failCol = r.failed > 0 ? `${ANSI.red}${String(r.failed).padStart(6)}${ANSI.reset}` : `     0`;
    const skipCol = String(r.skipped).padStart(6);
    const timeCol = `${r.durationMs}ms`.padStart(7);

    console.log(`│ ${tierCol} │ ${nameCol} │ ${totalCol} │ ${passCol} │ ${failCol} │ ${skipCol} │ ${timeCol} │`);
  }

  console.log(`├───────┼──────────────────────────────────┼────────┼────────┼────────┼────────┼─────────┤`);
  const grandTotal = String(totalTests).padStart(6);
  const grandPass = `${ANSI.green}${String(totalPassed).padStart(6)}${ANSI.reset}`;
  const grandFail = totalFailed > 0 ? `${ANSI.red}${String(totalFailed).padStart(6)}${ANSI.reset}` : `     0`;
  const grandSkip = String(totalSkipped).padStart(6);
  const grandTime = `${totalDuration}ms`.padStart(7);
  console.log(`│ TOTAL │ All Selected Suites              │ ${grandTotal} │ ${grandPass} │ ${grandFail} │ ${grandSkip} │ ${grandTime} │`);
  console.log(`└───────┴──────────────────────────────────┴────────┴────────┴────────┴────────┴─────────┘`);

  // Final Verdict
  if (!hasFailures) {
    console.log(`\n${ANSI.bgGreen}${ANSI.bold}${ANSI.white} [PASS] ALL ${totalTests} TESTS PASSED CLEANLY (${totalDuration}ms) ${ANSI.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${ANSI.bgRed}${ANSI.bold}${ANSI.white} [FAIL] ${totalFailed} TEST(S) FAILED OUT OF ${totalTests} (${totalDuration}ms) ${ANSI.reset}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, parseArgs };
