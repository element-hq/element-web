const fs = require("fs");

if (process.argv.length < 4) throw new Error("Missing source and target file arguments");

const sourceFile = fs.readFileSync(process.argv[2], 'utf8');
const targetFile = fs.readFileSync(process.argv[3], 'utf8');

if (sourceFile !== targetFile) {
    throw new Error("Files do not match");
}
