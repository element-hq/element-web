import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(currentDir, "../..");

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseWorkspacePatterns() {
    const workspaceFile = path.join(repoRoot, "pnpm-workspace.yaml");
    const contents = fs.readFileSync(workspaceFile, "utf8");
    const patterns = [];

    for (const line of contents.split(/\r?\n/u)) {
        const match = line.match(/^\s*-\s*"([^"]+)"\s*$/u);
        if (match) {
            patterns.push(match[1]);
        }
    }

    return patterns;
}

function expandWorkspacePattern(pattern) {
    if (!pattern.endsWith("/*")) {
        throw new Error(`Unsupported workspace pattern: ${pattern}`);
    }

    const baseDir = pattern.slice(0, -2);
    const absoluteBaseDir = path.join(repoRoot, baseDir);
    if (!fs.existsSync(absoluteBaseDir)) {
        return [];
    }

    return fs
        .readdirSync(absoluteBaseDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(absoluteBaseDir, entry.name));
}

export function getWorkspacePackages() {
    const packages = [];
    const rootPackagePath = path.join(repoRoot, "package.json");
    const rootPackage = readJson(rootPackagePath);

    packages.push({
        name: rootPackage.name,
        dir: repoRoot,
        relativeDir: ".",
        packageJsonPath: rootPackagePath,
        packageJson: rootPackage,
    });

    for (const pattern of parseWorkspacePatterns()) {
        for (const packageDir of expandWorkspacePattern(pattern)) {
            const packageJsonPath = path.join(packageDir, "package.json");
            if (!fs.existsSync(packageJsonPath)) {
                continue;
            }

            packages.push({
                name: readJson(packageJsonPath).name,
                dir: packageDir,
                relativeDir: path.relative(repoRoot, packageDir),
                packageJsonPath,
                packageJson: readJson(packageJsonPath),
            });
        }
    }

    return packages;
}

export function findPackagesByScript(scriptName) {
    return getWorkspacePackages().filter((pkg) => pkg.packageJson.scripts?.[scriptName]);
}

export function findSinglePackageByScript(scriptName) {
    const matches = findPackagesByScript(scriptName);
    if (matches.length === 0) {
        throw new Error(`No workspace package exposes a ${scriptName} script.`);
    }

    if (matches.length > 1) {
        const packageList = matches.map((pkg) => `${pkg.name} (${pkg.relativeDir})`).join(", ");
        throw new Error(`Multiple workspace packages expose a ${scriptName} script: ${packageList}`);
    }

    return matches[0];
}