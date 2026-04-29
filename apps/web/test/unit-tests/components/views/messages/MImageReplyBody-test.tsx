/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef } from "react";
import { act, fireEvent, render, screen, waitFor } from "jest-matrix-react";
import { ClientEvent, EventType, getHttpUriForMxc, MatrixEvent, Room, SyncState } from "matrix-js-sdk/src/matrix";

import Modal from "../../../../../src/Modal";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { ImageSize } from "../../../../../src/settings/enums/ImageSize";
import { mediaFromContent } from "../../../../../src/customisations/Media";
import { BLURHASH_FIELD, createThumbnail } from "../../../../../src/utils/image-media";
import { blobIsAnimated } from "../../../../../src/utils/Image";
import { DecryptError, DownloadError } from "../../../../../src/utils/DecryptFile";
import { type MediaEventHelper } from "../../../../../src/utils/MediaEventHelper";
import { RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks";
import RoomContext, { TimelineRenderingType } from "../../../../../src/contexts/RoomContext";
import MImageReplyBody, { ImageBodyBaseInner } from "../../../../../src/components/views/messages/MImageReplyBody";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsCrypto,
    mockClientMethodsDevice,
    mockClientMethodsServer,
    mockClientMethodsUser,
} from "../../../../test-utils";
import { useMediaVisible } from "../../../../../src/hooks/useMediaVisible";

jest.mock("../../../../../src/customisations/Media", () => ({
    mediaFromContent: jest.fn(),
}));

jest.mock("../../../../../src/utils/Image", () => ({
    ...jest.requireActual("../../../../../src/utils/Image"),
    blobIsAnimated: jest.fn(),
}));

jest.mock("../../../../../src/utils/image-media", () => ({
    ...jest.requireActual("../../../../../src/utils/image-media"),
    createThumbnail: jest.fn(),
}));

jest.mock("../../../../../src/hooks/useMediaVisible", () => ({
    __esModule: true,
    useMediaVisible: jest.fn(),
}));

