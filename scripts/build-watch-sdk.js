const fs = require('fs');
const path = require('path');
const child_process = require('child_process');


const task = process.argv[2];
if (task !== "build" && task !== "watch") {
    console.error("Expected a task of 'build' or 'watch'");
    process.exit(1);
}

const sdkName = process.argv[3];
if (!sdkName) {
    console.error("Missing SDK name");
    process.exit(1);
}

const sdkPath = path.dirname(require.resolve(`matrix-${sdkName}-sdk/package.json`));
console.log(sdkPath);

// We only want to build the SDK if it looks like it was `npm link`ed
if (fs.existsSync(path.join(sdkPath, '.git'))) {
    // Install the develop dependencies just in case they were forgotten by the developer.
    console.log("Installing develop dependencies");
    const devEnv = Object.assign({}, process.env, {NODE_ENV: "development"});
    child_process.execSync("npm install --only=dev", {
        env: devEnv,
        cwd: sdkPath,
    });

    // Because webpack is made of fail
    if (sdkName === "js") {
        console.log("Installing source-map-loader");
        child_process.execSync("npm install source-map-loader", {
            env: devEnv,
            cwd: sdkPath,
        });
    }

    // Send a signal so that the various blocks can unblock. See the top of
    // block-on-sdk-build.js for more information on how this is used.
    console.log("Sending signal that other processes may unblock");
    triggerCanarySignal(sdkName);

    // Actually start the watcher process for the sdk. This is what block-on-sdk-build.js
    // is going to monitor.
    console.log("Performing task: " + task);
    child_process.execSync(`npm ${task === "build" ? "run build" : "start"}`, {
        env: process.env,
        cwd: sdkPath,
    });
}

function triggerCanarySignal(sdkName) {
    const tmpPath = path.resolve(".tmp");

    try {
        fs.mkdirSync(tmpPath);
    } catch (e) {
        if (e.code !== 'EEXIST') {
            console.error(e);
            throw "Failed to create temporary directory";
        }
    }

    // Note: we intentionally create then delete the file to work around
    // a file watching problem where if the file exists on startup it may
    // fire a "created" event for the file. By having the behaviour be "do
    // something on delete" we avoid accidentally firing the signal too
    // early.
    const canaryPath = path.join(tmpPath, sdkName);
    fs.closeSync(fs.openSync(canaryPath, 'w'));
    fs.unlinkSync(canaryPath);
}