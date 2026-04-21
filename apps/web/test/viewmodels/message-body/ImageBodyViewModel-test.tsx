/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { createRef, type RefObject } from "react";
import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type Media } from "@element-hq/element-web-module-api";
import { ImageBodyViewState } from "@element-hq/web-shared-components";

import SettingsStore from "../../../src/settings/SettingsStore";
import { ImageSize } from "../../../src/settings/enums/ImageSize";
import { mediaFromContent } from "../../../src/customisations/Media";
import { TimelineRenderingType } from "../../../src/contexts/RoomContext";
import { DownloadError } from "../../../src/utils/DecryptFile";
import { type MediaEventHelper } from "../../../src/utils/MediaEventHelper";
import { ImageBodyViewModel } from "../../../src/viewmodels/message-body/ImageBodyViewModel";

jest.mock("../../../src/customisations/Media", () => ({
    mediaFromContent: jest.fn(),
}));

describe("ImageBodyViewModel", () => {
    const mockedMediaFromContent = jest.mocked(mediaFromContent);
    const imageRef = createRef<HTMLImageElement>() as RefObject<HTMLImageElement>;
    let imageSizeWatcher: ((...args: [unknown, unknown, unknown, unknown, ImageSize]) => void) | undefined;

    const flushPromises = async (): Promise<void> => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    };

    const downloadImageForTest = async (vm: ImageBodyViewModel): Promise<void> => {
        await (vm as any).downloadImage();
    };

    const createEvent = ({
        body = "demo image",
        content = {},
    }: {
        body?: string;
        content?: Record<string, unknown>;
    } = {}): MatrixEvent => {
        const { info: infoOverride, ...restContent } = content;

        return new MatrixEvent({
            type: EventType.RoomMessage,
            room_id: "!room:server",
            event_id: "$image:server",
            sender: "@alice:server",
            content: {
                msgtype: "m.image",
                body,
                url: "mxc://server/image",
                ...restContent,
                info: {
                    w: 320,
                    h: 240,
                    size: 48_000,
                    mimetype: "image/png",
                    ...(infoOverride as Record<string, unknown> | undefined),
                },
            },
        });
    };

    const createMediaEventHelper = ({
        encrypted,
        thumbnailUrl = "blob:thumbnail",
        sourceUrl = "blob:image",
        sourceBlob = new Blob(["image"], { type: "image/png" }),
    }: {
        encrypted: boolean;
        thumbnailUrl?: string | null | Promise<string | null>;
        sourceUrl?: string | null | Promise<string | null>;
        sourceBlob?: Blob | Promise<Blob>;
    }): MediaEventHelper =>
        ({
            media: { isEncrypted: encrypted },
            thumbnailUrl: { value: Promise.resolve(thumbnailUrl) },
            sourceUrl: { value: Promise.resolve(sourceUrl) },
            sourceBlob: { value: Promise.resolve(sourceBlob), cachedValue: sourceBlob },
        }) as unknown as MediaEventHelper;

    const createMockMedia = (content: Record<string, any>): Media =>
        ({
            isEncrypted: !!content.file,
            srcMxc: content.url ?? "mxc://server/image",
            srcHttp: "https://server/full.png",
            thumbnailMxc: content.info?.thumbnail_url ?? "mxc://server/thumb",
            thumbnailHttp: "https://server/thumb.png",
            hasThumbnail: content.info?.thumbnail_url !== null,
            getThumbnailHttp: jest.fn().mockReturnValue("https://server/thumb.png"),
            getThumbnailOfSourceHttp: jest.fn().mockReturnValue("https://server/thumb.png"),
            getSquareThumbnailHttp: jest.fn(),
            downloadSource: jest.fn(),
        }) as unknown as Media;

    const createVm = (
        overrides: Partial<ConstructorParameters<typeof ImageBodyViewModel>[0]> = {},
    ): ImageBodyViewModel =>
        new ImageBodyViewModel({
            mxEvent: createEvent(),
            mediaVisible: false,
            timelineRenderingType: TimelineRenderingType.Room,
            imageRef,
            ...overrides,
        });

    beforeEach(() => {
        Object.defineProperty(window, "devicePixelRatio", {
            configurable: true,
            value: 1,
        });

        const originalGetValue = SettingsStore.getValue;
        jest.spyOn(SettingsStore, "getValue").mockImplementation((setting, ...args) => {
            if (setting === "Images.size") {
                return ImageSize.Normal;
            }
            if (setting === "autoplayGifs") {
                return false;
            }
            return originalGetValue(setting, ...args);
        });
        jest.spyOn(SettingsStore, "watchSetting").mockImplementation((_name, _roomId, callback) => {
            imageSizeWatcher = callback as (...args: [unknown, unknown, unknown, unknown, ImageSize]) => void;
            return "image-body-test-watch";
        });
        jest.spyOn(SettingsStore, "unwatchSetting").mockImplementation(jest.fn());

        mockedMediaFromContent.mockImplementation((content) => createMockMedia(content));
    });

    afterEach(() => {
        jest.restoreAllMocks();
        imageSizeWatcher = undefined;
    });

    it("starts hidden and skips emitting when setMediaVisible is unchanged", () => {
        const vm = createVm();
        const listener = jest.fn();
        vm.subscribe(listener);

        expect(vm.getSnapshot()).toMatchObject({
            state: ImageBodyViewState.HIDDEN,
            hiddenButtonLabel: "Show image",
        });

        vm.setMediaVisible(false);

        expect(listener).not.toHaveBeenCalled();
    });

    it("renders the ready snapshot with thumbnail data once visible", async () => {
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    file: { url: "mxc://server/encrypted-image" },
                    info: {
                        mimetype: "image/jpeg",
                        w: 320,
                        h: 240,
                        size: 48_000,
                    },
                },
            }),
            mediaEventHelper: createMediaEventHelper({
                encrypted: true,
                sourceUrl: "https://server/full.png",
                thumbnailUrl: "https://server/thumb.png",
            }),
        });

        vm.setMediaVisible(true);
        await downloadImageForTest(vm);

        expect(vm.getSnapshot()).toMatchObject({
            state: ImageBodyViewState.READY,
            src: "https://server/full.png",
            thumbnailSrc: "https://server/thumb.png",
            linkUrl: "https://server/full.png",
        });
    });

    it("reveals hidden media through the supplied setter", () => {
        const setMediaVisible = jest.fn();
        const vm = createVm({ setMediaVisible });

        vm.onHiddenButtonClick();

        expect(setMediaVisible).toHaveBeenCalledWith(true);
    });

    it("falls back from the thumbnail url to the full image after an image error", async () => {
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    file: { url: "mxc://server/encrypted-image" },
                    info: {
                        mimetype: "image/jpeg",
                        w: 320,
                        h: 240,
                        size: 48_000,
                    },
                },
            }),
            mediaEventHelper: createMediaEventHelper({
                encrypted: true,
                sourceUrl: "https://server/full.png",
                thumbnailUrl: "https://server/thumb.png",
            }),
            mediaVisible: true,
        });

        vm.loadInitialMediaIfVisible();
        await downloadImageForTest(vm);
        expect(vm.getSnapshot().thumbnailSrc).toBe("https://server/thumb.png");

        vm.onImageError();

        expect(vm.getSnapshot()).toMatchObject({
            state: ImageBodyViewState.READY,
            src: "https://server/full.png",
            thumbnailSrc: "https://server/full.png",
        });
    });

    it("marks animated images for hover playback when autoplay is disabled", async () => {
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    file: { url: "mxc://server/encrypted-image" },
                    info: {
                        "w": 320,
                        "h": 240,
                        "size": 48_000,
                        "mimetype": "image/gif",
                        "thumbnail_info": { mimetype: "image/jpeg" },
                        "org.matrix.msc4230.is_animated": true,
                    },
                },
            }),
            mediaEventHelper: createMediaEventHelper({
                encrypted: true,
                sourceUrl: "https://server/full.gif",
                thumbnailUrl: "https://server/thumb.jpg",
                sourceBlob: new Blob(["gif"], { type: "image/gif" }),
            }),
            mediaVisible: true,
        });

        vm.loadInitialMediaIfVisible();
        await downloadImageForTest(vm);

        expect(vm.getSnapshot()).toMatchObject({
            state: ImageBodyViewState.READY,
            showAnimatedContentOnHover: true,
            gifLabel: "GIF",
        });
    });

    it("shows an error snapshot when encrypted media download fails", async () => {
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    file: { url: "mxc://server/encrypted-image" },
                },
            }),
            mediaEventHelper: createMediaEventHelper({
                encrypted: true,
                sourceUrl: Promise.reject(new DownloadError(new Error("download failed"))),
            }),
            mediaVisible: true,
        });

        vm.loadInitialMediaIfVisible();
        await flushPromises();

        expect(vm.getSnapshot()).toMatchObject({
            state: ImageBodyViewState.ERROR,
            errorLabel: "Error downloading image",
        });
    });

    it("updates dimensions when the image size setting changes", () => {
        const vm = createVm({ mediaVisible: true });
        vm.loadInitialMediaIfVisible();

        imageSizeWatcher?.(undefined, undefined, undefined, undefined, ImageSize.Large);

        expect(vm.getSnapshot()).toMatchObject({
            state: ImageBodyViewState.READY,
            maxWidth: expect.any(Number),
            maxHeight: expect.any(Number),
        });
    });
});
