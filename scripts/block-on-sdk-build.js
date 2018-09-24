const path = require('path');
const chokidar = require('chokidar');
const AsyncLock = require('async-lock');


// This script sits and waits for a build of an underlying SDK (js or react)
// to complete before exiting. This is done by cooperating with build-watch-sdk.js
// by waiting for it's signal to start watching for file changes, then watching
// the SDK's build output for a storm of file changes to stop. Both the js-sdk
// and react-sdk compile each file one by one, so by waiting for file changes to
// stop we know it is safe to continue and therefore exit this script. We give
// some leeway to the SDK's build process to handle larger/more complex files
// through use of a reset-on-touch countdown timer. When a file change occurs,
// we reset the countdown to WAIT_TIME and let it count down. If the count down
// completes, we consider ourselves having left the file system update storm and
// therefore can consider a build of the SDK to be fully completed.

// Why do we block in the first place? Because if riot-web starts it's initial
// build (via webpack-dev-server) and the react-sdk or js-sdk are halfway through
// their initial builds, then riot-web's initial build fails out of the box. This
// can sometimes be corrected by waiting for the SDK build to complete and triggering
// a file change, thereby causing a cascading build, however it isn't great if the
// initial build of riot-web fails out of the box. We block at the js-sdk first so
// that the react-sdk build doesn't fall victim to the same problem, which also
// slows down the riot-web build. After the js-sdk completes, we start the react-sdk
// build which riot-web is waiting for. When complete, riot-web starts building as
// per normal.

// Why the canary to begin watching? Because we can't reliably determine that the
// build triggered by `npm install` in each SDK is actually the process we need to
// be watching for. To work around this, build-watch-sdk.js does the `npm install`
// and follows through with a canary to signal to this script that it should start
// watching for changes produced by that SDK's `npm start` (run immediately after
// the canary is sent).


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