/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { dialog, shell, type WebContents } from "electron";

// The `userDownloadAction` listener is registered at import time, so capture the callbacks that
// `ipcMain.on` receives in order to invoke the handler under test directly.
const { ipcHandlers, menus } = vi.hoisted(() => ({
    ipcHandlers: {} as Record<string, (...args: unknown[]) => unknown>,
    // Every context menu the handler builds, in construction order, so a test can click an entry.
    menus: [] as MenuStub[],
}));

interface MenuItemStub {
    label: string;
    click?: () => void | Promise<void>;
}

interface MenuStub {
    items: MenuItemStub[];
}

vi.mock("electron", () => ({
    clipboard: { writeText: vi.fn() },
    Menu: class {
        public readonly items: MenuItemStub[] = [];
        public constructor() {
            menus.push(this);
        }
        public append(item: MenuItemStub): void {
            this.items.push(item);
        }
        public popup(): void {}
    },
    MenuItem: class {
        public readonly label: string;
        public readonly click?: () => void | Promise<void>;
        public constructor(options: MenuItemStub) {
            this.label = options.label;
            this.click = options.click;
        }
    },
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
    copyImageAt: Mock;
    session: { on: Mock };
    handlers: Record<string, (...args: unknown[]) => void>;
    sessionHandlers: Record<string, (...args: unknown[]) => void>;
}

function makeWebContents(): MockWebContents {
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    const sessionHandlers: Record<string, (...args: unknown[]) => void> = {};
    return {
        setWindowOpenHandler: vi.fn(),
        on: vi.fn((ev: string, cb: (...args: unknown[]) => void): void => {
            handlers[ev] = cb;
        }),
        send: vi.fn(),
        copyImageAt: vi.fn(),
        session: {
            on: vi.fn((ev: string, cb: (...args: unknown[]) => void): void => {
                sessionHandlers[ev] = cb;
            }),
        },
        handlers,
        sessionHandlers,
    };
}

interface MockDownloadItem {
    once: (ev: string, cb: (...args: unknown[]) => void) => void;
    getFilename: () => string;
    getSavePath: () => string;
    setSaveDialogOptions: Mock;
    doneHandlers: Record<string, (...args: unknown[]) => void>;
}

function makeDownloadItem(savePath: string): MockDownloadItem {
    const doneHandlers: Record<string, (...args: unknown[]) => void> = {};
    return {
        once: (ev: string, cb: (...args: unknown[]) => void): void => {
            doneHandlers[ev] = cb;
        },
        getFilename: (): string => savePath.split("/").pop()!,
        getSavePath: (): string => savePath,
        setSaveDialogOptions: vi.fn(),
        doneHandlers,
    };
}

/**
 * Drives the real will-download → done("completed") flow so the download is registered the way it is
 * in production, and returns the id the handler assigned to it.
 */
function completeDownload(wc: MockWebContents, savePath: string): number {
    const item = makeDownloadItem(savePath);
    wc.sessionHandlers["will-download"]({}, item);
    item.doneHandlers["done"]({}, "completed");
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

describe("save dialog filters", () => {
    let wc: MockWebContents;

    beforeEach(() => {
        vi.clearAllMocks();
        menus.length = 0;
        wc = makeWebContents();
        registerWebContentsHandlers(wc as unknown as WebContents);
    });

    it("names a download's own file type, so renaming it does not strip the extension", () => {
        const item = makeDownloadItem("/tmp/photo.jpg");

        wc.sessionHandlers["will-download"]({}, item);

        expect(item.setSaveDialogOptions).toHaveBeenCalledWith({
            filters: [expect.objectContaining({ extensions: ["jpg"] }), expect.objectContaining({ extensions: ["*"] })],
        });
    });

    it("leaves the dialog alone for a download which has no extension to preserve", () => {
        const item = makeDownloadItem("/tmp/archive");

        wc.sessionHandlers["will-download"]({}, item);

        expect(item.setSaveDialogOptions).not.toHaveBeenCalled();
    });

    it("names the file type when saving an image from the context menu too", async () => {
        vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: "/tmp/renamed.jpg" });

        wc.handlers["context-menu"](
            { preventDefault: vi.fn() },
            { srcURL: "https://example.org/photo.jpg", hasImageContents: true, suggestedFilename: "photo.jpg" },
        );
        const saveAs = menus[0].items.find((item) => item.label === "right_click_menu|save_image_as");
        await saveAs!.click!();

        expect(dialog.showSaveDialog).toHaveBeenCalledWith(
            expect.objectContaining({
                defaultPath: "photo.jpg",
                filters: [
                    expect.objectContaining({ extensions: ["jpg"] }),
                    expect.objectContaining({ extensions: ["*"] }),
                ],
            }),
        );
    });
});