describe("<MImageReplyBody />", () => {
    const userId = "@user:server";
    const deviceId = "DEADB33F";
    const cli = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsServer(),
        ...mockClientMethodsDevice(deviceId),
        ...mockClientMethodsCrypto(),
        getRoom: jest.fn(),
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

    const mockedMediaFromContent = jest.mocked(mediaFromContent);
    const mockedUseMediaVisible = jest.mocked(useMediaVisible);
    const mockedBlobIsAnimated = jest.mocked(blobIsAnimated);
    const mockedCreateThumbnail = jest.mocked(createThumbnail);
    const originalGetValue = SettingsStore.getValue.bind(SettingsStore);

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
            sender: userId,
            content: {
                msgtype: "m.image",
                body,
                url: "mxc://server/image",
                ...restContent,
                ...(info ? { info } : {}),
            },
        });
    };

    const createMockMedia = (content: Record<string, any>) => ({
        isEncrypted: !!content.file,
        srcMxc: content.url ?? content.file?.url ?? "mxc://server/image",
        srcHttp: "https://server/full.png",
        thumbnailMxc: content.info?.thumbnail_url ?? "mxc://server/thumb",
        thumbnailHttp: "https://server/thumb.png",
        hasThumbnail: content.info?.thumbnail_url !== null,
        getThumbnailHttp: jest.fn().mockReturnValue("https://server/thumb.png"),
        getThumbnailOfSourceHttp: jest.fn().mockReturnValue("https://server/thumb.png"),
        getSquareThumbnailHttp: jest.fn(),
        downloadSource: jest.fn(),
    });

    const createMediaEventHelper = ({
        encrypted = true,
        thumbnailUrl = "blob:thumbnail",
        sourceUrl = "blob:source",
        sourceBlob = new Blob(["image"], { type: "image/jpeg" }),
    }: {
        encrypted?: boolean;
        thumbnailUrl?: string | null | Promise<string | null>;
        sourceUrl?: string | null | Promise<string | null>;
        sourceBlob?: Blob | Promise<Blob>;
    } = {}): MediaEventHelper =>
        ({
            media: { isEncrypted: encrypted },
            thumbnailUrl: { value: Promise.resolve(thumbnailUrl) },
            sourceUrl: { value: Promise.resolve(sourceUrl) },
            sourceBlob: { value: Promise.resolve(sourceBlob), cachedValue: sourceBlob },
        }) as unknown as MediaEventHelper;

    const props = {
        mxEvent: createEvent(),
        mediaVisible: true,
        setMediaVisible: jest.fn(),
        onMessageAllowed: jest.fn(),
        permalinkCreator: new RoomPermalinkCreator(new Room("!room:server", cli, cli.getUserId()!)),
    };

    const renderBase = ({
        timelineRenderingType = TimelineRenderingType.Room,
        overrides = {},
    }: {
        timelineRenderingType?: TimelineRenderingType;
        overrides?: Partial<React.ComponentProps<typeof ImageBodyBaseInner>>;
    } = {}) => {
        const ref = createRef<ImageBodyBaseInner>();
        const result = render(
            <RoomContext.Provider value={{ timelineRenderingType } as any}>
                <ImageBodyBaseInner ref={ref} {...props} {...overrides} />
            </RoomContext.Provider>,
        );
        return { ...result, ref };
    };

    beforeEach(() => {
        jest.clearAllMocks();
        Object.defineProperty(window, "devicePixelRatio", {
            configurable: true,
            value: 1,
        });
        mockedMediaFromContent.mockImplementation((content: Record<string, any>) => createMockMedia(content) as any);
        mockedUseMediaVisible.mockReturnValue([true, jest.fn()]);
        mockedBlobIsAnimated.mockResolvedValue(true);
        mockedCreateThumbnail.mockResolvedValue({ thumbnail: new Blob(["thumbnail"], { type: "image/jpeg" }) } as any);
        jest.spyOn(SettingsStore, "getValue").mockImplementation(((setting, ...args) => {
            if (setting === "Images.size") return ImageSize.Normal;
            if (setting === "autoplayGifs") return false;
            return (originalGetValue as any)(setting, ...args);
        }) as typeof SettingsStore.getValue);
        jest.spyOn(SettingsStore, "watchSetting").mockReturnValue("image-reply-watch");
        jest.spyOn(SettingsStore, "unwatchSetting").mockImplementation(jest.fn());
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("renders a visible unencrypted image and file fallback outside room timelines", async () => {
        const { container } = renderBase({ timelineRenderingType: TimelineRenderingType.Notification });

        await waitFor(() => expect(screen.getAllByRole("img", { name: "demo image" })).toHaveLength(2));

        expect(container.querySelector(".mx_MImageBody")).not.toBeNull();
        expect(container.querySelector(".mx_MFileBody")).not.toBeNull();
        expect(container.querySelector("a[href='https://server/full.png']")).not.toBeNull();
        expect(container.querySelector("img.mx_MImageBody_thumbnail")).toHaveAttribute(
            "src",
            "https://server/thumb.png",
        );
        expect(screen.getByRole("link", { name: /Download/ })).toBeInTheDocument();
    });

    it("reveals hidden media through the supplied setter", () => {
        const setMediaVisible = jest.fn();
        renderBase({
            overrides: {
                mediaVisible: false,
                setMediaVisible,
            },
        });

        fireEvent.click(screen.getByRole("button", { name: "Show image" }));

        expect(setMediaVisible).toHaveBeenCalledWith(true);
    });

    it("opens the image viewer with thumbnail geometry", async () => {
        const { container } = renderBase();
        await waitFor(() => expect(screen.getByRole("img", { name: "demo image" })).toBeInTheDocument());
        const image = container.querySelector("img.mx_MImageBody_thumbnail") as HTMLImageElement;
        image.getBoundingClientRect = () => ({ width: 100, height: 80, x: 10, y: 20 }) as DOMRect;
        jest.spyOn(Modal, "createDialog").mockReturnValue({} as any);

        fireEvent.click(screen.getByRole("link", { name: "demo image" }), { button: 0 });

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

    it("updates load dimensions and toggles hover/focus banner state", async () => {
        const { container, ref } = renderBase();
        await waitFor(() => expect(screen.getByRole("img", { name: "demo image" })).toBeInTheDocument());
        const image = container.querySelector("img.mx_MImageBody_thumbnail") as HTMLImageElement;
        Object.defineProperty(image, "naturalWidth", { configurable: true, value: 640 });
        Object.defineProperty(image, "naturalHeight", { configurable: true, value: 480 });

        act(() => {
            ref.current!["onImageLoad"]();
            ref.current!.setState({ isAnimated: true, imgLoaded: true });
        });
        expect(ref.current!.state.loadedImageDimensions).toEqual({ naturalWidth: 640, naturalHeight: 480 });

        fireEvent.mouseEnter(image);
        expect(ref.current!.state.hover).toBe(true);
        expect(container.querySelector(".mx_MImageBody_banner")).not.toBeNull();
        expect(image).toHaveAttribute("src", "https://server/full.png");

        fireEvent.mouseLeave(image);
        expect(ref.current!.state.hover).toBe(false);

        const link = screen.getByRole("link", { name: /demo image/ });
        fireEvent.focus(link);
        expect(ref.current!.state.focus).toBe(true);
        fireEvent.blur(link);
        expect(ref.current!.state.focus).toBe(false);
    });

    it("uses the decrypted thumbnail in the image viewer when the source mime type is unsafe", async () => {
        renderBase({
            overrides: {
                mxEvent: createEvent({
                    body: "unsafe image",
                    content: {
                        file: { url: "mxc://server/encrypted-image" },
                        url: undefined,
                        info: {
                            mimetype: "image/svg+xml",
                            thumbnail_info: { mimetype: "image/jpeg" },
                        },
                    },
                }),
                mediaEventHelper: createMediaEventHelper({
                    sourceUrl: "blob:unsafe-source",
                    thumbnailUrl: "blob:safe-thumbnail",
                    sourceBlob: new Blob(["html"], { type: "text/html" }),
                }),
            },
        });
        jest.spyOn(Modal, "createDialog").mockReturnValue({} as any);
        await waitFor(() => expect(screen.getByRole("img", { name: "unsafe image" })).toBeInTheDocument());

        fireEvent.click(screen.getByRole("link", { name: "unsafe image" }), { button: 0 });

        expect(Modal.createDialog).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({
                src: "blob:safe-thumbnail",
                name: "unsafe image",
            }),
            "mx_Dialog_lightbox",
            undefined,
            true,
        );
    });

    it("falls back from thumbnail errors and clears image errors after reconnecting", async () => {
        const onSpy = jest.spyOn(cli, "on");
        const offSpy = jest.spyOn(cli, "off");
        const { ref } = renderBase();
        await waitFor(() => expect(ref.current!.state.thumbUrl).toBe("https://server/thumb.png"));

        act(() => {
            ref.current!["onImageError"]();
        });
        expect(ref.current!.state.thumbUrl).toBeNull();

        act(() => {
            ref.current!["onImageError"]();
        });
        expect(ref.current!.state.imgError).toBe(true);
        expect(onSpy).toHaveBeenCalledWith(ClientEvent.Sync, expect.any(Function));

        const listener = onSpy.mock.calls.at(-1)![1] as (...args: unknown[]) => void;
        act(() => {
            listener(SyncState.Syncing, SyncState.Error);
        });

        expect(offSpy).toHaveBeenCalledWith(ClientEvent.Sync, listener);
        expect(ref.current!.state.imgError).toBe(false);
    });

    it.each([
        [new DecryptError(new Error("decrypt failed")), "Error decrypting image"],
        [new DownloadError(new Error("download failed")), "Error downloading image"],
        [new Error("display failed"), "Unable to show image due to error"],
    ])("renders media processing errors for %s", async (error, label) => {
        const { container, ref } = renderBase();

        act(() => {
            ref.current!.setState({ error });
        });

        expect(container.querySelector(".mx_MImageBody")).not.toBeNull();
        expect(screen.getByText(label)).toBeInTheDocument();
    });

    it.each([
        [new DecryptError(new Error("decrypt failed")), "Error decrypting image"],
        [new DownloadError(new Error("download failed")), "Error downloading image"],
        [new Error("download failed"), "Unable to show image due to error"],
    ])("renders encrypted download failures for %s", async (error, label) => {
        renderBase({
            overrides: {
                mxEvent: createEvent({
                    content: {
                        file: { url: "mxc://server/encrypted-image" },
                        url: undefined,
                    },
                }),
                mediaEventHelper: createMediaEventHelper({
                    sourceUrl: Promise.reject(error),
                }),
            },
        });

        await waitFor(() => expect(screen.getByText(label)).toBeInTheDocument());
    });

    it("renders export images directly from the event MXC URL", () => {
        renderBase({
            overrides: {
                forExport: true,
                mxEvent: createEvent({
                    content: {
                        url: undefined,
                        file: { url: "mxc://server/encrypted-image" },
                    },
                }),
            },
        });

        expect(screen.getByRole("link", { name: "demo image" })).toHaveAttribute(
            "href",
            "mxc://server/encrypted-image",
        );
        expect(screen.getByRole("link", { name: "demo image" })).toHaveAttribute("target", "_blank");
        expect(screen.queryByRole("link", { name: /Download/ })).toBeNull();
    });

    it("switches blurhash placeholders on after the delay", () => {
        jest.useFakeTimers();
        const { container } = renderBase({
            overrides: {
                mxEvent: createEvent({
                    content: {
                        info: {
                            [BLURHASH_FIELD]: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
                        },
                    },
                }),
            },
        });

        expect(container.querySelector(".mx_Blurhash")).toBeNull();

        act(() => {
            jest.advanceTimersByTime(150);
        });

        expect(container.querySelector(".mx_Blurhash")).not.toBeNull();
    });

    it("downloads media when visibility changes after mount", async () => {
        const ref = createRef<ImageBodyBaseInner>();
        const mxEvent = createEvent();
        const { rerender } = render(
            <RoomContext.Provider value={{ timelineRenderingType: TimelineRenderingType.Room } as any}>
                <ImageBodyBaseInner
                    ref={ref}
                    {...props}
                    mxEvent={mxEvent}
                    mediaVisible={false}
                    setMediaVisible={jest.fn()}
                />
            </RoomContext.Provider>,
        );

        expect(ref.current!.state.contentUrl).toBeNull();

        rerender(
            <RoomContext.Provider value={{ timelineRenderingType: TimelineRenderingType.Room } as any}>
                <ImageBodyBaseInner
                    ref={ref}
                    {...props}
                    mxEvent={mxEvent}
                    mediaVisible={true}
                    setMediaVisible={jest.fn()}
                />
            </RoomContext.Provider>,
        );

        await waitFor(() => expect(ref.current!.state.contentUrl).toBe("https://server/full.png"));
    });

    it("renders missing-size media after loading natural dimensions", async () => {
        const { container, ref } = renderBase({
            overrides: {
                mxEvent: createEvent({ content: { info: null } }),
            },
        });
        await waitFor(() => expect(container.querySelector("img[style*='display: none']")).not.toBeNull());
        const image = container.querySelector("img[style*='display: none']") as HTMLImageElement;
        Object.defineProperty(image, "naturalWidth", { configurable: true, value: 640 });
        Object.defineProperty(image, "naturalHeight", { configurable: true, value: 480 });

        act(() => {
            ref.current!["onImageLoad"]();
        });

        expect(ref.current!.state.loadedImageDimensions).toEqual({ naturalWidth: 640, naturalHeight: 480 });
        expect(container.querySelector(".mx_MImageBody_thumbnail_container")).not.toBeNull();
    });

    it("generates a static thumbnail for animated images without a safe thumbnail", async () => {
        let createdImage: any;
        const originalCreateElement = document.createElement.bind(document);
        const createElementSpy = jest.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
            if (tagName !== "img") {
                return originalCreateElement(tagName);
            }
            createdImage = originalCreateElement(tagName) as HTMLImageElement;
            Object.defineProperty(createdImage, "width", { configurable: true, value: 320 });
            Object.defineProperty(createdImage, "height", { configurable: true, value: 240 });
            return createdImage;
        }) as typeof document.createElement);
        const { ref } = renderBase({
            overrides: {
                mxEvent: createEvent({
                    content: {
                        file: { url: "mxc://server/encrypted-image" },
                        url: undefined,
                        info: {
                            "mimetype": "image/gif",
                            "thumbnail_info": { mimetype: "image/gif" },
                            "org.matrix.msc4230.is_animated": true,
                        },
                    },
                }),
                mediaEventHelper: createMediaEventHelper({
                    sourceUrl: "blob:animated-source",
                    thumbnailUrl: null,
                    sourceBlob: new Blob(["gif"], { type: "image/gif" }),
                }),
            },
        });

        await waitFor(() => expect(createdImage).toBeDefined());
        await act(async () => {
            createdImage.onload();
            await Promise.resolve();
        });

        await waitFor(() => expect(ref.current!.state.thumbUrl).toBe("blob"));
        expect(mockedBlobIsAnimated).toHaveBeenCalled();
        expect(mockedCreateThumbnail).toHaveBeenCalledWith(expect.any(HTMLImageElement), 320, 240, "image/gif", false);
        expect(ref.current!.state.isAnimated).toBe(true);
        createElementSpy.mockRestore();
    });

    it("uses SVG thumbnails when available", async () => {
        const { ref } = renderBase({
            overrides: {
                mxEvent: createEvent({
                    content: {
                        info: {
                            mimetype: "image/svg+xml",
                            thumbnail_url: "mxc://server/thumb",
                        },
                    },
                }),
            },
        });

        await waitFor(() => expect(ref.current!.state.thumbUrl).toBe("https://server/thumb.png"));

        expect(
            mockedMediaFromContent.mock.results.some((result: any) =>
                result.value.getThumbnailHttp.mock.calls.some(
                    (call: unknown[]) => call[0] === 800 && call[1] === 600 && call[2] === "scale",
                ),
            ),
        ).toBe(true);
    });

    it("uses the full source as thumbnail for small high-dpi images", async () => {
        Object.defineProperty(window, "devicePixelRatio", {
            configurable: true,
            value: 2,
        });

        const { ref } = renderBase();

        await waitFor(() => expect(ref.current!.state.thumbUrl).toBe("https://server/full.png"));
    });

    it("renders the file body instead of unsafe encrypted images without thumbnails", () => {
        renderBase({
            overrides: {
                mxEvent: createEvent({
                    content: {
                        file: { url: "mxc://server/encrypted-file" },
                        url: undefined,
                        info: {
                            mimetype: "text/html",
                        },
                    },
                }),
                mediaEventHelper: {
                    media: { isEncrypted: true },
                    sourceUrl: { value: Promise.resolve("blob:source") },
                    thumbnailUrl: { value: Promise.resolve(null) },
                    sourceBlob: {
                        value: Promise.resolve(new Blob(["html"], { type: "text/html" })),
                        cachedValue: new Blob(["html"], { type: "text/html" }),
                    },
                } as unknown as MediaEventHelper,
                mediaVisible: false,
            },
        });

        expect(screen.getByRole("button", { name: /demo image/ })).toBeInTheDocument();
        expect(screen.queryByRole("img", { name: "demo image" })).toBeNull();
    });

    it("renders the compact reply body through the hook wrapper", async () => {
        const setMediaVisible = jest.fn();
        mockedUseMediaVisible.mockReturnValue([true, setMediaVisible]);

        const { container } = render(<MImageReplyBody {...props} />);

        await waitFor(() => expect(container.querySelector(".mx_MImageReplyBody")).not.toBeNull());
        expect(screen.getByRole("img", { name: "demo image" })).toBeInTheDocument();
    });

    it("cleans up settings watchers, listeners and generated animated thumbnails on unmount", async () => {
        const offSpy = jest.spyOn(cli, "off");
        const { ref, unmount } = renderBase();
        await waitFor(() => expect(ref.current).not.toBeNull());

        act(() => {
            ref.current!.setState({
                isAnimated: true,
                thumbUrl: "blob:animated-thumbnail",
            });
        });

        unmount();

        expect(SettingsStore.unwatchSetting).toHaveBeenCalledWith("image-reply-watch");
        expect(offSpy).toHaveBeenCalledWith(ClientEvent.Sync, expect.any(Function));
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:animated-thumbnail");
    });
});
