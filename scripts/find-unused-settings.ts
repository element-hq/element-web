#!/usr/bin/env node
/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Finds settings declared in apps/web/src/settings/Settings.tsx which are never
// referenced anywhere else in apps/ outside of settings/ directories. This is a
// rough heuristic (plain string search over the codebase) rather than a full
// type-aware usage analysis, but setting names are unique enough in practice.

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SETTINGS_DIR = path.join(ROOT, "apps/web/src/settings");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "Settings.tsx");

// Only the settings *definitions* directory should be excluded from the usage search -
// there are plenty of other directories literally named "settings" (e.g.
// apps/web/src/components/views/settings/) which hold real usages and must stay included.
const SETTINGS_DIR_RELATIVE = path.relative(ROOT, SETTINGS_DIR);

// See https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#setting-an-error-message
const SETTINGS_FILE_RELATIVE = path.relative(ROOT, SETTINGS_FILE);

// Settings that are only ever referenced from inside another setting's `controller: ...`
// expression in Settings.tsx (both live in the excluded settings/ directory) are treated as
// used. This is detected automatically by scanning controller text for other settings'
// search terms, but keep this list as a manual escape hatch for cases the heuristic can't
// see (e.g. usage mediated through a helper function rather than a literal reference).
const KNOWN_USED_OVERRIDES = new Set<string>([
    "test_setting", // only used in tests
]);

interface DeclaredSetting {
    // The literal setting name (as passed to SettingsStore), used for reporting.
    name: string;
    // Text(s) that count as "usage" when found via git grep, e.g. both the enum
    // member reference (`UIFeature.Registration`) and its resolved value.
    searchTerms: string[];
    line: number;
    // Source text of this setting's own `controller: ...` property, if any. Settings are
    // sometimes only ever read by another setting's controller (e.g. a UIFeatureController
    // gating a different setting) - see KNOWN_USED_VIA_CONTROLLER below for how this is used.
    controllerText?: string;
}

