#!/usr/bin/env node
import * as readline from 'readline';
import ProgressBar = require('progress');
import { program } from 'commander';
import { red, cyan } from 'chalk';
import { DomainProcessor } from './DomainProcessor';
import { extractWords } from './extractWords';

// Build helpers

const pkgJson = require('../package.json');

function intArgument(value: string): number {
  const result = parseInt(value);
  if (isNaN(result) || `${result}` !== value) {
    throw new Error('Invalid integer.');
  }
  return result;
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
  .option(
    '--suffix <suffix>',
    'Optional suffix(es), helps to add TLDs'
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
    let availableCount = 0;

    // Set up progress bar
    const bar = new ProgressBar(cyan(':bar :itemsPercent% (:itemsCurrent/:itemsTotal) [eta: :itemsEtas | took: :itemsElapseds]'), {
      total: 100,
      width: 20,
      complete: '█',
      incomplete: '░',
      clear: true,
    });

    function tick() {
      // `node-progress` changes behavior after reaching end.
      // To handle continuous data from stream, simulate max 99%
      const maxPercentage = processor.ended ? 100 : 99;

      // Gather all data
      const current = processor.finished;
      const total = processor.size;
      const percentage = total === 0 ? 0 : 100 * current / total;
      const elapsedMs = Date.now() - startTime;
      const eta = elapsedMs * (total - current) / current;

      // Update progress bar
      bar.curr = 0;
      bar.tick(Math.min(percentage, maxPercentage), {
        itemsCurrent: current,
        itemsTotal: total,
        itemsPercent: percentage.toFixed(1),
        itemsEta: isFinite(eta) ? (eta / 1000).toFixed(1) : '0.0',
        itemsElapsed: (elapsedMs / 1000).toFixed(1),
      });
      bar.render(undefined, true);
    }

    // Set-up processor
    const processor = new DomainProcessor(options);
    processor.on('add', tick);
    processor.on('available', (name) => {
      clearLine();
      availableCount++;
      process.stdout.write(`${name}\n`);
      tick();
    });
    if (options.printTaken) {
      processor.on('taken', (name) => {
        clearLine();
        process.stdout.write(red(`[T] ${name}\n`));
        tick();
      });
    }
    processor.on('failed', (name, error) => {
      clearLine();
      process.stderr.write(red(`${name} - error: ${error.message.replace(/\n/g, ' ')}\n`));
      tick();
    });
    processor.on('end', () => {
      clearLine();
      const allCount = processor.size;
      const duplicatesCount = processor.duplicated;
      const took = ((Date.now() - startTime) / 1000).toFixed(3);
      const resultMessage = `${availableCount}/${allCount} unique domains available.`;
      const duplicatesMessage = duplicatesCount === 0 ? '' : ` Detected ${duplicatesCount} duplicates.`;
      const tookMessage = ` Took ${took} seconds.`;
      process.stderr.write(cyan(`${resultMessage}${duplicatesMessage}${tookMessage}\n`));
    });

    const suffixes: string[] = (options.suffix || '').split(',')
      .map((x: string) => x.trim())
      .filter(Boolean)
      .map((x: string) => x.includes('.') ? x : `.${x}`);
    function add(name: string): void {
      if (suffixes.length === 0) {
        processor.add(name);
      } else {
        suffixes.forEach((suffix) => processor.add(`${name}${suffix}`));
      }
    }

    // Put data from arguments into processor
    domains.forEach(add);

    // Read standard input if available
    if (process.stdin.isTTY) {
      processor.end();
    } else {
      const rl = readline.createInterface({ input: process.stdin });
      rl.on('line', (line) => extractWords(line).forEach(add));
      rl.on('close', () => processor.end());
    }

    // Initialize progress bar status
    tick();
  })
  .showHelpAfterError(true);

// Run program
program.parse(process.argv);
