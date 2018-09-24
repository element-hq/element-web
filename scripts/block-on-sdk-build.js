const path = require('path');
const chokidar = require('chokidar');
const AsyncLock = require('async-lock');


const WAIT_TIME = 5000; // ms

function waitForCanary(canaryName) {
    return new Promise((resolve, reject) => {
        const filename = path.resolve(path.join(".tmp", canaryName));

        // See triggerCanarySignal in build-watch-sdk.js for why we watch for `unlink`
        const watcher = chokidar.watch(filename).on('unlink', (path) => {
            console.log("[block-on-build] Received signal to start watching for builds");
            watcher.close();
            resolve();
        });
    });
}

function waitOnSdkBuild(sdkName) {
    // First we wait for a local canary file to be changed
    return waitForCanary(sdkName).then(() => new Promise((resolve, reject) => {
        const buildDirectory = path.dirname(require.resolve(`matrix-${sdkName}-sdk`));
        const lock = new AsyncLock();
        let timerId = null;

        const watcher = chokidar.watch(buildDirectory).on('all', (event, path) => {
            lock.acquire("timer", (done) => {
                if (timerId !== null) {
                    //console.log("Resetting countdown");
                    clearTimeout(timerId);
                }
                //console.log(`Waiting ${WAIT_TIME}ms for another file update...`);
                timerId = setTimeout(() => {
                    console.log("[block-on-build] No updates - unblocking");
                    watcher.close();
                    resolve();
                }, WAIT_TIME);
                done();
            }, null, null);
        });
    }));
}

const sdkName = process.argv[2];
if (!sdkName) {
    console.error("[block-on-build] No SDK name provided");
    process.exit(1);
}

console.log("[block-on-build] Waiting for SDK: " + sdkName);
waitOnSdkBuild(sdkName).then(() => {
    console.log("[block-on-build] Unblocked");
    process.exit(0);
});