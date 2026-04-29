/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { EventType, getHttpUriForMxc, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import { RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsCrypto,
    mockClientMethodsDevice,
    mockClientMethodsServer,
    mockClientMethodsUser,
} from "../../../../test-utils";
import { MediaEventHelper } from "../../../../../src/utils/MediaEventHelper";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import {
    DecryptionFailureBodyFactory,
    FileBodyFactory,
    ImageBodyFactory,
    RedactedBodyFactory,
    VideoBodyFactory,
    renderMBody,
} from "../../../../../src/components/views/messages/MBodyFactory";
import { TimelineRenderingType } from "../../../../../src/contexts/RoomContext.ts";
import { ScopedRoomContextProvider } from "../../../../../src/contexts/ScopedRoomContext.tsx";
import { useMediaVisible } from "../../../../../src/hooks/useMediaVisible";

jest.mock("matrix-encrypt-attachment", () => ({
    decryptAttachment: jest.fn(),
}));

jest.mock("../../../../../src/hooks/useMediaVisible", () => ({
    __esModule: true,
    useMediaVisible: jest.fn(),
}));

describe("MBodyFactory", () => {
    const userId = "@user:server";
    const deviceId = "DEADB33F";
    const cli = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsServer(),
        ...mockClientMethodsDevice(deviceId),
        ...mockClientMethodsCrypto(),
        getRooms: jest.fn().mockReturnValue([]),
        getIgnoredUsers: jest.fn(),
        getVersions: jest.fn().mockResolvedValue({
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
        onMessageAllowed: jest.fn(),
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
        jest.spyOn(SettingsStore, "getValue").mockRestore();
        jest.mocked(useMediaVisible).mockReturnValue([true, jest.fn()]);
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

            expect(container.querySelector(".mx_MImageBody")).not.toBeNull();
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

            expect(container.querySelector(".mx_MImageBody")).not.toBeNull();
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

            expect(container.querySelector(".mx_MImageBody")).toBeNull();
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

            expect(container.querySelector(".mx_MImageBody")).not.toBeNull();
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
});
