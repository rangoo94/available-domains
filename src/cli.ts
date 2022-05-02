#!/usr/bin/env node
import ProgressBar = require('progress');
import { program } from 'commander';
import { red, cyan } from 'chalk';
import uniqBy = require('lodash/uniqBy');
import { getAvailableDomains } from './getAvailableDomains';
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

// Define program

let stdin = '';

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
    // Determine configuration
    if (options.help) {
      return program.outputHelp();
    }
    const streamDomains = extractWords(stdin)
      .filter((x) => x.includes('.'));
    const sanitizedDomains = [ ...domains, ...streamDomains ]
        .map((x) => x.trim().split(/\s+/)[0])
        .map((x) => x.replace(/^www\./, ''))
        .filter(Boolean);
    const allDomains = uniqBy(sanitizedDomains, (x) => x.toLowerCase());
    const duplicatesCount = sanitizedDomains.length - allDomains.length;
    if (allDomains.length === 0) {
      return program.outputHelp();
    }

    // Set-up progress bar
    const bar = new ProgressBar(cyan(':bar :percent (:current/:total) [eta: :etas | took: :elapseds]'), {
      total: allDomains.length,
      width: 20,
      complete: '█',
      incomplete: '░',
      clear: true,
    });

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
      bar.tick();
      bar.render(undefined, true);
    }

    // Set-up data for summary
    const startTime = Date.now();
    let availableCount = 0;

    // Run check
    await getAvailableDomains(allDomains, {
      ...options,
      onStatus: (domain, available) => {
        clearLine();
        if (available) {
          availableCount++;
          process.stdout.write(`${domain}\n`);
        } else if (options.printTaken) {
          process.stdout.write(red(`[T] ${domain}\n`));
        }
        tickProgress();
      },
      onError: (domain, error) => {
        clearLine();
        process.stderr.write(red(`${domain} - error: ${error.message.replace(/\n/g, ' ')}\n`));
        tickProgress();
      },
    });

    // Show summary
    const took = ((Date.now() - startTime) / 1000).toFixed(3);
    clearLine();
    const resultMessage = `${availableCount}/${allDomains.length} unique domains available.`;
    const duplicatesMessage = duplicatesCount === 0 ? '' : ` Detected ${duplicatesCount} duplicates.`;
    const tookMessage = ` Took ${took} seconds.`;
    process.stderr.write(cyan(`${resultMessage}${duplicatesMessage}${tookMessage}\n`));
  })
  .showHelpAfterError(true);

// Run program

if (process.stdin.isTTY) {
  program.parse(process.argv);
} else {
  process.stdin.on('readable', () => {
    const chunk = process.stdin.read();
    if (chunk !== null) {
      stdin += chunk;
    }
  });
  process.stdin.on('end', () => program.parse(process.argv));
}
