/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { VideoBodyViewState } from "@element-hq/web-shared-components";
import { decode } from "blurhash";
import { type Media } from "@element-hq/element-web-module-api";

import SettingsStore from "../../../src/settings/SettingsStore";
import { ImageSize } from "../../../src/settings/enums/ImageSize";
import { mediaFromContent } from "../../../src/customisations/Media";
import { BLURHASH_FIELD } from "../../../src/utils/image-media";
import { type MediaEventHelper } from "../../../src/utils/MediaEventHelper";
import { VideoBodyViewModel } from "../../../src/viewmodels/message-body/VideoBodyViewModel";

jest.mock("../../../src/customisations/Media", () => ({
    mediaFromContent: jest.fn(),
}));
jest.mock("blurhash", () => ({
    decode: jest.fn(),
}));

describe("VideoBodyViewModel", () => {
    const mockedMediaFromContent = jest.mocked(mediaFromContent);
    const mockedDecode = jest.mocked(decode);
    const videoRef = { current: null };
    let imageSizeWatcher: ((...args: [unknown, unknown, unknown, unknown, ImageSize]) => void) | undefined;

    const flushPromises = async (): Promise<void> => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    };

    const createEvent = ({
        body = "demo video",
        content = {},
    }: {
        body?: string;
        content?: Record<string, unknown>;
    } = {}): MatrixEvent => {
        const { info: infoOverride, ...restContent } = content;

        return new MatrixEvent({
            type: EventType.RoomMessage,
            room_id: "!room:server",
            event_id: "$video:server",
            sender: "@alice:server",
            content: {
                msgtype: "m.video",
                body,
                url: "https://server/video.mp4",
                ...restContent,
                info: {
                    w: 320,
                    h: 180,
                    mimetype: "video/mp4",
                    ...(infoOverride as Record<string, unknown> | undefined),
                },
            },
        });
    };

    const createMediaEventHelper = ({
        encrypted,
        thumbnailUrl = "blob:thumbnail",
        sourceUrl = "blob:video",
        sourceBlob = new Blob(["video"], { type: "video/mp4" }),
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
            sourceBlob: { value: Promise.resolve(sourceBlob) },
        }) as unknown as MediaEventHelper;

    const createVm = (overrides?: Partial<ConstructorParameters<typeof VideoBodyViewModel>[0]>): VideoBodyViewModel =>
        new VideoBodyViewModel({
            mxEvent: createEvent(),
            mediaVisible: false,
            videoRef,
            ...overrides,
        });

    const createMockMedia = (content: Record<string, any>): Media =>
        ({
            isEncrypted: !!content.file,
            srcMxc: content.url ?? "mxc://server/video",
            thumbnailMxc: content.info?.thumbnail_url ?? undefined,
            srcHttp: content.url ?? "https://server/video.mp4",
            thumbnailHttp:
                content.info?.thumbnail_url === null
                    ? null
                    : (content.info?.thumbnail_url ?? "https://server/poster.jpg"),
            hasThumbnail: content.info?.thumbnail_url !== null,
            getThumbnailHttp: jest.fn(),
            getThumbnailOfSourceHttp: jest.fn(),
            getSquareThumbnailHttp: jest.fn(),
            downloadSource: jest.fn(),
        }) as unknown as Media;

    beforeEach(() => {
        const originalGetValue = SettingsStore.getValue;
        jest.spyOn(SettingsStore, "getValue").mockImplementation((setting, ...args) => {
            if (setting === "Images.size") {
                return ImageSize.Normal;
            }
            if (setting === "autoplayVideo") {
                return false;
            }
            return originalGetValue(setting, ...args);
        });
        jest.spyOn(SettingsStore, "watchSetting").mockImplementation((_name, _roomId, callback) => {
            imageSizeWatcher = callback as (...args: [unknown, unknown, unknown, unknown, ImageSize]) => void;
            return "video-body-test-watch";
        });
        jest.spyOn(SettingsStore, "unwatchSetting").mockImplementation(jest.fn());

        mockedMediaFromContent.mockImplementation((content) => createMockMedia(content));
        mockedDecode.mockReturnValue(new Uint8ClampedArray(320 * 180 * 4));
    });

    afterEach(() => {
        jest.restoreAllMocks();
        imageSizeWatcher = undefined;
    });

    it("computes the initial hidden snapshot from props", () => {
        const vm = createVm();

        expect(vm.getSnapshot().state).toBe(VideoBodyViewState.HIDDEN);
        expect(vm.getSnapshot().hiddenButtonLabel).toBeTruthy();
        expect(vm.getSnapshot().maxWidth).toBe(320);
        expect(vm.getSnapshot().maxHeight).toBe(180);
    });

    it("updates to ready when media becomes visible", () => {
        const vm = createVm();

        vm.setMediaVisible(true);

        expect(vm.getSnapshot().state).toBe(VideoBodyViewState.READY);
        expect(vm.getSnapshot().src).toBe("https://server/video.mp4");
        expect(vm.getSnapshot().poster).toBe("https://server/poster.jpg");
    });

    it("uses the export urls directly when rendering for export", () => {
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    url: "https://server/fallback.mp4",
                    file: {
                        url: "mxc://server/export-video",
                    },
                },
            }),
            mediaVisible: true,
            forExport: true,
        });

        expect(vm.getSnapshot()).toMatchObject({
            state: VideoBodyViewState.READY,
            src: "mxc://server/export-video",
            preload: "metadata",
            poster: undefined,
        });
    });

    it("updates controls and autoplay flags when interaction is inhibited", () => {
        const vm = createVm({ mediaVisible: true });

        vm.setInhibitInteraction(true);

        expect(vm.getSnapshot().controls).toBe(false);
        expect(vm.getSnapshot().muted).toBe(false);
        expect(vm.getSnapshot().autoPlay).toBe(false);
    });

    it("forwards preview clicks", () => {
        const onPreviewClick = jest.fn();
        const vm = createVm({ onPreviewClick });

        vm.onPreviewClick();

        expect(onPreviewClick).toHaveBeenCalledTimes(1);
    });

    it("preloads encrypted video when autoplay is enabled", async () => {
        const originalGetValue = SettingsStore.getValue;
        jest.spyOn(SettingsStore, "getValue").mockImplementation((setting, ...args) => {
            if (setting === "Images.size") return ImageSize.Normal;
            if (setting === "autoplayVideo") return true;
            return originalGetValue(setting, ...args);
        });

        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    file: { url: "mxc://server/encrypted-video" },
                },
            }),
            mediaEventHelper: createMediaEventHelper({
                encrypted: true,
                thumbnailUrl: "blob:encrypted-poster",
                sourceUrl: "blob:encrypted-video",
            }),
            mediaVisible: true,
        });

        expect(vm.getSnapshot().state).toBe(VideoBodyViewState.LOADING);

        await flushPromises();

        expect(vm.getSnapshot()).toMatchObject({
            state: VideoBodyViewState.READY,
            src: "blob:encrypted-video",
            poster: "blob:encrypted-poster",
            muted: true,
            autoPlay: true,
        });
    });

    it("keeps encrypted video lazy-loadable when autoplay is disabled", async () => {
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    file: { url: "mxc://server/encrypted-video" },
                    info: {
                        mimetype: "video/quicktime",
                    },
                },
            }),
            mediaEventHelper: createMediaEventHelper({
                encrypted: true,
                thumbnailUrl: null,
            }),
            mediaVisible: true,
        });

        await flushPromises();

        expect(vm.getSnapshot()).toMatchObject({
            state: VideoBodyViewState.READY,
            src: "data:video/mp4,",
            poster: "data:video/mp4,",
            preload: "none",
            autoPlay: false,
        });
    });

    it("switches to the error state when encrypted preload fails", async () => {
        jest.spyOn(logger, "warn").mockImplementation(jest.fn());
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    file: { url: "mxc://server/encrypted-video" },
                },
            }),
            mediaEventHelper: createMediaEventHelper({
                encrypted: true,
                thumbnailUrl: Promise.reject(new Error("decrypt failed")),
            }),
            mediaVisible: true,
        });

        await flushPromises();

        expect(vm.getSnapshot().state).toBe(VideoBodyViewState.ERROR);
        expect(vm.getSnapshot().errorLabel).toBeTruthy();
    });

    it("loads the encrypted source on play when only a placeholder url is present", async () => {
        const play = jest.fn();
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    file: { url: "mxc://server/encrypted-video" },
                },
            }),
            mediaEventHelper: createMediaEventHelper({
                encrypted: true,
                thumbnailUrl: null,
                sourceUrl: "blob:played-video",
            }),
            mediaVisible: true,
            videoRef: { current: { play } } as any,
        });

        await flushPromises();
        await vm.onPlay();

        expect(vm.getSnapshot().src).toBe("blob:played-video");
        expect(play).toHaveBeenCalledTimes(1);
    });

    it("shows an error when play is requested without encrypted media data", async () => {
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    file: { url: "mxc://server/encrypted-video" },
                },
            }),
            mediaVisible: true,
        });

        await vm.onPlay();

        expect(vm.getSnapshot().state).toBe(VideoBodyViewState.ERROR);
    });

    it("recomputes dimensions when the image-size setting changes", () => {
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    info: {
                        w: 1280,
                        h: 720,
                    },
                },
            }),
            mediaVisible: false,
        });

        expect(vm.getSnapshot().maxWidth).toBe(324);
        expect(vm.getSnapshot().maxHeight).toBe(182);

        imageSizeWatcher?.(undefined, undefined, undefined, undefined, ImageSize.Large);

        expect(vm.getSnapshot().maxWidth).toBe(800);
        expect(vm.getSnapshot().maxHeight).toBe(450);
    });

    it("uses the blurhash poster while the thumbnail image is loading", () => {
        const originalCreateElement = document.createElement.bind(document);
        const originalImage = global.Image;
        let imageOnLoad: (() => void) | undefined;

        const context = {
            createImageData: jest.fn((width: number, height: number) => ({
                data: new Uint8ClampedArray(width * height * 4),
            })),
            putImageData: jest.fn(),
        };
        const canvas = {
            width: 0,
            height: 0,
            getContext: jest.fn(() => context),
            toDataURL: jest.fn(() => "data:image/png;base64,blurhash"),
        };

        jest.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
            if (tagName === "canvas") {
                return canvas as any;
            }
            return originalCreateElement(tagName);
        }) as typeof document.createElement);

        class MockImage {
            public onload?: () => void;

            public set src(_value: string) {
                imageOnLoad = this.onload;
            }
        }

        global.Image = MockImage as unknown as typeof Image;

        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    info: {
                        [BLURHASH_FIELD]: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
                    },
                },
            }),
            mediaVisible: true,
        });

        expect(vm.getSnapshot().poster).toBe("data:image/png;base64,blurhash");

        imageOnLoad?.();

        expect(vm.getSnapshot().poster).toBe("https://server/poster.jpg");

        global.Image = originalImage;
    });

    it("resets encrypted media state when the event changes", async () => {
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    body: "first video",
                    file: { url: "mxc://server/video-a" },
                },
            }),
            mediaEventHelper: createMediaEventHelper({
                encrypted: true,
                thumbnailUrl: null,
                sourceUrl: "blob:first-video",
            }),
            mediaVisible: true,
        });

        await flushPromises();
        expect(vm.getSnapshot().src).toBe("data:video/mp4,");

        vm.setEvent(
            createEvent({
                body: "second video",
                content: {
                    file: { url: "mxc://server/video-b" },
                },
            }),
            createMediaEventHelper({
                encrypted: true,
                thumbnailUrl: null,
                sourceUrl: "blob:second-video",
            }),
        );

        await flushPromises();

        expect(vm.getSnapshot().videoLabel).toBe("second video");
        expect(vm.getSnapshot().src).toBe("data:video/mp4,");
    });

    it("does not emit for unchanged targeted setters", () => {
        const event = createEvent();
        const onPreviewClick = jest.fn();
        const vm = createVm({
            mxEvent: event,
            mediaVisible: false,
            onPreviewClick,
        });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setEvent(event, undefined);
        vm.setForExport(undefined);
        vm.setInhibitInteraction(undefined);
        vm.setMediaVisible(false);
        vm.setOnPreviewClick(onPreviewClick);

        expect(listener).not.toHaveBeenCalled();
    });
});
