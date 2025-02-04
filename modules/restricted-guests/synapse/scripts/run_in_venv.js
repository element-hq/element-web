/*
 * Copyright 2023 Nordeck IT + Consulting GmbH
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// A script to run a command in a python virtual environment that is stored in
// `<repo-root>/.venv`. If the virtual environment doesn't exist yet, it will
// be created.
//
// Example: $ node ./run_in_venv.js python --version

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const cwd = path.resolve(__dirname, '..');
const venvPath = path.resolve(__dirname, '../../../.venv');
const venvRelativeToCwd = path.relative(cwd, venvPath);

function run(command) {
  return new Promise((resolve) => {
    const proc = child_process.spawn(
      `source ${venvRelativeToCwd}/bin/activate && ${command}`,
      [],
      { cwd, stdio: 'inherit', shell: true },
    );

    proc.on('close', (code) => {
      console.log('command terminated:', code);
      resolve();
    });
  });
}

async function main() {
  if (!fs.existsSync(venvPath) || !fs.lstatSync(venvPath).isDirectory()) {
    child_process.execSync(`python3 -m venv ${venvRelativeToCwd}`, { cwd });
    await run('pip install tox');
    await run('pip install -e ."[dev]"');
  }

  const command = process.argv.slice(2).join(' ');

  await run(command);
}

main();
