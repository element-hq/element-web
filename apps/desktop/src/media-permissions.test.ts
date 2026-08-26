/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeEach, afterEach, vi } from "vitest";
import { session, systemPreferences } from "electron";

import { setupMediaPermissions } from "./media-permissions.js";

vi.mock("electron", () => ({
    session: {
        defaultSession: {
            setPermissionRequestHandler: vi.fn(),
            setPermissionCheckHandler: vi.fn(),
        },
    },
    systemPreferences: {
        askForMediaAccess: vi.fn(() => Promise.resolve(true)),
        getMediaAccessStatus: vi.fn(() => "not-determined"),
    },
}));

// Loosely-typed shapes for invoking the captured Electron handlers in tests.
type RequestHandler = (
    webContents: unknown,
    permission: string,
    callback: (granted: boolean) => void,
    details: { mediaTypes?: Array<"audio" | "video">; isMainFrame?: boolean; securityOrigin?: string },
) => void | Promise<void>;
type CheckHandler = (webContents: unknown, permission: string, requestingOrigin: string, details: object) => boolean;

const setPermissionRequestHandler = vi.mocked(session.defaultSession.setPermissionRequestHandler);
const setPermissionCheckHandler = vi.mocked(session.defaultSession.setPermissionCheckHandler);
const askForMediaAccess = vi.mocked(systemPreferences.askForMediaAccess);
const getMediaAccessStatus = vi.mocked(systemPreferences.getMediaAccessStatus);

const originalPlatform = process.platform;
function setPlatform(platform: NodeJS.Platform): void {
    Object.defineProperty(process, "platform", { value: platform, configurable: true });
}

function getRequestHandler(): RequestHandler {
    return setPermissionRequestHandler.mock.calls[0][0] as unknown as RequestHandler;
}
function getCheckHandler(): CheckHandler {
    return setPermissionCheckHandler.mock.calls[0][0] as unknown as CheckHandler;
}

describe("setupMediaPermissions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getMediaAccessStatus.mockReturnValue("not-determined");
        askForMediaAccess.mockResolvedValue(true);
        setPlatform("darwin");
    });

    afterEach(() => {
        setPlatform(originalPlatform);
    });

    it("registers a request and a check handler on the default session", () => {
        setupMediaPermissions();

        expect(setPermissionRequestHandler).toHaveBeenCalledTimes(1);
        expect(setPermissionCheckHandler).toHaveBeenCalledTimes(1);
    });

    describe("the permission request handler", () => {
        it("triggers the macOS prompt for the microphone when audio is requested and undecided", async () => {
            setupMediaPermissions();
            const callback = vi.fn();

            await getRequestHandler()({}, "media", callback, { mediaTypes: ["audio"] });

            expect(getMediaAccessStatus).toHaveBeenCalledWith("microphone");
            expect(askForMediaAccess).toHaveBeenCalledWith("microphone");
            expect(askForMediaAccess).not.toHaveBeenCalledWith("camera");
            expect(callback).toHaveBeenCalledWith(true);
        });

        it("triggers the macOS prompt for the camera when video is requested and undecided", async () => {
            setupMediaPermissions();
            const callback = vi.fn();

            await getRequestHandler()({}, "media", callback, { mediaTypes: ["video"] });

            expect(askForMediaAccess).toHaveBeenCalledWith("camera");
            expect(askForMediaAccess).not.toHaveBeenCalledWith("microphone");
            expect(callback).toHaveBeenCalledWith(true);
        });

        it("prompts for both microphone and camera on an audio+video call", async () => {
            setupMediaPermissions();
            const callback = vi.fn();

            await getRequestHandler()({}, "media", callback, { mediaTypes: ["audio", "video"] });

            expect(askForMediaAccess).toHaveBeenCalledWith("microphone");
            expect(askForMediaAccess).toHaveBeenCalledWith("camera");
            expect(callback).toHaveBeenCalledWith(true);
        });

        it("does not re-prompt when access has already been granted", async () => {
            getMediaAccessStatus.mockReturnValue("granted");
            setupMediaPermissions();
            const callback = vi.fn();

            await getRequestHandler()({}, "media", callback, { mediaTypes: ["audio", "video"] });

            expect(askForMediaAccess).not.toHaveBeenCalled();
            expect(callback).toHaveBeenCalledWith(true);
        });

        it("does not call askForMediaAccess off macOS but still grants media", async () => {
            setPlatform("win32");
            setupMediaPermissions();
            const callback = vi.fn();

            await getRequestHandler()({}, "media", callback, { mediaTypes: ["audio", "video"] });

            expect(askForMediaAccess).not.toHaveBeenCalled();
            expect(getMediaAccessStatus).not.toHaveBeenCalled();
            expect(callback).toHaveBeenCalledWith(true);
        });

        it("grants non-media permissions without touching the OS (fail-open baseline)", async () => {
            setupMediaPermissions();
            const callback = vi.fn();

            await getRequestHandler()({}, "notifications", callback, {});

            expect(askForMediaAccess).not.toHaveBeenCalled();
            expect(callback).toHaveBeenCalledWith(true);
        });

        it("grants media from a remote-origin widget subframe (no origin gating, so Jitsi keeps working)", async () => {
            setupMediaPermissions();
            const callback = vi.fn();

            await getRequestHandler()({}, "media", callback, {
                mediaTypes: ["audio", "video"],
                isMainFrame: false,
                securityOrigin: "https://meet.element.io/",
            });

            expect(callback).toHaveBeenCalledWith(true);
        });

        it("still grants (never hangs) when the OS access request rejects", async () => {
            askForMediaAccess.mockRejectedValue(new Error("TCC unavailable"));
            setupMediaPermissions();
            const callback = vi.fn();

            // Must not reject and must always resolve the request via the callback, otherwise
            // getUserMedia would hang forever with no grant or denial.
            await getRequestHandler()({}, "media", callback, { mediaTypes: ["audio"] });

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(true);
        });

        it("grants media when no mediaTypes are supplied without prompting", async () => {
            setupMediaPermissions();
            const callback = vi.fn();

            await getRequestHandler()({}, "media", callback, {});

            expect(askForMediaAccess).not.toHaveBeenCalled();
            expect(callback).toHaveBeenCalledWith(true);
        });
    });

    describe("the permission check handler", () => {
        it("returns true even when webContents is null (cross-origin widget subframe)", () => {
            setupMediaPermissions();

            const result = getCheckHandler()(null, "media", "https://meet.element.io/", {});

            expect(result).toBe(true);
        });
    });
});
