const path = require('path');
const chokidar = require('chokidar');


// This script waits for a signal that an underlying SDK (js or react) has finished
// enough of the build process to be safe to rely on. In riot-web's case, this means
// that the underlying SDK has finished an initial build and is getting ready to watch
// for changes. This is done through use of a canary file that is deleted when it is
// safe to continue (see build-watch-sdk.js for why we listen for a delete event).

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


function waitForCanary(canaryName) {
    return new Promise((resolve, reject) => {
        const filename = path.resolve(path.join(".tmp", canaryName + ".canary"));

        // See build-watch-sdk.js for why we listen for 'unlink' specifically.
        const watcher = chokidar.watch(filename).on('unlink', (path) => {
            console.log("[block-on-build] Received signal to start watching for builds");
            watcher.close();
            resolve();
        });
    });
}

const sdkName = process.argv[2];
if (!sdkName) {
    console.error("[block-on-build] No SDK name provided");
    process.exit(1);
}

console.log("[block-on-build] Waiting for SDK: " + sdkName);
waitForCanary(sdkName).then(() => {
    console.log("[block-on-build] Unblocked");
    process.exit(0);
});