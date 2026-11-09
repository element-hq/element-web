/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// The Copilot SDK starts its runtime, an executable from a package of its own, as a child process. In the packaged
// app that package is inside app.asar, from where nothing can be started, so electron-builder also unpacks it to
// app.asar.unpacked. The SDK doesn't know about that and has to be given the unpacked runtime.

import path from "node:path";
import { createRequire } from "node:module";

/**
 * Get where the runtime of the Copilot SDK is unpacked to, for a runtime package inside app.asar.
 * @param packageRoot - The directory of the runtime package, as Node resolves it
 * @param platform - The platform the runtime is for
 * @param arch - The architecture the runtime is for
 * @returns the path of the unpacked runtime, or undefined if the package is not inside app.asar
 */
export function getUnpackedCopilotRuntimePath(
    packageRoot: string,
    platform: NodeJS.Platform = process.platform,
    arch: string = process.arch,
): string | undefined {
    const asar = `${path.sep}app.asar${path.sep}`;
    if (!packageRoot.includes(asar)) return undefined;
    return path.join(
        packageRoot.replace(asar, `${path.sep}app.asar.unpacked${path.sep}`),
        "prebuilds",
        `${platform}-${arch}`,
        platform === "win32" ? "copilot-runtime.exe" : "copilot-runtime",
    );
}

/**
 * Get the runtime the Copilot SDK should start, if the SDK can't find it by itself.
 * @returns the path of the runtime, or undefined to let the SDK find it, as it does outside the packaged app
 */
export function getCopilotRuntimePath(): string | undefined {
    try {
        // The runtime package is a dependency of the SDK, so it is resolved from there
        const sdkRequire = createRequire(createRequire(import.meta.url).resolve("@github/copilot-sdk"));
        const packageJson = sdkRequire.resolve(`@github/copilot-sdk-${process.platform}-${process.arch}/package.json`);
        return getUnpackedCopilotRuntimePath(path.dirname(packageJson));
    } catch (e) {
        // The SDK reports a missing runtime itself, with a better message
        console.warn("Failed to find the Copilot runtime", e);
        return undefined;
    }
}
