/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import path from "node:path";
import { expect, describe, it } from "vitest";

import { getCopilotRuntimePath, getUnpackedCopilotRuntimePath } from "./copilot-runtime.js";

describe("getUnpackedCopilotRuntimePath", () => {
    const resources = path.join(path.sep, "Element Pilot", "resources");
    const packageInAsar = path.join(resources, "app.asar", "node_modules", "@github", "copilot-sdk-win32-x64");

    it("points to the runtime unpacked next to app.asar", () => {
        expect(getUnpackedCopilotRuntimePath(packageInAsar, "win32", "x64")).toBe(
            path.join(
                resources,
                "app.asar.unpacked",
                "node_modules",
                "@github",
                "copilot-sdk-win32-x64",
                "prebuilds",
                "win32-x64",
                "copilot-runtime.exe",
            ),
        );
    });

    it("uses the runtime without .exe outside Windows", () => {
        expect(getUnpackedCopilotRuntimePath(packageInAsar, "darwin", "arm64")).toMatch(
            new RegExp(`prebuilds\\${path.sep}darwin-arm64\\${path.sep}copilot-runtime$`),
        );
    });

    it("leaves a package outside app.asar to the SDK", () => {
        const packageInRepo = path.join(path.sep, "repo", "node_modules", "@github", "copilot-sdk-win32-x64");
        expect(getUnpackedCopilotRuntimePath(packageInRepo, "win32", "x64")).toBeUndefined();
    });
});

describe("getCopilotRuntimePath", () => {
    it("leaves the runtime to the SDK outside the packaged app", () => {
        expect(getCopilotRuntimePath()).toBeUndefined();
    });
});
