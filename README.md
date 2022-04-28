# available-domains

Node.js software to detect whether the domain name is available or already taken.

It's fast, stable and provides a simple interface to search through.

## Installation

NPM, Yarn or similar is required. Afterwards, you have to install package globally, i.e.:

```bash
npm install -g available-domains
```

## Usage

To find a single or few domains, you may pass them as arguments:

```bash
available-domains google.com google.co.uk
```

Alternatively, you may pass whole file:

```bash
available-domains < domains-list.txt
```

Or pass a result of different command:

```bash
cat domains-list.txt | available-domains
```

The `stdout` will have only domains line by line, all errors, progress bars etc will land on `stderr`.

Thanks to that, you may simply stream the results to a different file, while still having all progress information available:

```bash
cat domains-list.txt | available-domains > free-domains-list.txt
# or:
available-domains < domains-list.txt > free-domains-list.txt
```

If you have a lot of domains, and you want to speed up at cost of false-positives,
you may use `--trust-dns` option. It will not be fully accurate, but will be faster.

```bash
Usage: available-domains [options] [domains...]

Options:
  -V, --version                                  output the version number
  -c <concurrency>, --concurrency <concurrency>  How many concurrent checks may be performed (default: 30)
  --trust-dns                                    Should it trust ENOTFOUND from DNS (default: false)
  --printTaken, --print-taken, -pt               Should it print taken domains too (with "E" prefix) (default: false)
  -t <timeout>, --timeout <timeout>              Timeout for WHOIS connection (ms) (default: 3000)
  -r <maxRetries>, --max-retries <maxRetries>    How many times it may retry rate limited WHOIS query (default: 2)
  -rt <retryTime>, --retry-time <retryTime>      Retry time of WHOIS query when rate limited (ms) (default: 3000)
  --proxy <proxy>, -p <proxy>                    SOCKS Proxy "<ip>:<port>"
  -h, --help                                     Show help information (default: false)
```

## How it works

Firstly, it's resolving DNS for the specified domain. It's cheaper, less limited, but not precise.

If there is an DNS record for that domain, it's immediately treat as taken. Otherwise, WHOIS record is obtained to check it this way.