/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/**
 * Converts a version into one the Windows packager can use.
 *
 * The Windows packager relies on parsing the version as semver, so Nightly versions (`YYYYMMDDNN`) have to be made to
 * look like one. This will give our update packages really stupid names, but we probably can't change that either
 * because Squirrel.Windows parses them for the version too. We don't really care: nobody sees them.
 * The installer has a static name, so the version is only seen in the 'about' dialog.
 * Using `0.0.0` here makes Squirrel.Windows crash, so we use `0.0.1`.
 *
 * @param version the version to build.
 * @returns the version unchanged if it is already semver-like, otherwise a semver pre-release of `0.0.1`.
 */
export function toSquirrelVersion(version: string): string {
    if (/^\d+\.\d+\.\d+/.test(version)) return version;
    return `0.0.1-nightly.${version}`;
}
