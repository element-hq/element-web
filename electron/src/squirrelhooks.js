const path = require('path');
const spawn = require('child_process').spawn;
const app = require('electron').app;

function run_update_exe(args, done) {
    const updateExe = path.resolve(path.dirname(process.execPath), 'Update.exe');
    spawn(updateExe, args, {
      detached: true
    }).on('close', done);
};

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
