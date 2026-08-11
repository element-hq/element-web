/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { dialog, shell, type WebContents } from "electron";

// The `userDownloadAction` listener is registered at import time, so capture the callbacks that
// `ipcMain.on` receives in order to invoke the handler under test directly.
const { ipcHandlers } = vi.hoisted(() => ({
    ipcHandlers: {} as Record<string, (...args: unknown[]) => unknown>,
}));

vi.mock("electron", () => ({
    clipboard: {},
    Menu: class {},
    MenuItem: class {},
    shell: { openExternal: vi.fn(), openPath: vi.fn() },
    dialog: { showMessageBox: vi.fn(), showSaveDialog: vi.fn() },
    ipcMain: {
        on: vi.fn((channel: string, cb: (...args: unknown[]) => unknown) => {
            ipcHandlers[channel] = cb;
        }),
    },
}));
vi.mock("./language-helper.js", () => ({ _t: (key: string): string => key }));
vi.mock("./config.js", () => ({ getConfig: (): Record<string, never> => ({}) }));
vi.mock("./save-image.js", () => ({ saveImageToFile: vi.fn() }));

const registerWebContentsHandlers = (await import("./webcontents-handler.js")).default;

interface MockWebContents {
    setWindowOpenHandler: Mock;
    on: Mock;
    send: Mock;
    session: { on: Mock };
    sessionHandlers: Record<string, (...args: unknown[]) => void>;
}

function makeWebContents(): MockWebContents {
    const sessionHandlers: Record<string, (...args: unknown[]) => void> = {};
    return {
        setWindowOpenHandler: vi.fn(),
        on: vi.fn(),
        send: vi.fn(),
        session: {
            on: vi.fn((ev: string, cb: (...args: unknown[]) => void): void => {
                sessionHandlers[ev] = cb;
            }),
        },
        sessionHandlers,
    };
}

/**
 * Drives the real will-download → done("completed") flow so the download is registered the way it is
 * in production, and returns the id the handler assigned to it.
 */
function completeDownload(wc: MockWebContents, savePath: string): number {
    const doneHandlers: Record<string, (...args: unknown[]) => void> = {};
    const item = {
        once: (ev: string, cb: (...args: unknown[]) => void): void => {
            doneHandlers[ev] = cb;
        },
        getSavePath: (): string => savePath,
    };
    wc.sessionHandlers["will-download"]({}, item);
    doneHandlers["done"]({}, "completed");
    const completed = wc.send.mock.calls.find((c) => c[0] === "userDownloadCompleted");
    return (completed![1] as { id: number }).id;
}

describe("userDownloadAction handler", () => {
    let wc: MockWebContents;

    beforeEach(() => {
        vi.clearAllMocks();
        wc = makeWebContents();
        registerWebContentsHandlers(wc as unknown as WebContents);
    });

    it("opens the file when the user clicks Open on a known download", async () => {
        vi.mocked(shell.openPath).mockResolvedValue("");
        const id = completeDownload(wc, "/tmp/file.pdf");

        await ipcHandlers["userDownloadAction"]({}, { id, open: true });

        expect(shell.openPath).toHaveBeenCalledWith("/tmp/file.pdf");
        expect(dialog.showMessageBox).not.toHaveBeenCalled();
    });

    it("shows the underlying error when the open fails, rather than failing silently", async () => {
        vi.mocked(shell.openPath).mockResolvedValue("LSOpenURLsWithRole failed");
        const id = completeDownload(wc, "/tmp/file.pdf");

        await ipcHandlers["userDownloadAction"]({}, { id, open: true });

        expect(shell.openPath).toHaveBeenCalledWith("/tmp/file.pdf");
        expect(dialog.showMessageBox).toHaveBeenCalledWith(
            expect.objectContaining({ type: "error", detail: "LSOpenURLsWithRole failed" }),
        );
    });

    it("does not open anything on a plain dismiss", async () => {
        const id = completeDownload(wc, "/tmp/file.pdf");

        await ipcHandlers["userDownloadAction"]({}, { id, open: false });

        expect(shell.openPath).not.toHaveBeenCalled();
    });

    it("removes the entry so a repeated open is a no-op", async () => {
        vi.mocked(shell.openPath).mockResolvedValue("");
        const id = completeDownload(wc, "/tmp/file.pdf");

        await ipcHandlers["userDownloadAction"]({}, { id, open: true });
        vi.mocked(shell.openPath).mockClear();
        await ipcHandlers["userDownloadAction"]({}, { id, open: true });

        expect(shell.openPath).not.toHaveBeenCalled();
    });
});