function parseFile(filePath: string): ts.SourceFile {
    const content = fs.readFileSync(filePath, "utf-8");
    return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/** Maps `EnumName.MemberName` -> its string literal value, for every string enum under settings/. */
function buildEnumLookup(): Map<string, string> {
    const lookup = new Map<string, string>();
    const files = fs.readdirSync(SETTINGS_DIR).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));

    for (const file of files) {
        const sourceFile = parseFile(path.join(SETTINGS_DIR, file));

        const visit = (node: ts.Node): void => {
            if (ts.isEnumDeclaration(node)) {
                for (const member of node.members) {
                    if (member.initializer && ts.isStringLiteral(member.initializer)) {
                        const memberName = member.name.getText(sourceFile);
                        lookup.set(`${node.name.text}.${memberName}`, member.initializer.text);
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
    }

    return lookup;
}

/** Extracts every top-level key of `export const SETTINGS = { ... }` via the TS AST. */
function extractSettingNames(enumLookup: Map<string, string>): DeclaredSetting[] {
    const sourceFile = parseFile(SETTINGS_FILE);
    const settings: DeclaredSetting[] = [];

    let settingsObject: ts.ObjectLiteralExpression | undefined;
    ts.forEachChild(sourceFile, (node) => {
        if (
            ts.isVariableStatement(node) &&
            node.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === "SETTINGS")
        ) {
            const decl = node.declarationList.declarations.find(
                (d) => ts.isIdentifier(d.name) && d.name.text === "SETTINGS",
            )!;
            if (decl.initializer && ts.isObjectLiteralExpression(decl.initializer)) {
                settingsObject = decl.initializer;
            }
        }
    });

    if (!settingsObject) {
        throw new Error("Could not find `export const SETTINGS` object literal in Settings.tsx");
    }

    for (const prop of settingsObject.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;

        const line = sourceFile.getLineAndCharacterOfPosition(prop.getStart(sourceFile)).line + 1;
        const propName = prop.name;
        const controllerText = findControllerText(prop.initializer, sourceFile);

        if (ts.isIdentifier(propName) || ts.isStringLiteral(propName)) {
            const name = propName.text;
            settings.push({ name, searchTerms: [name], line, controllerText });
        } else if (ts.isComputedPropertyName(propName)) {
            const enumRef = propName.expression.getText(sourceFile);
            const value = enumLookup.get(enumRef);
            if (!value) {
                console.warn(`Warning: could not resolve computed setting key [${enumRef}] at Settings.tsx:${line}`);
                continue;
            }
            // Code typically references these via the enum member (e.g. `UIFeature.Registration`)
            // rather than the resolved string, so both count as usage.
            settings.push({ name: value, searchTerms: [enumRef, value], line, controllerText });
        }
    }

    return settings;
}

/** Returns the source text of a setting definition's `controller: ...` property, if it has one. */
function findControllerText(settingValue: ts.Expression, sourceFile: ts.SourceFile): string | undefined {
    if (!ts.isObjectLiteralExpression(settingValue)) return undefined;

    for (const member of settingValue.properties) {
        if (ts.isPropertyAssignment(member) && ts.isIdentifier(member.name) && member.name.text === "controller") {
            return member.initializer.getText(sourceFile);
        }
    }

    return undefined;
}

/**
 * Checks whether any of the given search terms appears anywhere under apps/ outside the
 * settings definitions directory. Relies on the `git` binary being available on PATH.
 */
function isUsedOutsideSettings(searchTerms: string[]): boolean {
    const patternArgs = searchTerms.flatMap((term) => ["-e", term]);
    try {
        execFileSync(
            "git",
            ["grep", "-F", "-q", ...patternArgs, "--", "apps", `:(exclude)${SETTINGS_DIR_RELATIVE}/**`],
            { cwd: ROOT },
        );
        return true;
    } catch (e) {
        if (typeof (e as { status?: number }).status === "number") return false;
        throw e;
    }
}

/** Checks whether another setting's `controller` expression references one of this setting's search terms. */
function isReferencedByOtherController(setting: DeclaredSetting, allSettings: DeclaredSetting[]): boolean {
    return allSettings.some(
        (other) =>
            other.name !== setting.name &&
            other.controllerText !== undefined &&
            setting.searchTerms.some((term) => other.controllerText!.includes(term)),
    );
}

function printAnnotation(line: number, message: string): void {
    const escape = (s: string): string => s.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
    console.log(`::error file=${SETTINGS_FILE_RELATIVE},line=${line},title=Unused setting::${escape(message)}`);
}

/** De-duplicates settings by name, keeping the first occurrence. */
function dedupeSettingsByName(settings: DeclaredSetting[]): Map<string, DeclaredSetting> {
    const firstByName = new Map<string, DeclaredSetting>();
    for (const setting of settings) {
        if (!firstByName.has(setting.name)) firstByName.set(setting.name, setting);
    }
    return firstByName;
}

function findUnusedSettings(candidates: Iterable<DeclaredSetting>, allSettings: DeclaredSetting[]): DeclaredSetting[] {
    const unused: DeclaredSetting[] = [];
    for (const setting of candidates) {
        if (KNOWN_USED_OVERRIDES.has(setting.name)) continue;
        if (isUsedOutsideSettings(setting.searchTerms)) continue;
        if (isReferencedByOtherController(setting, allSettings)) continue;
        unused.push(setting);
    }
    return unused;
}

function reportUnused(unused: DeclaredSetting[]): void {
    unused.sort((a, b) => a.line - b.line);
    console.error(`⛔ Found ${unused.length} setting(s) declared with no usage:\n`);
    for (const { name, line } of unused) {
        console.error(`  Settings.tsx:${line}: "${name}"`);
        if (process.env.GITHUB_ACTIONS === "true") {
            printAnnotation(line, `Setting "${name}" is declared but never used outside ${SETTINGS_DIR_RELATIVE}/`);
        }
    }
}

function main(): void {
    const enumLookup = buildEnumLookup();
    const settings = extractSettingNames(enumLookup);
    const firstByName = dedupeSettingsByName(settings);
    const unused = findUnusedSettings(firstByName.values(), settings);

    if (unused.length > 0) {
        reportUnused(unused);
        process.exit(1);
    }

    console.log(`✅ All ${firstByName.size} settings appear to be used.`);
}

main();
