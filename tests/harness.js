/**
 * tests/harness.js - Zero-Dependency BDD Test Framework & Assertion Library
 * 
 * Provides Jest/Mocha-compatible test authoring primitives:
 * - describe, it, test, describe.skip, describe.only, it.skip, it.only
 * - beforeAll, afterAll, beforeEach, afterEach
 * - expect() with full matcher suite and .not modifier
 * - Timeout guards per test (default 5000ms)
 * - ANSI colored terminal reporting with diffs and stack traces
 */

const { performance } = require('node:perf_hooks');
const util = require('node:util');

// ANSI Terminal Colors
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  white: '\x1b[37m'
};

class AssertionError extends Error {
  constructor(message, actual, expected, operator) {
    super(message);
    this.name = 'AssertionError';
    this.actual = actual;
    this.expected = expected;
    this.operator = operator;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AssertionError);
    }
  }
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.toString() === b.toString();
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const val of a) {
      let found = false;
      for (const other of b) {
        if (deepEqual(val, other)) { found = true; break; }
      }
      if (!found) return false;
    }
    return true;
  }
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, val] of a) {
      let found = false;
      for (const [otherKey, otherVal] of b) {
        if (deepEqual(key, otherKey) && deepEqual(val, otherVal)) { found = true; break; }
      }
      if (!found) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

function createHarness() {
  let rootSuite = createSuite('root');
  let currentSuite = rootSuite;
  let hasOnly = false;

  function createSuite(name, parent = null) {
    return {
      name,
      parent,
      suites: [],
      tests: [],
      beforeAllHooks: [],
      afterAllHooks: [],
      beforeEachHooks: [],
      afterEachHooks: [],
      skipped: false,
      only: false
    };
  }

  function describe(name, fn) {
    const parent = currentSuite;
    const suite = createSuite(name, parent);
    parent.suites.push(suite);

    currentSuite = suite;
    try {
      fn();
    } finally {
      currentSuite = parent;
    }
  }

  describe.skip = function(name, fn) {
    const parent = currentSuite;
    const suite = createSuite(name, parent);
    suite.skipped = true;
    parent.suites.push(suite);

    currentSuite = suite;
    try {
      fn();
    } finally {
      currentSuite = parent;
    }
  };

  describe.only = function(name, fn) {
    hasOnly = true;
    const parent = currentSuite;
    const suite = createSuite(name, parent);
    suite.only = true;
    parent.suites.push(suite);

    currentSuite = suite;
    try {
      fn();
    } finally {
      currentSuite = parent;
    }
  };

  function it(name, fn, timeoutMs = 5000) {
    const testCase = {
      name,
      fn,
      timeoutMs,
      suite: currentSuite,
      skipped: currentSuite.skipped,
      only: currentSuite.only
    };
    currentSuite.tests.push(testCase);
  }

  it.skip = function(name, fn) {
    currentSuite.tests.push({
      name,
      fn,
      timeoutMs: 0,
      suite: currentSuite,
      skipped: true,
      only: false
    });
  };

  it.only = function(name, fn, timeoutMs = 5000) {
    hasOnly = true;
    currentSuite.tests.push({
      name,
      fn,
      timeoutMs,
      suite: currentSuite,
      skipped: false,
      only: true
    });
  };

  const test = it;

  function beforeAll(fn) { currentSuite.beforeAllHooks.push(fn); }
  function afterAll(fn) { currentSuite.afterAllHooks.push(fn); }
  function beforeEach(fn) { currentSuite.beforeEachHooks.push(fn); }
  function afterEach(fn) { currentSuite.afterEachHooks.push(fn); }

  function collectAncestors(suite) {
    const chain = [];
    let curr = suite;
    while (curr) {
      chain.unshift(curr);
      curr = curr.parent;
    }
    return chain;
  }

  // Expect matchers
  function expect(actual) {
    return createMatchers(actual, false);
  }

  function createMatchers(actual, isNegated) {
    const formatValue = (v) => util.inspect(v, { depth: 4, colors: false });

    const assertCondition = (pass, msg, expected, operator) => {
      const condition = isNegated ? !pass : pass;
      if (!condition) {
        const fullMsg = isNegated 
          ? `Expected NOT ${msg}\n  Received: ${formatValue(actual)}`
          : `Expected ${msg}\n  Received: ${formatValue(actual)}\n  Expected: ${formatValue(expected)}`;
        throw new AssertionError(fullMsg, actual, expected, operator);
      }
    };

    const matchers = {
      toBe(expected) {
        assertCondition(Object.is(actual, expected), 'to be identical (Object.is)', expected, 'toBe');
      },
      toEqual(expected) {
        assertCondition(deepEqual(actual, expected), 'to deeply equal', expected, 'toEqual');
      },
      toBeDefined() {
        assertCondition(actual !== undefined, 'to be defined', undefined, 'toBeDefined');
      },
      toBeUndefined() {
        assertCondition(actual === undefined, 'to be undefined', undefined, 'toBeUndefined');
      },
      toBeNull() {
        assertCondition(actual === null, 'to be null', null, 'toBeNull');
      },
      toBeTruthy() {
        assertCondition(Boolean(actual) === true, 'to be truthy', true, 'toBeTruthy');
      },
      toBeFalsy() {
        assertCondition(Boolean(actual) === false, 'to be falsy', false, 'toBeFalsy');
      },
      toBeGreaterThan(n) {
        assertCondition(typeof actual === 'number' && actual > n, `to be greater than ${n}`, n, 'toBeGreaterThan');
      },
      toBeGreaterThanOrEqual(n) {
        assertCondition(typeof actual === 'number' && actual >= n, `to be greater than or equal to ${n}`, n, 'toBeGreaterThanOrEqual');
      },
      toBeLessThan(n) {
        assertCondition(typeof actual === 'number' && actual < n, `to be less than ${n}`, n, 'toBeLessThan');
      },
      toBeLessThanOrEqual(n) {
        assertCondition(typeof actual === 'number' && actual <= n, `to be less than or equal to ${n}`, n, 'toBeLessThanOrEqual');
      },
      toBeCloseTo(n, precision = 2) {
        const diff = Math.abs(actual - n);
        const tolerance = Math.pow(10, -precision) / 2;
        assertCondition(diff < tolerance, `to be close to ${n} within tolerance ${tolerance}`, n, 'toBeCloseTo');
      },
      toContain(item) {
        let pass = false;
        if (typeof actual === 'string') {
          pass = actual.includes(String(item));
        } else if (Array.isArray(actual)) {
          pass = actual.some(x => deepEqual(x, item));
        } else if (actual instanceof Set) {
          pass = actual.has(item) || Array.from(actual).some(x => deepEqual(x, item));
        } else if (actual instanceof Map) {
          pass = actual.has(item);
        }
        assertCondition(pass, `to contain ${formatValue(item)}`, item, 'toContain');
      },
      toMatch(pattern) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        assertCondition(regex.test(String(actual)), `to match pattern ${regex}`, pattern, 'toMatch');
      },
      toHaveLength(len) {
        const length = actual?.length !== undefined ? actual.length : actual?.size;
        assertCondition(length === len, `to have length/size ${len}`, len, 'toHaveLength');
      },
      toHaveProperty(prop, value) {
        const hasProp = actual !== null && actual !== undefined && (prop in actual || Object.prototype.hasOwnProperty.call(actual, prop));
        if (arguments.length > 1) {
          assertCondition(hasProp && deepEqual(actual[prop], value), `to have property '${prop}' with value ${formatValue(value)}`, value, 'toHaveProperty');
        } else {
          assertCondition(hasProp, `to have property '${prop}'`, prop, 'toHaveProperty');
        }
      },
      toThrow(expectedError) {
        if (typeof actual !== 'function') {
          throw new AssertionError('Actual value passed to expect().toThrow() must be a function', actual, null, 'toThrow');
        }
        let threw = false;
        let thrownError = null;
        try {
          actual();
        } catch (err) {
          threw = true;
          thrownError = err;
        }

        if (!threw) {
          assertCondition(false, 'function to throw an error', expectedError, 'toThrow');
          return;
        }

        if (expectedError) {
          if (expectedError instanceof RegExp) {
            assertCondition(expectedError.test(thrownError.message), `thrown error message to match ${expectedError}`, expectedError, 'toThrow');
          } else if (typeof expectedError === 'string') {
            assertCondition(thrownError.message.includes(expectedError), `thrown error message to contain '${expectedError}'`, expectedError, 'toThrow');
          } else if (typeof expectedError === 'function') {
            assertCondition(thrownError instanceof expectedError, `thrown error to be instance of ${expectedError.name}`, expectedError, 'toThrow');
          }
        } else {
          // Function threw as expected
          assertCondition(true, 'function not to throw an error but threw: ' + (thrownError ? thrownError.message : ''), null, 'toThrow');
        }
      },
      async toThrowAsync(expectedError) {
        if (typeof actual !== 'function') {
          throw new AssertionError('Actual value passed to expect().toThrowAsync() must be a function', actual, null, 'toThrowAsync');
        }
        let threw = false;
        let thrownError = null;
        try {
          await actual();
        } catch (err) {
          threw = true;
          thrownError = err;
        }

        if (!threw) {
          assertCondition(false, 'async function to throw an error', expectedError, 'toThrowAsync');
          return;
        }

        if (expectedError) {
          if (expectedError instanceof RegExp) {
            assertCondition(expectedError.test(thrownError.message), `thrown error message to match ${expectedError}`, expectedError, 'toThrowAsync');
          } else if (typeof expectedError === 'string') {
            assertCondition(thrownError.message.includes(expectedError), `thrown error message to contain '${expectedError}'`, expectedError, 'toThrowAsync');
          } else if (typeof expectedError === 'function') {
            assertCondition(thrownError instanceof expectedError, `thrown error to be instance of ${expectedError.name}`, expectedError, 'toThrowAsync');
          }
        } else {
          assertCondition(true, 'async function not to throw an error but threw: ' + (thrownError ? thrownError.message : ''), null, 'toThrowAsync');
        }
      }
    };

    if (!isNegated) {
      matchers.not = createMatchers(actual, true);
    }

    return matchers;
  }

  // Suite Runner
  async function runSuite(options = {}) {
    const {
      verbose = false,
      compact = false,
      filter = null,
      bail = false
    } = options;

    const stats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      durationMs: 0,
      failures: []
    };

    const startTime = performance.now();

    async function executeSuite(suite, depth = 0) {
      const indent = '  '.repeat(depth);
      if (suite.name !== 'root' && !compact) {
        console.log(`${indent}${ANSI.bold}${suite.name}${ANSI.reset}`);
      }

      // Execute beforeAll hooks
      for (const hook of suite.beforeAllHooks) {
        await hook();
      }

      // Execute tests
      for (const testCase of suite.tests) {
        if (hasOnly && !testCase.only) continue;

        const testFullName = `${suite.name} ${testCase.name}`;
        if (filter && !testFullName.toLowerCase().includes(filter.toLowerCase())) continue;

        stats.total++;

        if (testCase.skipped || suite.skipped) {
          stats.skipped++;
          if (!compact) {
            console.log(`${indent}  ${ANSI.yellow}↷ ${testCase.name} (skipped)${ANSI.reset}`);
          }
          continue;
        }

        // Collect all beforeEach hooks from root down to current
        const ancestors = collectAncestors(suite);
        const beforeEachHooks = ancestors.flatMap(s => s.beforeEachHooks);
        const afterEachHooks = ancestors.flatMap(s => s.afterEachHooks).reverse();

        const testStart = performance.now();
        let testError = null;

        try {
          for (const hook of beforeEachHooks) {
            await hook();
          }

          // Run test with timeout guard
          let timer;
          const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => {
              reject(new Error(`Test timed out after ${testCase.timeoutMs}ms`));
            }, testCase.timeoutMs);
          });

          await Promise.race([
            Promise.resolve(testCase.fn()),
            timeoutPromise
          ]);
          clearTimeout(timer);

        } catch (err) {
          testError = err;
        } finally {
          for (const hook of afterEachHooks) {
            try {
              await hook();
            } catch (hookErr) {
              if (!testError) testError = hookErr;
            }
          }
        }

        const testDuration = Math.round(performance.now() - testStart);

        if (!testError) {
          stats.passed++;
          if (!compact) {
            const timeStr = testDuration > 50 || verbose ? ` ${ANSI.gray}(${testDuration}ms)${ANSI.reset}` : '';
            console.log(`${indent}  ${ANSI.green}✔${ANSI.reset} ${ANSI.gray}${testCase.name}${ANSI.reset}${timeStr}`);
          }
        } else {
          stats.failed++;
          const failureRecord = {
            suite: suite.name,
            testName: testCase.name,
            error: testError,
            durationMs: testDuration
          };
          stats.failures.push(failureRecord);

          console.log(`${indent}  ${ANSI.red}✖ ${testCase.name}${ANSI.reset} ${ANSI.gray}(${testDuration}ms)${ANSI.reset}`);
          console.log(`${indent}    ${ANSI.red}${testError.message}${ANSI.reset}`);
          if (testError.stack) {
            const stackLines = testError.stack.split('\n').slice(1, 4).join('\n');
            console.log(`${indent}    ${ANSI.gray}${stackLines}${ANSI.reset}`);
          }

          if (bail) {
            console.log(`\n${ANSI.yellow}[BAIL] Stopping suite execution after failure.${ANSI.reset}`);
            break;
          }
        }
      }

      // Execute child suites
      for (const childSuite of suite.suites) {
        if (bail && stats.failed > 0) break;
        await executeSuite(childSuite, depth + 1);
      }

      // Execute afterAll hooks
      for (const hook of suite.afterAllHooks) {
        await hook();
      }
    }

    await executeSuite(rootSuite);
    stats.durationMs = Math.round(performance.now() - startTime);

    return stats;
  }

  function reset() {
    rootSuite = createSuite('root');
    currentSuite = rootSuite;
    hasOnly = false;
  }

  return {
    describe,
    it,
    test,
    expect,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,
    runSuite,
    reset,
    ANSI,
    AssertionError
  };
}

// Global default instance for direct usage
const defaultHarness = createHarness();

module.exports = {
  ...defaultHarness,
  createHarness,
  AssertionError,
  ANSI,
  deepEqual
};
