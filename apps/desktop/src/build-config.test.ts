/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeEach, vi } from "vitest";
import { fs as memfs, vol } from "memfs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { getBuildConfig } from "./build-config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

vi.mock("node:fs", () => ({ default: memfs }));

beforeEach(() => {
    // Reset the state of the in-memory fs
    vol.reset();
});

describe("getBuildConfig", () => {
    it("should read fields from package.json correctly", () => {
        vol.fromJSON(
            {
                "../package.json": JSON.stringify({
                    electron_appId: "app.id",
                    electron_protocol: "proto",
                    electron_windows_cert_sn: "subject.name",
                }),
            },
            __dirname,
        );

        const config = getBuildConfig();
        expect(config.appId).toBe("app.id");
        expect(config.protocol).toBe("proto");
        expect(config.windowsCertSubjectName).toBe("subject.name");
    });
});
