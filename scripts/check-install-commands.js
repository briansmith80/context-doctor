#!/usr/bin/env node
//
// The install commands must survive a copy-paste into any shell a user might
// have open — including cmd.exe, which the README had never accounted for.
//
// cmd.exe does not treat `;` as a command separator. It keeps the whole line as
// one command, so
//
//   claude plugin marketplace add <url>; claude plugin install <id> --yes
//
// reaches the CLI as a single `marketplace add` that also carries `--yes`, and
// `marketplace add` has no such flag. The user gets `error: unknown option
// '--yes'` — naming neither the command that failed nor the real cause — and
// nothing is installed, not even the marketplace. Dropping the flag does not
// save it either: cmd.exe then leaves the `;` glued to the URL and git fails to
// clone `<url>;.git`. Both shipped, and both read as "the plugin is broken".
//
// `--yes` is inert here regardless. Its own help scopes it to a marketplace that
// installs by running a command, or fetches its archive through a headersHelper;
// this marketplace declares a plain path source, so neither branch is reachable.
// A flag that can only ever be inert or harmful does not belong in the line the
// README asks people to paste.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILES = ['README.md', 'install.sh', 'install.ps1', 'CONTRIBUTING.md'];

// `claude plugin ...` and the in-session `/plugin ...` form both count: the
// README documents both, and both are pasted as-is.
const INVOCATION = /(?:\bclaude\s+plugin\b|(?:^|\s)\/plugin\s)/g;
const MARKETPLACE_ADD = /\bmarketplace\s+add\b/;
const YES_FLAG = /(?:^|\s)(?:--yes|-y)(?=\s|$)/;

// Only lines a reader would actually paste are in scope. In Markdown that means
// fenced blocks and nothing else — prose can name two commands in one sentence
// without inviting anyone to run them joined. In the shell scripts it means
// everything that is not a comment, since the comments explain this very bug.
function isPasteable(name, line, inFence) {
  if (name.endsWith('.md')) return inFence;
  return !/^\s*#/.test(line);
}

const problems = [];

for (const name of FILES) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) continue;

  let inFence = false;

  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    const where = `${name}:${i + 1}`;

    if (name.endsWith('.md') && /^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (!isPasteable(name, line, inFence)) return;

    const invocations = (line.match(INVOCATION) || []).length;
    if (invocations > 1) {
      problems.push(
        `${where}: ${invocations} plugin commands on one line.\n` +
        `    cmd.exe does not split on ';' - it merges them and installs nothing.\n` +
        `    Put each command on its own line.\n` +
        `    ${line.trim()}`
      );
    }

    if (MARKETPLACE_ADD.test(line) && YES_FLAG.test(line)) {
      problems.push(
        `${where}: 'marketplace add' does not accept --yes/-y.\n` +
        `    It exits 1 with "unknown option" and adds nothing.\n` +
        `    ${line.trim()}`
      );
    }
  });
}

if (problems.length) {
  console.error('Install commands are not shell-portable:\n');
  for (const p of problems) console.error(`  ${p}\n`);
  process.exit(1);
}

console.log(`ok install commands are shell-portable (${FILES.length} files checked)`);
