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

    console.log("Performing task: " + task);
    child_process.execSync(`npm ${task === "build" ? "run build" : "start"}`, {
        env: process.env,
        cwd: sdkPath,
    });
}
