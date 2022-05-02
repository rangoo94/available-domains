#!/usr/bin/env node
import * as readline from 'readline';
import ProgressBar = require('progress');
import PQueue from 'p-queue';
import { program } from 'commander';
import { red, cyan } from 'chalk';
import { extractWords } from './extractWords';
import { isDomainAvailable } from './isDomainAvailable';

// Build helpers

const pkgJson = require('../package.json');

function intArgument(value: string): number {
  const result = parseInt(value);
  if (isNaN(result) || `${result}` !== value) {
    throw new Error('Invalid integer.');
  }
  return result;
}

// Define program

program
  .name(pkgJson.name)
  .version(pkgJson.version)
  .argument('[domains...]')
  .requiredOption<number>(
    '--concurrency <concurrency>, -c <concurrency>',
    'How many concurrent checks may be performed',
    intArgument,
    30,
  )
  .requiredOption(
    '--trust-dns',
    'Should it trust ENOTFOUND from DNS',
    false,
  )
  .requiredOption(
    '--printTaken, --print-taken, -pt',
    'Should it print taken domains too (with "[T]" prefix)',
    false,
  )
  .requiredOption<number>(
    '--timeout <timeout>, -t <timeout>',
    'Timeout for WHOIS connection (ms)',
    intArgument,
    3000
  )
  .requiredOption<number>(
    '--max-retries <maxRetries>, -r <maxRetries>',
    'How many times it may retry rate limited WHOIS query',
    intArgument,
    2
  )
  .requiredOption<number>(
    '--retry-time <retryTime>, -rt <retryTime>',
    'Retry time of WHOIS query when rate limited (ms)',
    intArgument,
    3000
  )
  .option(
    '--proxy <proxy>, -p <proxy>',
    'SOCKS Proxy "<ip>:<port>"',
  )
  .requiredOption(
    '-h, --help',
    'Show help information',
    false,
  )
  .action(async (domains: string[], options) => {
    // Detect help
    if (options.help) {
      return program.outputHelp();
    }

    // Initialize state
    const startTime = Date.now();
    const allDomains: string[] = [];
    const availableDomains: string[] = [];
    const notAvailableDomains: string[] = [];
    const failedDomains: string[] = [];
    let duplicatesCount = 0;
    let stdinEnd = false;

    // Initialize queue
    const queue = new PQueue({
      concurrency: options.concurrency,
    });

    // Set-up progress bar
    const bar = new ProgressBar(cyan(':bar :itemsPercent% (:itemsCurrent/:itemsTotal) [eta: :itemsEtas | took: :itemsElapseds]'), {
      total: 100,
      width: 20,
      complete: '█',
      incomplete: '░',
      clear: true,
    });
    tickProgress();

    // Initialize output helpers
    function isEnd() {
      return !queue.pending && queue.size === 0 && stdinEnd;
    }

    function clearLine() {
      process.stderr.clearLine(0);
      if (process.stdout.cursorTo) {
        process.stdout.cursorTo(0);
      }
      if (process.stderr.cursorTo) {
        process.stderr.cursorTo(0);
      }
    }

    function tickProgress() {
      const allCount = allDomains.length;
      const processedCount = availableDomains.length + notAvailableDomains.length + failedDomains.length;
      const leftCount = allCount - processedCount;
      const elapsedMs = Date.now() - startTime;
      const eta = elapsedMs * (leftCount / processedCount);
      const percentage = allDomains.length === 0 ? 0 : 100 * processedCount / allCount;
      bar.curr = 0;
      bar.tick(isEnd() ? percentage : Math.min(percentage, 99), {
        itemsEta: ((isFinite(eta) ? eta : 0) / 1000).toFixed(1),
        itemsElapsed: (elapsedMs / 1000).toFixed(1),
        itemsPercent: percentage.toFixed(2),
        itemsCurrent: processedCount,
        itemsTotal: allCount,
      });
      bar.render(undefined, true);
    }

    // Initialize state helpers
    async function handle(name: string): Promise<void> {
      try {
        const available = await isDomainAvailable(name, options);
        clearLine();
        if (available) {
          availableDomains.push(name);
          process.stdout.write(`${name}\n`);
        } else if (options.printTaken) {
          notAvailableDomains.push(name);
          process.stdout.write(red(`[T] ${name}\n`));
        }
      } catch (rawError) {
        const error = rawError as Error;
        failedDomains.push(name);
        clearLine();
        process.stderr.write(red(`${name} - error: ${error.message.replace(/\n/g, ' ')}\n`));
      }
      tickProgress();
    }

    function add(name: string): void {
      const finalName = name.trim().replace(/^www\./, '').toLowerCase();
      if (!name) {
        return;
      } else if (allDomains.includes(finalName)) {
        duplicatesCount++;
      } else {
        allDomains.push(finalName);
        queue.add(() => handle(finalName));
        tickProgress();
      }
    }

    let finished = false;
    function finish(): void {
      if (!isEnd() || finished) {
        return;
      }

      tickProgress();

      finished = true;

      // Show help if there was no domains provided
      if (allDomains.length === 0) {
        return program.outputHelp();
      }

      // Show summary
      const took = ((Date.now() - startTime) / 1000).toFixed(3);
      clearLine();
      const resultMessage = `${availableDomains.length}/${allDomains.length} unique domains available.`;
      const duplicatesMessage = duplicatesCount === 0 ? '' : ` Detected ${duplicatesCount} duplicates.`;
      const tookMessage = ` Took ${took} seconds.`;
      process.stderr.write(cyan(`${resultMessage}${duplicatesMessage}${tookMessage}\n`));
    }

    for (const name of domains) {
      add(name);
    }

    // Handle queue end
    queue.on('idle', finish);

    // Read stdin if available
    if (process.stdin.isTTY) {
      stdinEnd = true;
    } else {
      const rl = readline.createInterface({ input: process.stdin });
      rl.on('line', (line) => extractWords(line).forEach(add));
      rl.on('close', () => {
        stdinEnd = true;
        finish();
      });
      rl.on('pause', () => {
        stdinEnd = true;
        finish();
      });
    }

    // Try to finish immediately if empty
    finish();
  })
  .showHelpAfterError(true);

// Run program
program.parse(process.argv);
