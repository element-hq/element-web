/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeEach, vi } from "vitest";
import { fs as memfs, vol } from "memfs";
import { app } from "electron";

import { type Args, getArgs, getArgsForProtocolRegistration } from "./args.js";
import type ProtocolHandler from "./protocol.js";

vi.mock("node:fs", () => ({ default: memfs }));
vi.mock("electron", () => ({
    app: {
        getPath: vi.fn().mockImplementation((dirName) => {
            if (dirName === "userData") return "/Users/name/Library/Application Support/Element";
            if (dirName === "appData") return "/Users/name/Library/Application Support";
            throw new Error("Not implemented");
        }),
        getName: vi.fn().mockReturnValue("Element"),
        exit: vi.fn(),
    },
}));

beforeEach(() => {
    // Reset the state of the in-memory fs
    vol.reset();
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

describe("getArgsForProtocolRegistration", () => {
    it("should return an empty array for default args", () => {
        expect(
            getArgsForProtocolRegistration({
                userDataPath: "/Users/name/Library/Application Support/Element",
                devtools: false,
                update: true,
                hidden: false,
                positional: [],
            }),
        ).toStrictEqual([]);
    });

    it("should handle standard args", () => {
        expect(
            getArgsForProtocolRegistration({
                userDataPath: "/Users/name/Library/Application Support/Custom",
                localConfigPath: "/root/config.json",
                devtools: true,
                update: false,
                hidden: false,
                positional: [],
            }),
        ).toStrictEqual([
            "--no-update",
            "--config",
            "/root/config.json",
            "--profile-dir",
            "/Users/name/Library/Application Support/Custom",
        ]);
    });

    it("should ignore hidden=true", () => {
        expect(
            getArgsForProtocolRegistration({
                userDataPath: "/Users/name/Library/Application Support/Element",
                devtools: false,
                update: true,
                hidden: true,
                positional: [],
            }),
        ).toStrictEqual([]);
    });

    it("should ignore positional args", () => {
        expect(
            getArgsForProtocolRegistration({
                userDataPath: "/Users/name/Library/Application Support/Element",
                devtools: false,
                update: true,
                hidden: false,
                positional: ["element://foobar"],
            }),
        ).toStrictEqual([]);
    });
});

describe("getArgs", () => {
    function run(...args: string[]): Args {
        vi.spyOn(process, "argv", "get").mockReturnValue(["/path/to/app", ...args]);
        const mockProtocolHandler = {
            getProfileFromDeeplink: vi.fn(),
        } as unknown as ProtocolHandler;
        return getArgs(mockProtocolHandler);
    }

    it("should handle '--help'", () => {
        const args = run("--help");
        expect(args).toEqual({
            userDataPath: "/Users/name/Library/Application Support/Element",
            devtools: false,
            update: true,
            hidden: false,
            positional: ["/path/to/app"],
        });
        expect(app.exit).toHaveBeenCalled();
    });

    it("should handle no command line args", () => {
        const args = run();
        expect(args).toEqual({
            userDataPath: "/Users/name/Library/Application Support/Element",
            devtools: false,
            update: true,
            hidden: false,
            positional: ["/path/to/app"],
        });
        expect(app.exit).not.toHaveBeenCalled();
    });

    it("should handle '--hidden'", () => {
        const args = run("--hidden");
        expect(args).toEqual({
            userDataPath: "/Users/name/Library/Application Support/Element",
            devtools: false,
            update: true,
            hidden: true,
            positional: ["/path/to/app"],
        });
    });

    it("should handle '--no-update'", () => {
        const args = run("--no-update");
        expect(args).toEqual({
            userDataPath: "/Users/name/Library/Application Support/Element",
            devtools: false,
            update: false,
            hidden: false,
            positional: ["/path/to/app"],
        });
    });

    describe("storageMode", () => {
        it("should handle valid '--storage-mode'", () => {
            const args = run("--storage-mode=force-plaintext");
            expect(args).toEqual({
                userDataPath: "/Users/name/Library/Application Support/Element",
                devtools: false,
                update: true,
                hidden: false,
                positional: ["/path/to/app"],
                storageMode: "force-plaintext",
            });
        });

        it("should ignore invalid '--storage-mode'", () => {
            const args = run("--storage-mode=magic");
            expect(args).toEqual({
                userDataPath: "/Users/name/Library/Application Support/Element",
                devtools: false,
                update: true,
                hidden: false,
                positional: ["/path/to/app"],
                storageMode: undefined,
            });
        });
    });

    describe("userDataPath", () => {
        it("should handle deeplinks", () => {
            vi.spyOn(process, "argv", "get").mockReturnValue([
                "/path/to/app",
                "protocol:/#state=foo:element-desktop-ssoid:XXYYZZ&code=bar",
            ]);
            const mockProtocolHandler = {
                getProfileFromDeeplink: vi.fn().mockReturnValue("/path/to/deeplinked-profile"),
            } as unknown as ProtocolHandler;
            const args = getArgs(mockProtocolHandler);

            expect(mockProtocolHandler.getProfileFromDeeplink).toHaveBeenCalledWith(process.argv);
            expect(args).toEqual({
                userDataPath: "/path/to/deeplinked-profile",
                devtools: false,
                update: true,
                hidden: false,
                positional: [...process.argv],
            });
        });

        it("should handle '--profile-dir'", () => {
            const args = run("--profile-dir", "/path/to/profile");
            expect(args).toEqual({
                userDataPath: "/path/to/profile",
                devtools: false,
                update: true,
                hidden: false,
                positional: ["/path/to/app"],
            });
        });

        it("should handle '--profile'", () => {
            const args = run("--profile", "work");
            expect(args).toEqual({
                userDataPath: "/Users/name/Library/Application Support/Element-work",
                devtools: false,
                update: true,
                hidden: false,
                positional: ["/path/to/app"],
            });
        });

        it("should handle ELEMENT_PROFILE_DIR", () => {
            vi.spyOn(process, "env", "get").mockReturnValue({
                ELEMENT_PROFILE_DIR: "/mnt/foo/profile",
            });
            const args = run();
            expect(args).toEqual({
                userDataPath: "/mnt/foo/profile",
                devtools: false,
                update: true,
                hidden: false,
                positional: ["/path/to/app"],
            });
        });

        it("should prefer deeplink over ELEMENT_PROFILE_DIR", () => {
            vi.spyOn(process, "argv", "get").mockReturnValue(["/path/to/app", "protocol:/#state=foo&code=bar"]);
            vi.spyOn(process, "env", "get").mockReturnValue({
                ELEMENT_PROFILE_DIR: "/mnt/foo/profile",
            });
            const mockProtocolHandler = {
                getProfileFromDeeplink: vi.fn().mockReturnValue("/path/to/deeplinked-profile"),
            } as unknown as ProtocolHandler;
            const args = getArgs(mockProtocolHandler);

            expect(mockProtocolHandler.getProfileFromDeeplink).toHaveBeenCalledWith(process.argv);
            expect(args).toEqual({
                userDataPath: "/path/to/deeplinked-profile",
                devtools: false,
                update: true,
                hidden: false,
                positional: [...process.argv],
            });
        });

        it("should combine ELEMENT_PROFILE_DIR with '--profile'", () => {
            vi.spyOn(process, "env", "get").mockReturnValue({
                ELEMENT_PROFILE_DIR: "/mnt/foo/profile",
            });
            const args = run("--profile", "play");
            expect(args).toEqual({
                userDataPath: "/mnt/foo/profile-play",
                devtools: false,
                update: true,
                hidden: false,
                positional: ["/path/to/app"],
            });
        });

        it("should handle old Riot data dirs", () => {
            vol.fromJSON({
                "/Users/name/Library/Application Support/Riot/IndexedDB": "This is a real IDB. I promise.",
            });

            const args = run();
            expect(args).toEqual({
                userDataPath: "/Users/name/Library/Application Support/Riot",
                devtools: false,
                update: true,
                hidden: false,
                positional: ["/path/to/app"],
            });
        });
    });

    describe("localConfigPath", () => {
        it("should handle '--config'", () => {
            const args = run("--config", "/path/to/config.json");
            expect(args).toEqual({
                userDataPath: "/Users/name/Library/Application Support/Element",
                devtools: false,
                update: true,
                hidden: false,
                positional: ["/path/to/app"],
                localConfigPath: "/path/to/config.json",
            });
        });

        it("should handle ELEMENT_DESKTOP_CONFIG_JSON", () => {
            vi.spyOn(process, "env", "get").mockReturnValue({
                ELEMENT_DESKTOP_CONFIG_JSON: "/path/for/config.json",
            });
            const args = run();
            expect(args).toEqual({
                userDataPath: "/Users/name/Library/Application Support/Element",
                devtools: false,
                update: true,
                hidden: false,
                positional: ["/path/to/app"],
                localConfigPath: "/path/for/config.json",
            });
        });

        it("should prefer arg over env", () => {
            vi.spyOn(process, "env", "get").mockReturnValue({
                ELEMENT_DESKTOP_CONFIG_JSON: "/path/for/config.json",
            });
            const args = run("--config", "/path/to/config.json");
            expect(args).toEqual({
                userDataPath: "/Users/name/Library/Application Support/Element",
                devtools: false,
                update: true,
                hidden: false,
                positional: ["/path/to/app"],
                localConfigPath: "/path/to/config.json",
            });
        });
    });
});
