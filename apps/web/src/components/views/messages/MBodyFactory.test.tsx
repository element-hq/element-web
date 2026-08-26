/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render } from "test-utils-rtl";
import { EventType, getHttpUriForMxc, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

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
import Modal from "../../../Modal";
import MediaPreviewDialog from "../elements/MediaPreview/MediaPreviewDialog";

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

    beforeEach(() => {
        vi.spyOn(SettingsStore, "getValue").mockRestore();
        vi.mocked(useMediaVisible).mockReturnValue([true, vi.fn()]);
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

    describe("renderMBody", () => {
        it("renders download button for m.file in file rendering type", () => {
            const mediaEvent = mkEvent("m.file");

            const { container, getByRole } = render(
                <ScopedRoomContextProvider {...({ timelineRenderingType: TimelineRenderingType.File } as any)}>
                    {renderMBody({
                        ...props,
                        mxEvent: mediaEvent,
                        mediaEventHelper: new MediaEventHelper(mediaEvent),
                        showFileInfo: false,
                    })}
                </ScopedRoomContextProvider>,
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
            const { getByRole } = render(
                <ScopedRoomContextProvider {...({ timelineRenderingType: TimelineRenderingType.File } as any)}>
                    {renderMBody(
                        {
                            ...props,
                            mxEvent: mediaEvent,
                            mediaEventHelper: new MediaEventHelper(mediaEvent),
                        },
                        FileBodyFactory,
                    )}
                </ScopedRoomContextProvider>,
            );
            expect(getByRole("button", { name: "alt" })).toBeInTheDocument();
        });
    });

    it.each(["m.file", "m.audio"])(
        "renderMBody fallback shows %s generic placeholder when showFileInfo is true",
        async (msgtype) => {
            const mediaEvent = new MatrixEvent({
                room_id: "!room:server",
                sender: userId,
                type: EventType.RoomMessage,
                content: {
                    body: "alt",
                    msgtype,
                    url: "mxc://server/image",
                },
            });

            const { container, getByRole } = render(
                <ScopedRoomContextProvider {...({ timelineRenderingType: TimelineRenderingType.File } as any)}>
                    {renderMBody(
                        {
                            ...props,
                            mxEvent: mediaEvent,
                            mediaEventHelper: new MediaEventHelper(mediaEvent),
                            showFileInfo: true,
                        },
                        FileBodyFactory,
                    )}
                </ScopedRoomContextProvider>,
            );

            expect(getByRole("button", { name: "alt" })).toBeInTheDocument();
            expect(container).toMatchSnapshot();
        },
    );

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

            const { container } = render(
                <ScopedRoomContextProvider {...({ timelineRenderingType: TimelineRenderingType.Room } as any)}>
                    <ImageBodyFactory
                        {...props}
                        mxEvent={mediaEvent}
                        mediaEventHelper={new MediaEventHelper(mediaEvent)}
                    />
                </ScopedRoomContextProvider>,
            );

            expect(container.querySelector(".mx_ImageBody")).not.toBeNull();
            expect(container.querySelector(".mx_MFileBody")).toBeNull();
        });

        it("renders the file fallback child in notification timelines", () => {
            const mediaEvent = mkEvent("m.image", imageContent);

            const { container, getByRole } = render(
                <ScopedRoomContextProvider {...({ timelineRenderingType: TimelineRenderingType.Notification } as any)}>
                    <ImageBodyFactory
                        {...props}
                        mxEvent={mediaEvent}
                        mediaEventHelper={new MediaEventHelper(mediaEvent)}
                    />
                </ScopedRoomContextProvider>,
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

            const { container, getByRole } = render(
                <ScopedRoomContextProvider {...({ timelineRenderingType: TimelineRenderingType.Room } as any)}>
                    <ImageBodyFactory
                        {...props}
                        mxEvent={mediaEvent}
                        mediaEventHelper={{ media: { isEncrypted: true } } as MediaEventHelper}
                    />
                </ScopedRoomContextProvider>,
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

            const { container } = render(
                <ScopedRoomContextProvider {...({ timelineRenderingType: TimelineRenderingType.Room } as any)}>
                    <ImageBodyFactory {...props} mxEvent={mediaEvent} mediaEventHelper={encryptedImageHelper()} />
                </ScopedRoomContextProvider>,
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

            const { container } = render(
                <ScopedRoomContextProvider {...({ timelineRenderingType: TimelineRenderingType.Room } as any)}>
                    <VideoBodyFactory
                        mxEvent={mediaEvent}
                        mediaEventHelper={new MediaEventHelper(mediaEvent)}
                        forExport={false}
                    />
                </ScopedRoomContextProvider>,
            );

            expect(container.querySelector(".mx_MVideoBody")).not.toBeNull();
            expect(container.querySelector(".mx_MFileBody")).toBeNull();
        });

        it("renders the file fallback child outside room timelines", () => {
            const mediaEvent = mkEvent("m.video", videoContent);

            const { container, getByRole } = render(
                <ScopedRoomContextProvider {...({ timelineRenderingType: TimelineRenderingType.Notification } as any)}>
                    <VideoBodyFactory
                        mxEvent={mediaEvent}
                        mediaEventHelper={new MediaEventHelper(mediaEvent)}
                        forExport={false}
                    />
                </ScopedRoomContextProvider>,
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

    describe("file preview button", () => {
        const mkFileEvent = (body: string, mimetype: string): MatrixEvent =>
            new MatrixEvent({
                room_id: "!room:server",
                sender: userId,
                type: EventType.RoomMessage,
                content: { body, msgtype: "m.file", url: "mxc://server/file", info: { mimetype } },
            });

        const renderFileBody = (mediaEvent: MatrixEvent) =>
            render(
                <ScopedRoomContextProvider {...({ timelineRenderingType: TimelineRenderingType.Room } as any)}>
                    {renderMBody(
                        { ...props, mxEvent: mediaEvent, mediaEventHelper: new MediaEventHelper(mediaEvent) },
                        FileBodyFactory,
                    )}
                </ScopedRoomContextProvider>,
            );

        const withPreviewEnabled = (enabled: boolean): void => {
            vi.spyOn(SettingsStore, "getValue").mockImplementation(
                (name) => (name === "feature_file_preview" ? enabled : undefined) as any,
            );
        };

        it("is absent while the labs flag is off", () => {
            withPreviewEnabled(false);
            const { queryByRole } = renderFileBody(mkFileEvent("spec.pdf", "application/pdf"));

            expect(queryByRole("button", { name: "Preview" })).not.toBeInTheDocument();
        });

        it("is absent for a format we cannot render", () => {
            withPreviewEnabled(true);
            const { queryByRole } = renderFileBody(mkFileEvent("archive.zip", "application/zip"));

            expect(queryByRole("button", { name: "Preview" })).not.toBeInTheDocument();
        });

        it("renders inside the file pill and opens the preview", () => {
            withPreviewEnabled(true);
            const createDialog = vi.spyOn(Modal, "createDialog").mockReturnValue({} as any);

            const { getByRole } = renderFileBody(mkFileEvent("spec.pdf", "application/pdf"));

            const button = getByRole("button", { name: "Preview" });
            // The control belongs to the file body itself, not a wrapper beside it.
            expect(button.closest(".mx_MediaBody")).not.toBeNull();

            fireEvent.click(button);
            expect(createDialog).toHaveBeenCalledWith(
                MediaPreviewDialog,
                expect.objectContaining({ mxEvent: expect.anything() }),
                "mx_Dialog_lightbox",
                undefined,
                true,
            );
        });
    });
});
