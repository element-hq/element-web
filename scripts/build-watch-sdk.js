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

// Note: we intentionally create then delete the canary file to work
// around a file watching problem where if the file exists on startup it
// may fire a "created" event for the file. By having the behaviour be "do
// something on delete" we avoid accidentally firing the signal too early.
// We also need to ensure the create and delete events are not too close
// together, otherwise the filesystem may not fire the watcher. Therefore
// we create the canary as early as possible and delete it as late as possible.
prepareCanarySignal(sdkName);

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

    // Prepare an initial build of the SDK
    child_process.execSync("npm run start:init", {
        env: process.env,
        cwd: sdkPath,
    });

    // Send a signal to unblock the build for other processes. Used by block-on-sdk-build.js
    console.log("Sending signal that other processes may unblock");
    triggerCanarySignal(sdkName);

    // Actually start the watcher process for the SDK (without an initial build)
    console.log("Performing task: " + task);
    const watchTask = sdkName === 'js' ? "start:watch" : "start:all";
    const buildTask = "build";
    child_process.execSync(`npm run ${task === "build" ? buildTask : watchTask}`, {
        env: process.env,
        cwd: sdkPath,
    });
} else triggerCanarySignal(sdkName);

function triggerCanarySignal(sdkName) {
    fs.unlinkSync(getCanaryPath(sdkName));
}

function prepareCanarySignal(sdkName) {
    const canaryPath = getCanaryPath(sdkName);
    const canaryDir = path.dirname(canaryPath);

    try {
        console.log("Creating canary temp path...");
        fs.mkdirSync(canaryDir);
    } catch (e) {
        if (e.code !== 'EEXIST') {
            console.error(e);
            throw "Failed to create temporary directory";
        }
    }

    try {
        console.log("Creating canary file: " + canaryPath);
        fs.closeSync(fs.openSync(canaryPath, 'w'));
    } catch (e) {
        if (e.code !== 'EEXIST') {
            console.error(e);
            throw "Failed to create canary file";
        }
    }
}

function getCanaryPath(sdkName) {
    return path.join(path.resolve(".tmp"), sdkName + ".canary");
}