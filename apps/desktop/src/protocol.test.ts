/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeEach, vi } from "vitest";
import { fs as memfs, vol } from "memfs";

import ProtocolHandler from "./protocol.js";

const TEST_PROTOCOL = "test.proto";
const TEST_SESSION_ID = "test_session_id";
const USER_DATA_DIR = "/Users/name/Library/Application Support/Element";

vi.mock("node:fs", () => ({ default: memfs }));
vi.mock("electron", () => ({
    app: {
        getPath: vi.fn().mockReturnValue("/Users/name/Library/Application Support/Element"),
        on: vi.fn(),
    },
    ipcMain: {
        handle: vi.fn(),
    },
}));

beforeEach(() => {
    // Reset the state of the in-memory fs
    vol.reset();
});

describe("ProtocolHandler", () => {
    describe("getProfileFromDeeplink", () => {
        const handler = new ProtocolHandler(TEST_PROTOCOL);

        beforeEach(() => {
            vol.fromJSON(
                {
                    "./sso-sessions.json": JSON.stringify({ [TEST_SESSION_ID]: USER_DATA_DIR }),
                },
                USER_DATA_DIR,
            );
        });

        it("should handle legacy SSO URIs", () => {
            expect(
                handler.getProfileFromDeeplink([
                    "Element.app",
                    `element://vector/webapp/?element-desktop-ssoid=${TEST_SESSION_ID}`,
                ]),
            ).toBe(USER_DATA_DIR);
        });

        it("should handle OIDC URIs with response_mode=query", () => {
            expect(
                handler.getProfileFromDeeplink([
                    "Element.app",
                    `${TEST_PROTOCOL}:/vector/webapp/?no_universal_links=true&code=DEADBEEF&state=foobar:element-desktop-ssoid:${TEST_SESSION_ID}`,
                ]),
            ).toBe(USER_DATA_DIR);
        });

        it("should handle OIDC URIs with response_mode=fragment", () => {
            expect(
                handler.getProfileFromDeeplink([
                    "Element.app",
                    `${TEST_PROTOCOL}:/vector/webapp/?no_universal_links=true#code=DEADBEEF&state=foobar:element-desktop-ssoid:${TEST_SESSION_ID}`,
                ]),
            ).toBe(USER_DATA_DIR);
        });

        it("should handle unrelated URIs gracefully", () => {
            expect(handler.getProfileFromDeeplink(["Element.app", `${TEST_PROTOCOL}:/vector/webapp/`])).toBeUndefined();
            expect(handler.getProfileFromDeeplink(["Element.app", `test.unrelated:/vector/webapp/`])).toBeUndefined();
        });
    });
});
