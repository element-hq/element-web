const path = require('path');
const child_process = require('child_process');

const moduleName = process.argv[2];
if (!moduleName) {
    console.error("Expected module name");
    process.exit(1);
}

const argString = process.argv.length > 3 ? process.argv.slice(3).join(" ") : "";
if (!argString) {
    console.error("Expected an npm argument string to use");
    process.exit(1);
}

const modulePath = path.dirname(require.resolve(`${moduleName}/package.json`));

child_process.execSync("npm " + argString, {
    env: process.env,
    cwd: modulePath,
    stdio: ['inherit', 'inherit', 'inherit'],
});
