/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Resolves the three numbers that decide whether IndexedDB survives a version change.
 *
 * Chromium records a schema version and a data version in the LevelDB store backing our origin, and
 * refuses (and then destroys) any store whose numbers are newer than the running build knows:
 *
 *   SchemaVersion = kLatestKnownSchemaVersion
 *   DataVersion   = (v8::CurrentValueSerializerFormatVersion() << 32) | blink::kSerializedScriptValueVersion
 *
 * All three are compile-time constants with no platform conditionals. When any of them increases,
 * users who take the new build can no longer downgrade past it without losing every Element
 * database for the origin: a "downgrade floor".
 */

/** The trio that decides cross-version compatibility. Any increase introduces a downgrade floor. */
export interface FormatVersions {
    idbSchemaVersion: number;
    v8SerializerVersion: number;
    blinkSerializerVersion: number;
}

/** The shape of idb-format-baseline.json. */
export interface Baseline extends FormatVersions {
    /** Prose kept in the file itself, so the numbers are never read without their explanation. */
    $comment?: string[];
    /** The Electron version the recorded numbers were read from. */
    electron: string;
    currentFloor: {
        $comment?: string;
        elementDesktop: string;
        since: string;
    };
}

const ELECTRON_RELEASES = "https://releases.electronjs.org/releases.json";
const CHROMIUM_RAW = "https://raw.githubusercontent.com/chromium/chromium";
const V8_RAW = "https://raw.githubusercontent.com/v8/v8";

async function fetchText(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
    return res.text();
}

/** Narrows a baseline (or anything carrying the numbers) to just the three that are compared. */
export function toFormatVersions(source: FormatVersions): FormatVersions {
    return {
        idbSchemaVersion: source.idbSchemaVersion,
        v8SerializerVersion: source.v8SerializerVersion,
        blinkSerializerVersion: source.blinkSerializerVersion,
    };
}

/**
 * The Electron major version, which is what the format numbers actually track: Electron majors map
 * to Chromium milestones, and all three constants are fixed when Chromium cuts the release branch.
 * A format change is never cherry-picked onto a stable branch, so patch bumps cannot move them.
 */
export function electronMajor(version: string): string {
    return version.split(".")[0];
}

/** Maps an exact Electron version (e.g. "44.0.0") to its exact Chromium version. */
export async function resolveChromiumVersion(electronVersion: string): Promise<string> {
    const releases = JSON.parse(await fetchText(ELECTRON_RELEASES)) as Array<{ version: string; chrome?: string }>;
    const match = releases.find((r) => r.version === electronVersion);
    if (!match?.chrome) {
        throw new Error(`no Chromium version published for Electron ${electronVersion}`);
    }
    return match.chrome;
}

function requireInt(source: string, pattern: RegExp, what: string, url: string): number {
    const value = source.match(pattern)?.[1];
    // Upstream moving the file or renaming the constant lands here, not on a bogus comparison.
    if (value === undefined) throw new Error(`could not find ${what} in ${url}`);
    return Number(value);
}

/** Reads the three constants out of the Chromium and V8 trees at an exact Chromium version tag. */
export async function fetchFormatVersions(chromiumVersion: string): Promise<FormatVersions> {
    const base = `${CHROMIUM_RAW}/${chromiumVersion}`;
    const codingUrl = `${base}/content/browser/indexed_db/indexed_db_leveldb_coding.h`;
    const blinkUrl = `${base}/third_party/blink/public/web/web_serialized_script_value_version.h`;
    const depsUrl = `${base}/DEPS`;

    const [coding, blink, deps] = await Promise.all([fetchText(codingUrl), fetchText(blinkUrl), fetchText(depsUrl)]);

    // V8 lives in its own repository, pinned by revision in Chromium's DEPS.
    const v8Revision = deps.match(/'v8_revision':\s*'([0-9a-f]{40})'/)?.[1];
    if (!v8Revision) throw new Error(`could not find v8_revision in ${depsUrl}`);
    const v8Url = `${V8_RAW}/${v8Revision}/include/v8-value-serializer-version.h`;
    const v8Header = await fetchText(v8Url);

    return {
        idbSchemaVersion: requireInt(
            coding,
            /kLatestKnownSchemaVersion\s*=\s*(\d+)/,
            "kLatestKnownSchemaVersion",
            codingUrl,
        ),
        v8SerializerVersion: requireInt(
            v8Header,
            /CurrentValueSerializerFormatVersion\(\)\s*\{\s*return\s+(\d+)/,
            "CurrentValueSerializerFormatVersion",
            v8Url,
        ),
        blinkSerializerVersion: requireInt(
            blink,
            /kSerializedScriptValueVersion\s*=\s*(\d+)/,
            "kSerializedScriptValueVersion",
            blinkUrl,
        ),
    };
}

/** Which of the format numbers increased going from `before` to `after`. */
export function increasedVersions(before: FormatVersions, after: FormatVersions): Array<keyof FormatVersions> {
    return (Object.keys(after) as Array<keyof FormatVersions>).filter((key) => after[key] > before[key]);
}
