/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { FileBodyViewInfoIcon } from "@element-hq/web-shared-components";

import Modal from "../../../src/Modal";
import { TimelineRenderingType } from "../../../src/contexts/RoomContext";
import { type MediaEventHelper } from "../../../src/utils/MediaEventHelper";
import { FileBodyViewModel } from "../../../src/viewmodels/message-body/FileBodyViewModel";
import ErrorDialog from "../../../src/components/views/dialogs/ErrorDialog";

const mockDownload = jest.fn();

jest.mock("../../../src/utils/FileDownloader", () => ({
    FileDownloader: jest.fn().mockImplementation(() => ({
        download: mockDownload,
    })),
}));

jest.mock("../../../src/customisations/Media", () => ({
    mediaFromContent: jest.fn((content: { file?: unknown; url?: string }) => ({
        isEncrypted: !!content.file,
        srcHttp: content.url ?? null,
    })),
}));

describe("FileBodyViewModel", () => {
    const mkMediaEvent = (
        content: Partial<{ body: string; msgtype: string; url: string; file: Record<string, unknown> }>,
    ): MatrixEvent =>
        new MatrixEvent({
            room_id: "!room:server",
            sender: "@user:server",
            type: EventType.RoomMessage,
            content: {
                body: "alt",
                msgtype: "m.file",
                url: "https://server/file",
                ...content,
            },
        });

    const mkMediaEventHelper = ({
        encrypted,
        blob = new Blob(["content"], { type: "text/plain" }),
        fileName = "file.txt",
    }: {
        encrypted: boolean;
        blob?: Blob;
        fileName?: string;
    }): MediaEventHelper =>
        ({
            media: { isEncrypted: encrypted },
            sourceBlob: { value: Promise.resolve(blob) },
            fileName,
        }) as unknown as MediaEventHelper;

    const createVm = (
        overrides: Partial<ConstructorParameters<typeof FileBodyViewModel>[0]> = {},
    ): FileBodyViewModel =>
        new FileBodyViewModel({
            mxEvent: mkMediaEvent({}),
            mediaEventHelper: mkMediaEventHelper({ encrypted: false }),
            showFileInfo: false,
            forExport: false,
            timelineRenderingType: TimelineRenderingType.File,
            ...overrides,
        });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("shows unencrypted download snapshot in file rendering type", () => {
        const vm = createVm();

        expect(vm.refIFrame).toBeDefined();
        expect(vm.refLink).toBeDefined();
        expect(vm.getSnapshot()).toMatchObject({
            rendering: "DOWNLOAD_UNENCRYPTED",
            href: "https://server/file",
        });
    });

    it.each([
        { msgtype: "m.file", expectedIcon: FileBodyViewInfoIcon.ATTACHMENT },
        { msgtype: "m.audio", expectedIcon: FileBodyViewInfoIcon.AUDIO },
        { msgtype: "m.video", expectedIcon: FileBodyViewInfoIcon.VIDEO },
    ])("shows generic placeholder info for $msgtype", ({ msgtype, expectedIcon }) => {
        const vm = createVm({
            mxEvent: mkMediaEvent({ msgtype }),
            showFileInfo: true,
        });

        expect(vm.getSnapshot()).toMatchObject({
            rendering: "INFO",
            label: "alt",
            icon: expectedIcon,
        });
    });

    it("shows export snapshot with export href", () => {
        const vm = createVm({
            forExport: true,
            showFileInfo: true,
            mxEvent: mkMediaEvent({ url: "https://server/export-file" }),
        });

        expect(vm.getSnapshot()).toMatchObject({
            rendering: "EXPORT",
            label: "alt",
            href: "https://server/export-file",
        });
    });

    it("downloads unencrypted placeholder content on info click", async () => {
        const blob = new Blob(["placeholder"], { type: "text/plain" });
        const vm = createVm({
            showFileInfo: true,
            mediaEventHelper: mkMediaEventHelper({ encrypted: false, blob, fileName: "placeholder.txt" }),
        });

        await vm.onInfoClick();

        expect(mockDownload).toHaveBeenCalledWith({
            blob,
            name: "placeholder.txt",
        });
    });

    it("decrypts encrypted content and downloads on iframe load", async () => {
        const blob = new Blob(["encrypted"], { type: "application/octet-stream" });
        const vm = createVm({
            mediaEventHelper: mkMediaEventHelper({ encrypted: true, blob, fileName: "encrypted.bin" }),
            mxEvent: mkMediaEvent({ file: { url: "mxc://server/file" } }),
        });

        await vm.onDownloadClick();

        expect(vm.getSnapshot().rendering).toBe("DOWNLOAD_ENCRYPTED_IFRAME");

        vm.onDownloadIframeLoad();

        expect(mockDownload).toHaveBeenCalledWith(
            expect.objectContaining({
                blob,
                name: "encrypted.bin",
                autoDownload: true,
                opts: expect.objectContaining({
                    textContent: expect.any(String),
                }),
            }),
        );
    });

    it("downloads unencrypted source as blob in onDownloadLinkClick", async () => {
        const blob = new Blob(["direct-download"], { type: "text/plain" });
        const vm = createVm({
            mediaEventHelper: mkMediaEventHelper({ encrypted: false, blob, fileName: "direct.txt" }),
            mxEvent: mkMediaEvent({ msgtype: "m.file", url: "https://server/direct.txt" }),
        });

        const click = jest.spyOn(HTMLAnchorElement.prototype, "click");
        const event = {
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
        } as any;

        vm.onDownloadLinkClick(event);
        await Promise.resolve();

        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();
        expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
        expect(click).toHaveBeenCalled();
    });

    it("shows decrypt error dialog when decrypt fails", async () => {
        const vm = createVm({
            mediaEventHelper: {
                media: { isEncrypted: true },
                sourceBlob: { value: Promise.reject(new Error("decrypt failed")) },
                fileName: "broken.bin",
            } as unknown as MediaEventHelper,
            mxEvent: mkMediaEvent({ file: { url: "mxc://server/file" } }),
        });
        const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {});
        const dialogSpy = jest.spyOn(Modal, "createDialog").mockReturnValue({ close: jest.fn() } as any);

        await vm.onDownloadClick();

        expect(warnSpy).toHaveBeenCalled();
        expect(dialogSpy).toHaveBeenCalledWith(
            ErrorDialog,
            expect.objectContaining({
                title: "Error",
                description: expect.stringMatching(/decrypt/i),
            }),
        );
        expect(vm.getSnapshot().rendering).toBe("DOWNLOAD_ENCRYPTED_PENDING");
    });

    it("resets decrypted state when mxEvent changes", async () => {
        const vm = createVm({
            mediaEventHelper: mkMediaEventHelper({ encrypted: true }),
            mxEvent: mkMediaEvent({ file: { url: "mxc://server/file-a" } }),
        });

        await vm.onDownloadClick();
        expect(vm.getSnapshot().rendering).toBe("DOWNLOAD_ENCRYPTED_IFRAME");

        vm.setProps({
            mxEvent: mkMediaEvent({ body: "new", file: { url: "mxc://server/file-b" } }),
        });

        expect(vm.getSnapshot()).toMatchObject({
            rendering: "DOWNLOAD_ENCRYPTED_PENDING",
        });
    });
});
