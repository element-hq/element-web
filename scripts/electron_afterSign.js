const { notarize } = require('electron-notarize');
const { exec, execFile } = require('child_process');
const fs = require('fs');
const shellescape = require('shell-escape');

exports.default = async function(context) {
    const { electronPlatformName, appOutDir } = context;

    if (electronPlatformName === 'darwin') {
        const appName = context.packager.appInfo.productFilename;
        // We get the password from keychain. The keychain stores
        // user IDs too, but apparently altool can't get the user ID
        // from the keychain, so we need to get it from the environment.
        const userId = process.env.NOTARIZE_APPLE_ID;
        if (userId === undefined) {
            throw new Exception("User ID not found. Set NOTARIZE_APPLE_ID.");
        }

        console.log("Notarising macOS app. This may be some time.");
        return await notarize({
            appBundleId: 'im.riot.app',
            appPath: `${appOutDir}/${appName}.app`,
            appleId: userId,
            appleIdPassword: '@keychain:NOTARIZE_CREDS',
        });
    } else if (electronPlatformName === 'win32') {
        // This signs the actual Riot executable
        const appName = context.packager.appInfo.productFilename;

        // get the token passphrase from the keychain
        const tokenPassphrase = await new Promise((resolve, reject) => {
            execFile(
                'security',
                ['find-generic-password', '-s', 'riot_signing_token', '-w'],
                {},
                (err, stdout) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(stdout.trim());
                    }
                },
            );
        });

        return new Promise((resolve, reject) => {
            let cmdLine = 'osslsigncode sign ';
            if (process.env.OSSLSIGNCODE_SIGNARGS) {
                cmdLine += process.env.OSSLSIGNCODE_SIGNARGS + ' ';
            }
            const tmpFile = 'tmp_' + Math.random().toString(36).substring(2, 15) + '.exe';
            cmdLine += shellescape([
                '-pass', tokenPassphrase,
                '-in', `${appOutDir}/${appName}.exe`,
                '-out', `${appOutDir}/${tmpFile}`,
            ]);

            const signproc = exec(cmdLine, {}, (error, stdout) => {
                console.log(stdout);
            });
            signproc.on('exit', (code) => {
                if (code !== 0) {
                    reject("osslsigncode failed with code " + code);
                    return;
                }
                fs.rename(`${appOutDir}/${tmpFile}`, `${appOutDir}/${appName}.exe`, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });
    }
};
