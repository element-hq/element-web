/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { createRef, type RefObject } from "react";
import { ClientEvent, EventType, MatrixEvent, SyncState } from "matrix-js-sdk/src/matrix";
import { type Media } from "@element-hq/element-web-module-api";
import { ImageBodyViewPlaceholder, ImageBodyViewState } from "@element-hq/web-shared-components";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import SettingsStore from "../../settings/SettingsStore";
import { ImageSize } from "../../settings/enums/ImageSize";
import { mediaFromContent } from "../../customisations/Media";
import { TimelineRenderingType } from "../../contexts/RoomContext";
import { DecryptError, DownloadError } from "../../utils/DecryptFile";
import { type MediaEventHelper } from "../../utils/MediaEventHelper";
import { ImageBodyViewModel } from "./ImageBodyViewModel";
import Modal from "../../Modal";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { blobIsAnimated } from "../../utils/Image";
import { BLURHASH_FIELD, createThumbnail } from "../../utils/image-media";

vi.mock("../../customisations/Media", () => ({
    mediaFromContent: vi.fn(),
}));

vi.mock("../../utils/Image", async () => ({
    ...(await vi.importActual("../../utils/Image")),
    blobIsAnimated: vi.fn(),
}));

vi.mock("../../utils/image-media", async () => ({
    ...(await vi.importActual("../../utils/image-media")),
    createThumbnail: vi.fn(),
}));

