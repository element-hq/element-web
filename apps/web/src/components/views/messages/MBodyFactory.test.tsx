/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React, { type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach, type MockInstance } from "vitest";
import { render, type RenderResult, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { EventType, getHttpUriForMxc, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { LinkedTextContext } from "@element-hq/web-shared-components";

import {
    getMockClientWithEventEmitter,
    mockClientMethodsCrypto,
    mockClientMethodsDevice,
    mockClientMethodsServer,
    mockClientMethodsUser,
} from "test-utils";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import SettingsStore from "../../../settings/SettingsStore";
import {
    DecryptionFailureBodyFactory,
    FileBodyFactory,
    ImageBodyFactory,
    RedactedBodyFactory,
    VideoBodyFactory,
    renderMBody,
} from "./MBodyFactory";
import { TimelineRenderingType } from "../../../contexts/RoomContext.ts";
import { ScopedRoomContextProvider } from "../../../contexts/ScopedRoomContext.tsx";
import { useMediaVisible } from "../../../hooks/useMediaVisible";
import { FileDownloader } from "../../../utils/FileDownloader";

vi.mock("matrix-encrypt-attachment", () => ({
    default: {
        decryptAttachment: vi.fn(),
    },
}));

vi.mock("../../../hooks/useMediaVisible", () => ({
    __esModule: true,
    useMediaVisible: vi.fn(),
}));

describe("MBodyFactory", () => {
    const userId = "@user:server";
    const deviceId = "DEADB33F";
    const cli = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsServer(),
        ...mockClientMethodsDevice(deviceId),
        ...mockClientMethodsCrypto(),
        getRooms: vi.fn().mockReturnValue([]),
        getRoom: vi.fn(),
        getIgnoredUsers: vi.fn(),
        getVersions: vi.fn().mockResolvedValue({
            unstable_features: {
                "org.matrix.msc3882": true,
                "org.matrix.msc3886": true,
            },
        }),
    });
    // eslint-disable-next-line no-restricted-properties
    cli.mxcUrlToHttp.mockImplementation(
        (mxcUrl: string, width?: number, height?: number, resizeMethod?: string, allowDirectLinks?: boolean) => {
            return getHttpUriForMxc("https://server", mxcUrl, width, height, resizeMethod, allowDirectLinks);
        },
    );

    const props = {
        onMessageAllowed: vi.fn(),
        permalinkCreator: new RoomPermalinkCreator(new Room("!room:server", cli, cli.getUserId()!)),
    };
    const mkEvent = (msgtype?: string, content: Record<string, unknown> = {}): MatrixEvent =>
        new MatrixEvent({
            room_id: "!room:server",
            sender: userId,
            type: EventType.RoomMessage,
            content: {
                body: "alt",
                ...(msgtype ? { msgtype } : {}),
                url: "mxc://server/file",
                ...content,
            },
        });

    let mockDownload: MockInstance<FileDownloader["download"]>;

    beforeEach(() => {
        vi.spyOn(SettingsStore, "getValue").mockRestore();
        vi.mocked(useMediaVisible).mockReturnValue([true, vi.fn()]);
        mockDownload = vi.spyOn(FileDownloader.prototype, "download").mockResolvedValue(undefined);
    });

    const encryptedImageHelper = (): MediaEventHelper =>
        ({
            media: { isEncrypted: true },
            sourceUrl: { value: Promise.resolve("blob:source") },
            thumbnailUrl: { value: Promise.resolve("blob:thumbnail") },
            sourceBlob: {
                value: Promise.resolve(new Blob(["image"], { type: "image/jpeg" })),
                cachedValue: new Blob(["image"], { type: "image/jpeg" }),
            },
        }) as unknown as MediaEventHelper;

    /**
     * Render a media body inside the contexts it needs: the room context, whose rendering type
     * decides which body is picked, and the linked text context the preview tile reads.
     */
    const renderInRoomContext = (node: ReactNode, timelineRenderingType: TimelineRenderingType): RenderResult =>
        // Wrapped in a fragment because `renderMBody` can return null, which `render` itself rejects.
        render(<>{node}</>, {
            wrapper: ({ children }) => (
                <LinkedTextContext.Provider value={{}}>
                    <ScopedRoomContextProvider {...({ timelineRenderingType } as any)}>
                        {children}
                    </ScopedRoomContextProvider>
                </LinkedTextContext.Provider>
            ),
        });

    describe("renderMBody", () => {
        it("renders download button for m.file in file rendering type", () => {
            const mediaEvent = mkEvent("m.file");

            const { container, getByRole } = renderInRoomContext(
                renderMBody({
                    ...props,
                    mxEvent: mediaEvent,
                    mediaEventHelper: new MediaEventHelper(mediaEvent),
                    showFileInfo: false,
                }),
                TimelineRenderingType.File,
            );

            expect(getByRole("link", { name: "Download" })).toBeInTheDocument();
            expect(container).toMatchSnapshot();
        });

        it.each(["m.audio", "m.text"])("returns null for unsupported msgtype %s", (msgtype) => {
            expect(renderMBody({ ...props, mxEvent: mkEvent(msgtype) })).toBeNull();
        });

        it("returns the video body factory for m.video", () => {
            expect(renderMBody({ ...props, mxEvent: mkEvent("m.video") })?.type).toBe(VideoBodyFactory);
        });

        it("returns the image body factory for m.image", () => {
            expect(renderMBody({ ...props, mxEvent: mkEvent("m.image") })?.type).toBe(ImageBodyFactory);
        });

        it("returns null when msgtype is missing", () => {
            expect(renderMBody({ ...props, mxEvent: mkEvent() })).toBeNull();
        });

        it("falls back to file body for unsupported msgtypes", () => {
            const mediaEvent = mkEvent("m.audio");
            const { getByRole } = renderInRoomContext(
                renderMBody(
                    {
                        ...props,
                        mxEvent: mediaEvent,
                        mediaEventHelper: new MediaEventHelper(mediaEvent),
                    },
                    FileBodyFactory,
                ),
                TimelineRenderingType.File,
            );
            expect(getByRole("button", { name: "alt" })).toBeInTheDocument();
        });
    });

    it("renderMBody fallback shows m.audio generic placeholder when showFileInfo is true", async () => {
        const mediaEvent = new MatrixEvent({
            room_id: "!room:server",
            sender: userId,
            type: EventType.RoomMessage,
            content: {
                body: "alt",
                msgtype: "m.audio",
                url: "mxc://server/image",
            },
        });

        const { container, getByRole, getByText } = renderInRoomContext(
            renderMBody(
                {
                    ...props,
                    mxEvent: mediaEvent,
                    mediaEventHelper: new MediaEventHelper(mediaEvent),
                    showFileInfo: true,
                },
                FileBodyFactory,
            ),
            TimelineRenderingType.File,
        );

        expect(getByText("alt")).toBeInTheDocument();
        // Only m.file gets the preview tile; everything else keeps the legacy file body,
        // where the filename itself is the button. See FileBodyFactory.
        expect(getByRole("button", { name: "alt" })).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it.each([TimelineRenderingType.Room, TimelineRenderingType.File])(
        "renderMBody shows the preview tile for m.file in %s",
        async (timelineRenderingType) => {
            const mediaEvent = new MatrixEvent({
                room_id: "!room:server",
                sender: userId,
                type: EventType.RoomMessage,
                content: {
                    body: "alt",
                    msgtype: "m.file",
                    url: "mxc://server/image",
                },
            });

            const { container, getByRole, getByText } = renderInRoomContext(
                renderMBody(
                    {
                        ...props,
                        mxEvent: mediaEvent,
                        mediaEventHelper: new MediaEventHelper(mediaEvent),
                        showFileInfo: true,
                    },
                    FileBodyFactory,
                ),
                timelineRenderingType,
            );

            // The preview tile leaves the filename as plain text and gives the download its own button.
            expect(getByText("alt")).toBeInTheDocument();
            expect(getByRole("button", { name: "Download" })).toBeInTheDocument();
            expect(container).toMatchSnapshot();
        },
    );

    describe("PreviewFileBody", () => {
        // A real MediaEventHelper never yields an empty file name, so stub it to exercise the
        // preview tile's own fallbacks.
        const mkFileHelper = (fileName: string, blob: Blob): MediaEventHelper =>
            ({
                fileName,
                media: { isEncrypted: false },
                sourceBlob: { value: Promise.resolve(blob) },
            }) as unknown as MediaEventHelper;

        const renderPreview = (mediaEvent: MatrixEvent, mediaEventHelper: MediaEventHelper) =>
            renderInRoomContext(
                <FileBodyFactory mxEvent={mediaEvent} mediaEventHelper={mediaEventHelper} showFileInfo={true} />,
                TimelineRenderingType.Room,
            );

        it("shows the file size as the tile body when the event declares one", () => {
            const mediaEvent = mkEvent("m.file", { info: { size: 2048, mimetype: "application/pdf" } });

            const { getByText } = renderPreview(mediaEvent, mkFileHelper("report.pdf", new Blob(["pdf"])));

            expect(getByText("report.pdf")).toBeInTheDocument();
            expect(getByText("2 KB")).toBeInTheDocument();
        });

        it("shows a placeholder as the tile body when the event declares no size", () => {
            const mediaEvent = mkEvent("m.file");

            const { getByText } = renderPreview(mediaEvent, mkFileHelper("report.pdf", new Blob(["pdf"])));

            expect(getByText("Size unknown")).toBeInTheDocument();
        });

        it("downloads the source blob under the file name when the download button is clicked", async () => {
            const blob = new Blob(["pdf"], { type: "application/pdf" });
            const mediaEvent = mkEvent("m.file");

            const { getByRole } = renderPreview(mediaEvent, mkFileHelper("report.pdf", blob));
            await userEvent.click(getByRole("button", { name: "Download" }));

            await waitFor(() => expect(mockDownload).toHaveBeenCalledWith({ blob, name: "report.pdf" }));
        });

        it("downloads under a generic name when the file has none", async () => {
            const mediaEvent = mkEvent("m.file");

            const { getByRole } = renderPreview(mediaEvent, mkFileHelper("", new Blob(["pdf"])));
            await userEvent.click(getByRole("button", { name: "Download" }));

            await waitFor(() =>
                expect(mockDownload).toHaveBeenCalledWith(expect.objectContaining({ name: "Attachment" })),
            );
        });
    });

    describe("ImageBodyFactory", () => {
        const imageContent = {
            info: {
                mimetype: "image/jpeg",
                w: 320,
                h: 240,
                size: 48_000,
            },
        };

        it("renders the shared image view in room timelines", () => {
            const mediaEvent = mkEvent("m.image", imageContent);

            const { container } = renderInRoomContext(
                <ImageBodyFactory
                    {...props}
                    mxEvent={mediaEvent}
                    mediaEventHelper={new MediaEventHelper(mediaEvent)}
                />,
                TimelineRenderingType.Room,
            );

            expect(container.querySelector(".mx_ImageBody")).not.toBeNull();
            expect(container.querySelector(".mx_MFileBody")).toBeNull();
        });

        it("renders the file fallback child in notification timelines", () => {
            const mediaEvent = mkEvent("m.image", imageContent);

            const { container, getByRole } = renderInRoomContext(
                <ImageBodyFactory
                    {...props}
                    mxEvent={mediaEvent}
                    mediaEventHelper={new MediaEventHelper(mediaEvent)}
                />,
                TimelineRenderingType.Notification,
            );

            expect(container.querySelector(".mx_ImageBody")).not.toBeNull();
            expect(container.querySelector(".mx_MFileBody")).not.toBeNull();
            expect(getByRole("link", { name: /Download/ })).toBeInTheDocument();
        });

        it("renders only a file body for encrypted unsafe images without thumbnails", () => {
            const mediaEvent = mkEvent("m.image", {
                file: { url: "mxc://server/encrypted-file" },
                url: undefined,
                info: {
                    mimetype: "text/html",
                },
            });

            const { container, getByRole } = renderInRoomContext(
                <ImageBodyFactory
                    {...props}
                    mxEvent={mediaEvent}
                    mediaEventHelper={{ media: { isEncrypted: true } } as MediaEventHelper}
                />,
                TimelineRenderingType.Room,
            );

            expect(container.querySelector(".mx_ImageBody")).toBeNull();
            expect(container.querySelector(".mx_MFileBody")).not.toBeNull();
            expect(getByRole("button", { name: "alt" })).toBeInTheDocument();
        });

        it("keeps the image body for encrypted unsafe images when a thumbnail is available", () => {
            const mediaEvent = mkEvent("m.image", {
                file: { url: "mxc://server/encrypted-file" },
                url: undefined,
                info: {
                    mimetype: "text/html",
                    thumbnail_info: { mimetype: "image/jpeg" },
                },
            });

            const { container } = renderInRoomContext(
                <ImageBodyFactory {...props} mxEvent={mediaEvent} mediaEventHelper={encryptedImageHelper()} />,
                TimelineRenderingType.Room,
            );

            expect(container.querySelector(".mx_ImageBody")).not.toBeNull();
            expect(container.querySelector(".mx_MFileBody")).toBeNull();
        });
    });

    describe("VideoBodyFactory", () => {
        const videoContent = {
            info: {
                mimetype: "video/mp4",
                w: 320,
                h: 240,
                size: 48_000,
            },
        };

        it("renders without a file fallback in room timelines", () => {
            const mediaEvent = mkEvent("m.video", videoContent);

            const { container } = renderInRoomContext(
                <VideoBodyFactory
                    mxEvent={mediaEvent}
                    mediaEventHelper={new MediaEventHelper(mediaEvent)}
                    forExport={false}
                />,
                TimelineRenderingType.Room,
            );

            expect(container.querySelector(".mx_MVideoBody")).not.toBeNull();
            expect(container.querySelector(".mx_MFileBody")).toBeNull();
        });

        it("renders the file fallback child outside room timelines", () => {
            const mediaEvent = mkEvent("m.video", videoContent);

            const { container, getByRole } = renderInRoomContext(
                <VideoBodyFactory
                    mxEvent={mediaEvent}
                    mediaEventHelper={new MediaEventHelper(mediaEvent)}
                    forExport={false}
                />,
                TimelineRenderingType.Notification,
            );

            expect(container.querySelector(".mx_MVideoBody")).not.toBeNull();
            expect(container.querySelector(".mx_MFileBody")).not.toBeNull();
            expect(getByRole("link", { name: /Download/ })).toBeInTheDocument();
        });
    });

    it("renders the redacted body wrapper", () => {
        const mediaEvent = mkEvent("m.text");

        const { container } = render(<RedactedBodyFactory mxEvent={mediaEvent} />);

        expect(container.querySelector(".mx_RedactedBody")).not.toBeNull();
    });

    it("renders the decryption failure body wrapper", () => {
        const mediaEvent = mkEvent("m.text");
        Object.defineProperty(mediaEvent, "decryptionFailureReason", {
            configurable: true,
            value: "MEGOLM_UNKNOWN_INBOUND_SESSION_ID",
        });

        const { container } = render(<DecryptionFailureBodyFactory mxEvent={mediaEvent} />);

        expect(container.querySelector(".mx_DecryptionFailureBody")).not.toBeNull();
    });
});
