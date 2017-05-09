/*
Copyright 2017 OpenMarket Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const path = require('path');
const spawn = require('child_process').spawn;
const app = require('electron').app;

function run_update_exe(args, done) {
    // Invokes Squirrel's Update.exe which will do things for us like create shortcuts
    // Note that there's an Update.exe in the app-x.x.x directory and one in the parent
    // directory: we need to run the one in the parent directory, because it discovers
    // information about the app by inspecting the directory it's run from.
    const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
    console.log('Spawning `%s` with args `%s`', updateExe, args);
    spawn(updateExe, args, {
      detached: true,
    }).on('close', done);
}

function check_squirrel_hooks() {
    if (process.platform != 'win32') return false;

    const cmd = process.argv[1];
    const target = path.basename(process.execPath);
    if (cmd === '--squirrel-install' || cmd === '--squirrel-updated') {
        run_update_exe(['--createShortcut=' + target + ''], app.quit);
        return true;
    } else if (cmd === '--squirrel-uninstall') {
        run_update_exe(['--removeShortcut=' + target + ''], app.quit);
        return true;
    } else if (cmd === '--squirrel-obsolete') {
        app.quit();
        return true;
    }
    return false;
}

module.exports = check_squirrel_hooks;