describe("ImageBodyViewModel", () => {
    const mockedMediaFromContent = vi.mocked(mediaFromContent);
    const mockedBlobIsAnimated = vi.mocked(blobIsAnimated);
    const mockedCreateThumbnail = vi.mocked(createThumbnail);
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
        const info =
            infoOverride === null
                ? undefined
                : {
                      w: 320,
                      h: 240,
                      size: 48_000,
                      mimetype: "image/jpeg",
                      ...(infoOverride as Record<string, unknown> | undefined),
                  };

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
                ...(info ? { info } : {}),
            },
        });
    };

    const createMediaEventHelper = ({
        encrypted,
        fromLocalUpload = false,
        thumbnailUrl = "blob:thumbnail",
        sourceUrl = "blob:image",
        sourceBlob = new Blob(["image"], { type: "image/jpeg" }),
    }: {
        encrypted: boolean;
        fromLocalUpload?: boolean;
        thumbnailUrl?: string | null | Promise<string | null>;
        sourceUrl?: string | null | Promise<string | null>;
        sourceBlob?: Blob | Promise<Blob>;
    }): MediaEventHelper =>
        ({
            media: { isEncrypted: encrypted },
            isFromLocalUpload: fromLocalUpload,
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
            getThumbnailHttp: vi.fn().mockReturnValue("https://server/thumb.png"),
            getThumbnailOfSourceHttp: vi.fn().mockReturnValue("https://server/thumb.png"),
            getSquareThumbnailHttp: vi.fn(),
            downloadSource: vi.fn(),
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
        vi.clearAllMocks();

        Object.defineProperty(window, "devicePixelRatio", {
            configurable: true,
            value: 1,
        });

        vi.spyOn(URL, "createObjectURL").mockReturnValue("blob");
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

        const originalGetValue = SettingsStore.getValue;
        vi.spyOn(SettingsStore, "getValue").mockImplementation((setting, ...args) => {
            if (setting === "Images.size") {
                return ImageSize.Normal;
            }
            if (setting === "autoplayGifs") {
                return false;
            }
            return originalGetValue(setting, ...args);
        });
        vi.spyOn(SettingsStore, "watchSetting").mockImplementation((_name, _roomId, callback) => {
            imageSizeWatcher = callback as (...args: [unknown, unknown, unknown, unknown, ImageSize]) => void;
            return "image-body-test-watch";
        });
        vi.spyOn(SettingsStore, "unwatchSetting").mockImplementation(vi.fn());

        mockedMediaFromContent.mockImplementation((content: Record<string, any>) => createMockMedia(content));
        mockedBlobIsAnimated.mockResolvedValue(true);
        mockedCreateThumbnail.mockResolvedValue({ thumbnail: new Blob(["thumbnail"], { type: "image/jpeg" }) } as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        imageSizeWatcher = undefined;
    });

    it("starts hidden and skips emitting when setMediaVisible is unchanged", () => {
        const vm = createVm();
        const listener = vi.fn();
        vm.subscribe(listener);

        expect(vm.getSnapshot()).toMatchObject({
            state: ImageBodyViewState.HIDDEN,
            hiddenButtonLabel: "Show image",
        });

        vm.setMediaVisible(false);

        expect(listener).not.toHaveBeenCalled();
    });

    it("waits for initial media loading before exposing unencrypted media urls", () => {
        const vm = createVm({
            mediaVisible: true,
            mxEvent: createEvent({
                content: {
                    info: {
                        mimetype: "image/jpeg",
                    },
                },
            }),
        });

        expect(vm.getSnapshot()).toMatchObject({
            state: ImageBodyViewState.READY,
        });
        expect(vm.getSnapshot().src).toBeUndefined();
        expect(vm.getSnapshot().thumbnailSrc).toBeUndefined();
        expect(mockedMediaFromContent).not.toHaveBeenCalled();

        vm.loadInitialMediaIfVisible();

        expect(vm.getSnapshot()).toMatchObject({
            state: ImageBodyViewState.READY,
            src: "https://server/full.png",
            thumbnailSrc: "https://server/thumb.png",
            linkUrl: "https://server/full.png",
        });
    });

    it("does not load media while hidden", () => {
        const vm = createVm();

        vm.loadInitialMediaIfVisible();

        expect(mockedMediaFromContent).not.toHaveBeenCalled();
        expect(vm.getSnapshot()).toMatchObject({
            state: ImageBodyViewState.HIDDEN,
            hiddenButtonLabel: "Show image",
        });
    });

    it("uses MXC URLs directly for export snapshots", () => {
        const vm = createVm({
            forExport: true,
            mediaVisible: true,
            mxEvent: createEvent({
                content: {
                    url: undefined,
                    file: { url: "mxc://server/encrypted-image" },
                },
            }),
        });

        vm.loadInitialMediaIfVisible();

        expect(mockedMediaFromContent).not.toHaveBeenCalled();
        expect(vm.getSnapshot()).toMatchObject({
            state: ImageBodyViewState.READY,
            src: "mxc://server/encrypted-image",
            thumbnailSrc: "mxc://server/encrypted-image",
            linkUrl: "mxc://server/encrypted-image",
            linkTarget: "_blank",
            placeholder: ImageBodyViewPlaceholder.NONE,
        });
    });

    it("falls back to loaded image dimensions when event info has no size", () => {
        const imageRefWithDimensions = {
            current: {
                naturalWidth: 640,
                naturalHeight: 480,
            },
        } as RefObject<HTMLImageElement>;
        const vm = createVm({
            imageRef: imageRefWithDimensions,
            mediaVisible: true,
            mxEvent: createEvent({ content: { info: null } }),
        });

        expect(vm.getSnapshot()).toMatchObject({
            maxWidth: undefined,
            maxHeight: undefined,
            aspectRatio: undefined,
        });

        vm.onImageLoad();

        expect(vm.getSnapshot()).toMatchObject({
            maxWidth: expect.any(Number),
            maxHeight: expect.any(Number),
            aspectRatio: "640/480",
            placeholder: ImageBodyViewPlaceholder.NONE,
        });
    });

    it("switches from blurhash placeholder after the delay", () => {
        vi.useFakeTimers();
        const vm = createVm({
            mediaVisible: true,
            mxEvent: createEvent({
                content: {
                    info: {
                        [BLURHASH_FIELD]: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
                    },
                },
            }),
        });

        vm.loadInitialMediaIfVisible();
        expect(vm.getSnapshot().placeholder).toBe(ImageBodyViewPlaceholder.NONE);

        vi.advanceTimersByTime(150);

        expect(vm.getSnapshot().placeholder).toBe(ImageBodyViewPlaceholder.BLURHASH);
        vi.useRealTimers();
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

    it("renders an unencrypted image this client uploaded from memory", async () => {
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    url: "mxc://server/image",
                    info: { mimetype: "image/jpeg", w: 320, h: 240, size: 48_000 },
                },
            }),
            mediaEventHelper: createMediaEventHelper({
                encrypted: false,
                fromLocalUpload: true,
                sourceUrl: "blob:just-uploaded",
                thumbnailUrl: "blob:just-uploaded-thumbnail",
            }),
        });

        vm.setMediaVisible(true);
        await downloadImageForTest(vm);

        expect(vm.getSnapshot()).toMatchObject({
            state: ImageBodyViewState.READY,
            src: "blob:just-uploaded",
            thumbnailSrc: "blob:just-uploaded-thumbnail",
        });
    });

    it("reveals hidden media through the supplied setter", () => {
        const setMediaVisible = vi.fn();
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

    it("uses the decrypt error label when encrypted media decryption fails", async () => {
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    file: { url: "mxc://server/encrypted-image" },
                },
            }),
            mediaEventHelper: createMediaEventHelper({
                encrypted: true,
                sourceUrl: Promise.reject(new DecryptError(new Error("decrypt failed"))),
            }),
            mediaVisible: true,
        });

        await downloadImageForTest(vm);

        expect(vm.getSnapshot()).toMatchObject({
            state: ImageBodyViewState.ERROR,
            errorLabel: "Error decrypting image",
        });
    });

    it("uses the generic error label when image loading fails", () => {
        const client = { on: vi.fn() };
        vi.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(client as any);
        const vm = createVm({ mediaVisible: true });

        vm.onImageError();

        expect(client.on).toHaveBeenCalledWith(ClientEvent.Sync, expect.any(Function));
        expect(vm.getSnapshot()).toMatchObject({
            state: ImageBodyViewState.ERROR,
            errorLabel: "Unable to show image due to error",
        });
    });

    it("clears image errors after reconnecting", () => {
        const client = { on: vi.fn(), off: vi.fn() };
        vi.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(client as any);
        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(client as any);
        const vm = createVm({ mediaVisible: true });

        vm.onImageError();
        expect(vm.getSnapshot().state).toBe(ImageBodyViewState.ERROR);

        const listener = client.on.mock.calls[0][1];
        listener(SyncState.Syncing, SyncState.Error);

        expect(client.off).toHaveBeenCalledWith(ClientEvent.Sync, listener);
        expect(vm.getSnapshot().state).toBe(ImageBodyViewState.READY);
    });

    it("ignores repeated image errors once already in the error state", () => {
        const client = { on: vi.fn() };
        vi.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(client as any);
        const vm = createVm({ mediaVisible: true });

        vm.onImageError();
        vm.onImageError();

        expect(client.on).toHaveBeenCalledTimes(1);
    });

    it("uses the SVG thumbnail media when one is available", () => {
        const vm = createVm({
            mediaVisible: true,
            mxEvent: createEvent({
                content: {
                    info: {
                        mimetype: "image/svg+xml",
                        thumbnail_url: "mxc://server/svg-thumb",
                    },
                },
            }),
        });

        vm.loadInitialMediaIfVisible();

        const media = mockedMediaFromContent.mock.results.at(-1)!.value as Media;
        expect(media.getThumbnailHttp).toHaveBeenCalledWith(800, 600, "scale");
        expect(vm.getSnapshot().thumbnailSrc).toBe("https://server/thumb.png");
    });

    it("uses the full source as thumbnail for small high-dpi images", () => {
        Object.defineProperty(window, "devicePixelRatio", {
            configurable: true,
            value: 2,
        });
        const vm = createVm({
            mediaVisible: true,
            mxEvent: createEvent({
                content: {
                    info: {
                        mimetype: "image/jpeg",
                        w: 320,
                        h: 240,
                        size: 48_000,
                    },
                },
            }),
        });

        vm.loadInitialMediaIfVisible();

        expect(vm.getSnapshot().thumbnailSrc).toBe("https://server/full.png");
    });

    it("requests a thumbnail for large high-dpi images", () => {
        Object.defineProperty(window, "devicePixelRatio", {
            configurable: true,
            value: 2,
        });
        const vm = createVm({
            mediaVisible: true,
            mxEvent: createEvent({
                content: {
                    info: {
                        mimetype: "image/jpeg",
                        w: 1600,
                        h: 1200,
                        size: 2 * 1024 * 1024,
                    },
                },
            }),
        });

        vm.loadInitialMediaIfVisible();

        const media = mockedMediaFromContent.mock.results.at(-1)!.value as Media;
        expect(media.getThumbnailOfSourceHttp).toHaveBeenCalledWith(800, 600);
        expect(vm.getSnapshot().thumbnailSrc).toBe("https://server/thumb.png");
    });

    it("generates a static thumbnail for animated images without a safe thumbnail", async () => {
        let createdImage: any;
        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
            if (tagName !== "img") {
                return originalCreateElement(tagName);
            }
            createdImage = {
                width: 320,
                height: 240,
                crossOrigin: "",
                src: "",
                onload: undefined,
                onerror: undefined,
            };
            return createdImage as HTMLImageElement;
        }) as typeof document.createElement);
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    file: { url: "mxc://server/encrypted-image" },
                    info: {
                        "mimetype": "image/gif",
                        "thumbnail_info": { mimetype: "image/gif" },
                        "org.matrix.msc4230.is_animated": true,
                    },
                },
            }),
            mediaEventHelper: createMediaEventHelper({
                encrypted: true,
                sourceUrl: "https://server/full.gif",
                thumbnailUrl: null,
                sourceBlob: new Blob(["gif"], { type: "image/gif" }),
            }),
            mediaVisible: true,
        });

        const promise = downloadImageForTest(vm);
        await flushPromises();
        createdImage.onload();
        await promise;

        expect(mockedBlobIsAnimated).toHaveBeenCalled();
        expect(mockedCreateThumbnail).toHaveBeenCalledWith(createdImage, 320, 240, "image/gif", false);
        expect(vm.getSnapshot()).toMatchObject({
            state: ImageBodyViewState.READY,
            thumbnailSrc: "blob",
            gifLabel: "GIF",
        });
    });

    it("treats decoded static images as non-animated", async () => {
        mockedBlobIsAnimated.mockResolvedValue(false);
        let createdImage: any;
        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
            if (tagName !== "img") {
                return originalCreateElement(tagName);
            }
            createdImage = {
                width: 320,
                height: 240,
                crossOrigin: "",
                src: "",
                onload: undefined,
                onerror: undefined,
            };
            return createdImage as HTMLImageElement;
        }) as typeof document.createElement);
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    file: { url: "mxc://server/encrypted-image" },
                    info: {
                        mimetype: "image/gif",
                    },
                },
            }),
            mediaEventHelper: createMediaEventHelper({
                encrypted: true,
                sourceUrl: "https://server/full.gif",
                thumbnailUrl: null,
                sourceBlob: new Blob(["gif"], { type: "image/gif" }),
            }),
            mediaVisible: true,
        });

        const promise = downloadImageForTest(vm);
        await flushPromises();
        createdImage.onload();
        await promise;

        expect(mockedCreateThumbnail).not.toHaveBeenCalled();
        expect(vm.getSnapshot()).toMatchObject({
            state: ImageBodyViewState.READY,
            gifLabel: undefined,
            showAnimatedContentOnHover: false,
        });
    });

    it("shows an error when animated image loading fails", async () => {
        let createdImage: any;
        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
            if (tagName !== "img") {
                return originalCreateElement(tagName);
            }
            createdImage = {
                width: 320,
                height: 240,
                crossOrigin: "",
                src: "",
                onload: undefined,
                onerror: undefined,
            };
            return createdImage as HTMLImageElement;
        }) as typeof document.createElement);
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    file: { url: "mxc://server/encrypted-image" },
                    info: {
                        mimetype: "image/gif",
                    },
                },
            }),
            mediaEventHelper: createMediaEventHelper({
                encrypted: true,
                sourceUrl: "https://server/full.gif",
                thumbnailUrl: null,
            }),
            mediaVisible: true,
        });

        const promise = downloadImageForTest(vm);
        await flushPromises();
        createdImage.onerror();
        await promise;

        expect(vm.getSnapshot()).toMatchObject({
            state: ImageBodyViewState.ERROR,
            errorLabel: "Unable to show image due to error",
        });
    });

    it("continues when animated thumbnail generation fails", async () => {
        mockedCreateThumbnail.mockRejectedValue(new Error("thumbnail failed"));
        let createdImage: any;
        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
            if (tagName !== "img") {
                return originalCreateElement(tagName);
            }
            createdImage = {
                width: 320,
                height: 240,
                crossOrigin: "",
                src: "",
                onload: undefined,
                onerror: undefined,
            };
            return createdImage as HTMLImageElement;
        }) as typeof document.createElement);
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    file: { url: "mxc://server/encrypted-image" },
                    info: {
                        mimetype: "image/gif",
                    },
                },
            }),
            mediaEventHelper: createMediaEventHelper({
                encrypted: true,
                sourceUrl: "https://server/full.gif",
                thumbnailUrl: null,
            }),
            mediaVisible: true,
        });

        const promise = downloadImageForTest(vm);
        await flushPromises();
        createdImage.onload();
        await promise;

        expect(vm.getSnapshot()).toMatchObject({
            state: ImageBodyViewState.READY,
            thumbnailSrc: "https://server/full.gif",
            gifLabel: "GIF",
        });
    });

    it("revokes a generated thumbnail if disposed before download completes", async () => {
        let createdImage: any;
        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
            if (tagName !== "img") {
                return originalCreateElement(tagName);
            }
            createdImage = {
                width: 320,
                height: 240,
                crossOrigin: "",
                src: "",
                onload: undefined,
                onerror: undefined,
            };
            return createdImage as HTMLImageElement;
        }) as typeof document.createElement);
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    file: { url: "mxc://server/encrypted-image" },
                    info: {
                        mimetype: "image/gif",
                    },
                },
            }),
            mediaEventHelper: createMediaEventHelper({
                encrypted: true,
                sourceUrl: "https://server/full.gif",
                thumbnailUrl: null,
            }),
            mediaVisible: true,
        });
        mockedCreateThumbnail.mockImplementation(async () => {
            vm.dispose();
            return { thumbnail: new Blob(["thumbnail"], { type: "image/jpeg" }) } as any;
        });

        const promise = downloadImageForTest(vm);
        await flushPromises();
        createdImage.onload();
        await promise;

        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob");
    });

    it("opens the image viewer for primary clicks", () => {
        const clientRect = { width: 100, height: 80, x: 10, y: 20 };
        const imageRefWithRect = {
            current: {
                getBoundingClientRect: () => clientRect,
            },
        } as RefObject<HTMLImageElement>;
        const vm = createVm({
            imageRef: imageRefWithRect,
            mediaVisible: true,
            permalinkCreator: {} as any,
        });
        vm.loadInitialMediaIfVisible();
        const preventDefault = vi.fn();
        vi.spyOn(Modal, "createDialog").mockReturnValue({} as any);

        vm.onLinkClick({ button: 0, metaKey: false, preventDefault } as any);

        expect(preventDefault).toHaveBeenCalled();
        expect(Modal.createDialog).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({
                src: "https://server/full.png",
                name: "demo image",
                width: 320,
                height: 240,
                fileSize: 48_000,
                thumbnailInfo: {
                    width: 100,
                    height: 80,
                    positionX: 10,
                    positionY: 20,
                },
            }),
            "mx_Dialog_lightbox",
            undefined,
            true,
        );
    });

    it("uses the decrypted thumbnail in the image viewer when the source mime type is unsafe", async () => {
        const vm = createVm({
            mxEvent: createEvent({
                body: "",
                content: {
                    file: { url: "mxc://server/encrypted-image" },
                    info: {
                        mimetype: "image/svg+xml",
                    },
                },
            }),
            mediaEventHelper: createMediaEventHelper({
                encrypted: true,
                sourceUrl: "blob:unsafe-source",
                thumbnailUrl: "blob:safe-thumbnail",
                sourceBlob: new Blob(["html"], { type: "text/html" }),
            }),
            mediaVisible: true,
        });
        vi.spyOn(Modal, "createDialog").mockReturnValue({} as any);

        await downloadImageForTest(vm);
        vm.onLinkClick({ button: 0, metaKey: false, preventDefault: vi.fn() } as any);

        expect(Modal.createDialog).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({
                src: "blob:safe-thumbnail",
                name: "Attachment",
            }),
            "mx_Dialog_lightbox",
            undefined,
            true,
        );
    });

    it("does not open the image viewer for modified clicks or missing URLs", () => {
        const vm = createVm({ mediaVisible: true });
        const preventDefault = vi.fn();
        vi.spyOn(Modal, "createDialog").mockReturnValue({} as any);

        vm.onLinkClick({ button: 0, metaKey: true, preventDefault } as any);
        vm.onLinkClick({ button: 1, metaKey: false, preventDefault } as any);
        vm.onLinkClick({ button: 0, metaKey: false, preventDefault } as any);

        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(Modal.createDialog).not.toHaveBeenCalled();
    });

    it("reveals hidden media instead of opening the viewer", () => {
        const setMediaVisible = vi.fn();
        const preventDefault = vi.fn();
        const vm = createVm({ setMediaVisible });
        vi.spyOn(Modal, "createDialog").mockReturnValue({} as any);

        vm.onLinkClick({ button: 0, metaKey: false, preventDefault } as any);

        expect(preventDefault).toHaveBeenCalled();
        expect(setMediaVisible).toHaveBeenCalledWith(true);
        expect(Modal.createDialog).not.toHaveBeenCalled();
    });

    it("updates granular props and skips unchanged updates", async () => {
        const vm = createVm({ mediaVisible: true, maxImageHeight: 100 });
        const listener = vi.fn();
        const setMediaVisible = vi.fn();
        vm.subscribe(listener);

        vm.setForExport(undefined);
        vm.setMaxImageHeight(100);
        vm.setMediaVisible(true);
        vm.setPermalinkCreator(undefined);
        vm.setTimelineRenderingType(TimelineRenderingType.Room);
        vm.setSetMediaVisible(undefined);
        imageSizeWatcher?.(undefined, undefined, undefined, undefined, ImageSize.Normal);

        expect(listener).not.toHaveBeenCalled();

        vm.setForExport(true);
        vm.setMaxImageHeight(200);
        vm.setTimelineRenderingType(TimelineRenderingType.File);
        vm.setPermalinkCreator({} as any);
        vm.setSetMediaVisible(setMediaVisible);
        vm.onHiddenButtonClick();

        expect(listener).toHaveBeenCalled();
        expect(setMediaVisible).toHaveBeenCalledWith(true);
        expect(vm.getSnapshot()).toMatchObject({
            linkTarget: "_blank",
            bannerLabel: undefined,
        });
    });

    it("resets state and reloads when the event changes while visible", async () => {
        const client = { off: vi.fn() };
        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(client as any);
        const vm = createVm({ mediaVisible: true });
        vm.loadInitialMediaIfVisible();
        expect(vm.getSnapshot().src).toBe("https://server/full.png");

        const nextEvent = createEvent({ body: "next image" });
        vm.setEvent(nextEvent);
        await flushPromises();

        expect(client.off).toHaveBeenCalledWith(ClientEvent.Sync, expect.any(Function));
        expect(vm.getSnapshot()).toMatchObject({
            alt: "next image",
            src: "https://server/full.png",
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

    it("cleans up watchers, reconnect listeners and generated thumbnails on dispose", async () => {
        let createdImage: any;
        const client = { off: vi.fn() };
        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(client as any);
        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
            if (tagName !== "img") {
                return originalCreateElement(tagName);
            }
            createdImage = {
                width: 320,
                height: 240,
                crossOrigin: "",
                src: "",
                onload: undefined,
                onerror: undefined,
            };
            return createdImage as HTMLImageElement;
        }) as typeof document.createElement);
        const vm = createVm({
            mxEvent: createEvent({
                content: {
                    file: { url: "mxc://server/encrypted-image" },
                    info: {
                        mimetype: "image/gif",
                    },
                },
            }),
            mediaEventHelper: createMediaEventHelper({
                encrypted: true,
                sourceUrl: "https://server/full.gif",
                thumbnailUrl: null,
            }),
            mediaVisible: true,
        });

        const promise = downloadImageForTest(vm);
        await flushPromises();
        createdImage.onload();
        await promise;

        vm.dispose();

        expect(SettingsStore.unwatchSetting).toHaveBeenCalledWith("image-body-test-watch");
        expect(client.off).toHaveBeenCalledWith(ClientEvent.Sync, expect.any(Function));
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob");
    });
});
