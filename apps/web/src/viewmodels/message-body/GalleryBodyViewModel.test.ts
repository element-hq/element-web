/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { type MouseEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { EventType, MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import {
    GALLERY_BODY_MAX_TILES,
    GalleryBodyViewItemState,
    GalleryBodyViewState,
} from "@element-hq/web-shared-components";
import { stubClient } from "test-utils";

import Modal from "../../Modal";
import { GalleryMedia } from "../../utils/GalleryMedia";
import { type GalleryItem } from "../../utils/gallery";
import { BLURHASH_FIELD } from "../../utils/image-media";
import { type RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";
import { GalleryImageView } from "../../components/views/elements/GalleryImageView";
import { GalleryBodyViewModel, type GalleryBodyViewModelProps } from "./GalleryBodyViewModel";

describe("GalleryBodyViewModel", () => {
    let getThumbnailUrl: MockInstance<GalleryMedia["getThumbnailUrl"]>;
    let destroy: MockInstance<GalleryMedia["destroy"]>;

    const image = (name: string, extra: Record<string, unknown> = {}): GalleryItem =>
        ({ itemtype: "m.image", body: `${name}.png`, url: `mxc://server/${name}`, ...extra }) as GalleryItem;

    const video = (name: string, info: Record<string, unknown> = {}): GalleryItem =>
        ({ itemtype: "m.video", body: `${name}.mp4`, url: `mxc://server/${name}`, info }) as GalleryItem;

    const images = (count: number): GalleryItem[] => Array.from({ length: count }, (_, index) => image(`item${index}`));

    const galleryContent = (itemtypes: unknown[], body = ""): Record<string, unknown> => ({
        msgtype: "dm.filament.gallery",
        body,
        itemtypes,
    });

    const createEvent = (itemtypes: unknown[], eventId = "$gallery:server"): MatrixEvent =>
        new MatrixEvent({
            type: EventType.RoomMessage,
            room_id: "!room:server",
            event_id: eventId,
            sender: "@alice:server",
            content: galleryContent(itemtypes),
        });

    /** Apply an edit to the event, as the js-sdk does when one arrives. */
    const editEvent = (mxEvent: MatrixEvent, itemtypes: unknown[]): void => {
        mxEvent.makeReplaced(
            new MatrixEvent({
                type: EventType.RoomMessage,
                room_id: "!room:server",
                event_id: `$edit${Math.random()}:server`,
                sender: "@alice:server",
                content: {
                    "msgtype": "m.text",
                    "body": "* edited",
                    "m.new_content": galleryContent(itemtypes),
                    "m.relates_to": { rel_type: "m.replace", event_id: mxEvent.getId() },
                },
            }),
        );
    };

    const createVm = (overrides: Partial<GalleryBodyViewModelProps> = {}): GalleryBodyViewModel =>
        new GalleryBodyViewModel({
            mxEvent: createEvent(images(2)),
            mediaVisible: true,
            ...overrides,
        });

    const flushPromises = async (): Promise<void> => {
        for (let i = 0; i < 5; i++) await Promise.resolve();
    };

    const clickEvent = (rect: Partial<DOMRect> = {}): MouseEvent<HTMLButtonElement> =>
        ({
            currentTarget: {
                getBoundingClientRect: () => ({ x: 10, y: 20, width: 30, height: 40, ...rect }),
            },
        }) as unknown as MouseEvent<HTMLButtonElement>;

    beforeEach(() => {
        stubClient();
        // The thumbnail of an item is named after the item, so tests can tell them apart.
        getThumbnailUrl = vi.spyOn(GalleryMedia.prototype, "getThumbnailUrl").mockImplementation(async function (
            this: GalleryMedia,
        ) {
            return `thumb:${this.mxc}`;
        });
        destroy = vi.spyOn(GalleryMedia.prototype, "destroy");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("snapshot", () => {
        it("describes every item of a small gallery", () => {
            const vm = createVm({ mxEvent: createEvent([image("a"), video("b")]) });

            expect(vm.getSnapshot()).toEqual({
                state: GalleryBodyViewState.READY,
                label: "Gallery with 2 items",
                items: [
                    {
                        id: "mxc://server/a",
                        type: "image",
                        state: GalleryBodyViewItemState.LOADING,
                        label: "Image 1 of 2",
                        src: undefined,
                        blurhash: undefined,
                        durationLabel: undefined,
                    },
                    {
                        id: "mxc://server/b",
                        type: "video",
                        state: GalleryBodyViewItemState.LOADING,
                        label: "Video 2 of 2",
                        src: undefined,
                        blurhash: undefined,
                        durationLabel: undefined,
                    },
                ],
                moreCount: 0,
                hiddenButtonLabel: "Show gallery",
                maxWidth: undefined,
            });
        });

        it("only gives a tile to the first items of a large gallery and counts the rest", () => {
            const vm = createVm({ mxEvent: createEvent(images(GALLERY_BODY_MAX_TILES + 7)) });

            const snapshot = vm.getSnapshot();
            expect(snapshot.items).toHaveLength(GALLERY_BODY_MAX_TILES);
            expect(snapshot.moreCount).toBe(7);
            expect(snapshot.label).toBe(`Gallery with ${GALLERY_BODY_MAX_TILES + 7} items`);
            expect(snapshot.items.at(-1)!.label).toBe(
                `Image ${GALLERY_BODY_MAX_TILES} of ${GALLERY_BODY_MAX_TILES + 7}`,
            );
        });

        it("leaves out items which cannot be displayed", () => {
            const vm = createVm({
                mxEvent: createEvent([
                    image("a"),
                    { itemtype: "m.file", body: "doc.pdf", url: "mxc://server/doc" },
                    { itemtype: "m.image", body: "no-media.png" },
                ]),
            });

            expect(vm.getSnapshot().items.map((item) => item.id)).toEqual(["mxc://server/a"]);
            expect(vm.getSnapshot().label).toBe("Gallery with 1 item");
        });

        it("has no items for a gallery which has not been decrypted yet", () => {
            const vm = createVm({ mxEvent: createEvent(undefined as unknown as unknown[]) });

            expect(vm.getSnapshot().items).toEqual([]);
            expect(vm.getSnapshot().moreCount).toBe(0);
        });

        it("formats the duration of a video", () => {
            const vm = createVm({
                mxEvent: createEvent([video("short", { duration: 5_000 }), video("long", { duration: 3_725_000 })]),
            });

            expect(vm.getSnapshot().items.map((item) => item.durationLabel)).toEqual(["0:05", "01:02:05"]);
        });

        it("has no duration for an image, or for a video which does not state one", () => {
            const vm = createVm({
                mxEvent: createEvent([image("a", { info: { duration: 5_000 } }), video("b", { duration: "long" })]),
            });

            expect(vm.getSnapshot().items.map((item) => item.durationLabel)).toEqual([undefined, undefined]);
        });

        it("passes on the blurhash of an item", () => {
            const vm = createVm({
                mxEvent: createEvent([image("a", { info: { [BLURHASH_FIELD]: "LEHV6nWB2yk8" } }), image("b")]),
            });

            expect(vm.getSnapshot().items.map((item) => item.blurhash)).toEqual(["LEHV6nWB2yk8", undefined]);
        });

        it("gives items which appear twice different ids", () => {
            const vm = createVm({ mxEvent: createEvent([image("a"), image("a"), image("a")]) });

            expect(vm.getSnapshot().items.map((item) => item.id)).toEqual([
                "mxc://server/a",
                "mxc://server/a#1",
                "mxc://server/a#2",
            ]);
        });

        it("limits the width of the grid to fit a maximum height", () => {
            const vm = createVm({ maxImageHeight: 96 });
            expect(vm.getSnapshot().maxWidth).toBe(144);

            vm.setMaxImageHeight(101);
            expect(vm.getSnapshot().maxWidth).toBe(152);

            vm.setMaxImageHeight(undefined);
            expect(vm.getSnapshot().maxWidth).toBeUndefined();
        });

        it("does not notify when the maximum height stays the same", () => {
            const vm = createVm({ maxImageHeight: 96 });
            const listener = vi.fn();
            vm.subscribe(listener);

            vm.setMaxImageHeight(96);

            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe("thumbnails", () => {
        it("does not load anything until asked to", async () => {
            createVm();
            await flushPromises();

            expect(getThumbnailUrl).not.toHaveBeenCalled();
        });

        it("shows the thumbnail of each tile once it has loaded", async () => {
            const vm = createVm({ mxEvent: createEvent([image("a"), video("b")]) });
            const listener = vi.fn();
            vm.subscribe(listener);

            vm.loadThumbnailsIfVisible();
            await flushPromises();

            expect(vm.getSnapshot().items).toMatchObject([
                { state: GalleryBodyViewItemState.READY, src: "thumb:mxc://server/a", label: "Image 1 of 2" },
                { state: GalleryBodyViewItemState.READY, src: "thumb:mxc://server/b", label: "Video 2 of 2" },
            ]);
            expect(listener).toHaveBeenCalled();
        });

        it("shows a video without a thumbnail as ready, with nothing to display", async () => {
            getThumbnailUrl.mockResolvedValue(null);
            const vm = createVm({ mxEvent: createEvent([video("a")]) });

            vm.loadThumbnailsIfVisible();
            await flushPromises();

            expect(vm.getSnapshot().items[0]).toMatchObject({ state: GalleryBodyViewItemState.READY, src: undefined });
        });

        it("only loads the thumbnails of the items which have a tile", async () => {
            const vm = createVm({ mxEvent: createEvent(images(GALLERY_BODY_MAX_TILES + 3)) });

            vm.loadThumbnailsIfVisible();
            await flushPromises();

            expect(getThumbnailUrl).toHaveBeenCalledTimes(GALLERY_BODY_MAX_TILES);
        });

        it("loads each thumbnail once, however often it is asked to", async () => {
            const vm = createVm();

            vm.loadThumbnailsIfVisible();
            vm.loadThumbnailsIfVisible();
            await flushPromises();
            vm.loadThumbnailsIfVisible();
            await flushPromises();

            expect(getThumbnailUrl).toHaveBeenCalledTimes(2);
        });

        it("marks a tile whose thumbnail cannot be loaded as failed, and keeps the others", async () => {
            getThumbnailUrl.mockImplementation(async function (this: GalleryMedia) {
                if (this.mxc.endsWith("/b")) throw new Error("decryption failed");
                return `thumb:${this.mxc}`;
            });
            const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
            const vm = createVm({ mxEvent: createEvent([image("a"), image("b"), video("c")]) });

            vm.loadThumbnailsIfVisible();
            await flushPromises();

            expect(vm.getSnapshot().items).toMatchObject([
                { state: GalleryBodyViewItemState.READY, src: "thumb:mxc://server/a" },
                { state: GalleryBodyViewItemState.ERROR, src: undefined, label: "Image 2 of 3 (failed to load)" },
                { state: GalleryBodyViewItemState.READY, src: "thumb:mxc://server/c" },
            ]);
            expect(warn).toHaveBeenCalledTimes(1);
        });

        it("marks a tile as failed when the view cannot display its thumbnail", async () => {
            const vm = createVm({ mxEvent: createEvent([image("a"), video("b")]) });
            vm.loadThumbnailsIfVisible();
            await flushPromises();

            vm.onItemError("mxc://server/b");

            expect(vm.getSnapshot().items).toMatchObject([
                { state: GalleryBodyViewItemState.READY, label: "Image 1 of 2" },
                { state: GalleryBodyViewItemState.ERROR, label: "Video 2 of 2 (failed to load)" },
            ]);
        });

        it("ignores a display error for a tile which already failed, or which it does not know", async () => {
            const vm = createVm();
            vm.onItemError("mxc://server/item0");
            const listener = vi.fn();
            vm.subscribe(listener);

            vm.onItemError("mxc://server/item0");
            vm.onItemError("mxc://server/unknown");

            expect(listener).not.toHaveBeenCalled();
        });

        it("does not touch the snapshot when a thumbnail arrives after disposal", async () => {
            const vm = createVm();
            const listener = vi.fn();
            vm.subscribe(listener);

            vm.loadThumbnailsIfVisible();
            vm.dispose();
            await flushPromises();

            expect(listener).not.toHaveBeenCalled();
            expect(vm.getSnapshot().items[0].state).toBe(GalleryBodyViewItemState.LOADING);
        });
    });

    describe("hidden media", () => {
        it("is hidden, and loads nothing, while the media is not visible", async () => {
            const vm = createVm({ mediaVisible: false });

            vm.loadThumbnailsIfVisible();
            await flushPromises();

            expect(vm.getSnapshot().state).toBe(GalleryBodyViewState.HIDDEN);
            expect(vm.getSnapshot().hiddenButtonLabel).toBe("Show gallery");
            expect(getThumbnailUrl).not.toHaveBeenCalled();
        });

        it("asks for the media to be shown when the user reveals it", () => {
            const setMediaVisible = vi.fn();
            const vm = createVm({ mediaVisible: false, setMediaVisible });

            vm.onHiddenButtonClick();

            expect(setMediaVisible).toHaveBeenCalledWith(true);
        });

        it("uses the latest callback to reveal the media", () => {
            const first = vi.fn();
            const second = vi.fn();
            const vm = createVm({ mediaVisible: false, setMediaVisible: first });

            vm.setSetMediaVisible(second);
            vm.onHiddenButtonClick();

            expect(first).not.toHaveBeenCalled();
            expect(second).toHaveBeenCalledWith(true);
        });

        it("does nothing on reveal when there is no callback", () => {
            const vm = createVm({ mediaVisible: false });

            expect(() => vm.onHiddenButtonClick()).not.toThrow();
        });

        it("loads the thumbnails once the media becomes visible", async () => {
            const vm = createVm({ mediaVisible: false });

            vm.setMediaVisible(true);
            await flushPromises();

            expect(vm.getSnapshot().state).toBe(GalleryBodyViewState.READY);
            expect(vm.getSnapshot().items).toMatchObject([
                { state: GalleryBodyViewItemState.READY, src: "thumb:mxc://server/item0" },
                { state: GalleryBodyViewItemState.READY, src: "thumb:mxc://server/item1" },
            ]);
        });

        it("hides the tiles again without forgetting their thumbnails", async () => {
            const vm = createVm();
            vm.loadThumbnailsIfVisible();
            await flushPromises();

            vm.setMediaVisible(false);
            expect(vm.getSnapshot().state).toBe(GalleryBodyViewState.HIDDEN);

            vm.setMediaVisible(true);
            await flushPromises();
            expect(vm.getSnapshot().items[0].src).toBe("thumb:mxc://server/item0");
            expect(getThumbnailUrl).toHaveBeenCalledTimes(2);
        });

        it("does not notify when the visibility stays the same", () => {
            const vm = createVm();
            const listener = vi.fn();
            vm.subscribe(listener);

            vm.setMediaVisible(true);

            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe("opening the viewer", () => {
        it("opens the viewer on the clicked item, growing out of its tile", () => {
            vi.spyOn(Modal, "createDialog").mockReturnValue({} as any);
            const mxEvent = createEvent(images(3));
            const permalinkCreator = {} as RoomPermalinkCreator;
            const vm = createVm({ mxEvent, permalinkCreator });

            vm.onItemClick("mxc://server/item1", clickEvent());

            expect(Modal.createDialog).toHaveBeenCalledTimes(1);
            expect(Modal.createDialog).toHaveBeenCalledWith(
                GalleryImageView,
                {
                    mxEvent,
                    initialIndex: 1,
                    permalinkCreator,
                    thumbnailInfo: { positionX: 10, positionY: 20, width: 30, height: 40 },
                },
                "mx_Dialog_lightbox",
                undefined,
                true,
            );
        });

        it("counts displayable items only when working out which item was clicked", () => {
            vi.spyOn(Modal, "createDialog").mockReturnValue({} as any);
            const vm = createVm({
                mxEvent: createEvent([
                    { itemtype: "m.file", body: "doc.pdf", url: "mxc://server/doc" },
                    image("a"),
                    image("b"),
                ]),
            });

            vm.onItemClick("mxc://server/b", clickEvent());

            expect(vi.mocked(Modal.createDialog).mock.calls[0][1]).toMatchObject({ initialIndex: 1 });
        });

        it("uses the latest permalink creator", () => {
            vi.spyOn(Modal, "createDialog").mockReturnValue({} as any);
            const permalinkCreator = {} as RoomPermalinkCreator;
            const vm = createVm();

            vm.setPermalinkCreator(permalinkCreator);
            vm.onItemClick("mxc://server/item0", clickEvent());

            expect(vi.mocked(Modal.createDialog).mock.calls[0][1]).toMatchObject({ permalinkCreator, initialIndex: 0 });
        });

        it("ignores a click on an item it does not know", () => {
            vi.spyOn(Modal, "createDialog").mockReturnValue({} as any);
            const vm = createVm();

            vm.onItemClick("mxc://server/unknown", clickEvent());

            expect(Modal.createDialog).not.toHaveBeenCalled();
        });
    });

    describe("when the gallery is edited", () => {
        it("shows the items of the edit, keeping the thumbnails it already loaded", async () => {
            const mxEvent = createEvent([image("a"), image("b")]);
            const vm = createVm({ mxEvent });
            vm.loadThumbnailsIfVisible();
            await flushPromises();
            getThumbnailUrl.mockClear();

            editEvent(mxEvent, [image("b"), image("c")]);

            // The kept item has its thumbnail straight away, the new one is loading.
            expect(vm.getSnapshot().label).toBe("Gallery with 2 items");
            expect(vm.getSnapshot().items).toMatchObject([
                { id: "mxc://server/b", state: GalleryBodyViewItemState.READY, src: "thumb:mxc://server/b" },
                { id: "mxc://server/c", state: GalleryBodyViewItemState.LOADING, src: undefined },
            ]);
            // The position in the label follows the edit.
            expect(vm.getSnapshot().items[0].label).toBe("Image 1 of 2");

            await flushPromises();

            expect(vm.getSnapshot().items[1]).toMatchObject({
                state: GalleryBodyViewItemState.READY,
                src: "thumb:mxc://server/c",
            });
            // Only the new item was loaded.
            expect(getThumbnailUrl).toHaveBeenCalledTimes(1);
            expect(getThumbnailUrl.mock.contexts[0]).toMatchObject({ mxc: "mxc://server/c" });
        });

        it("releases the media of the items which were removed, and no others", async () => {
            const mxEvent = createEvent([image("a"), image("b")]);
            const vm = createVm({ mxEvent });
            vm.loadThumbnailsIfVisible();
            await flushPromises();
            // The media in use is whatever the thumbnails were loaded through.
            const [mediaA, mediaB] = getThumbnailUrl.mock.contexts as GalleryMedia[];
            destroy.mockClear();

            editEvent(mxEvent, [image("b")]);

            expect(destroy.mock.contexts).toContain(mediaA);
            expect(destroy.mock.contexts).not.toContain(mediaB);
        });

        it("loads the thumbnail of an item which gets a tile because another was removed", async () => {
            const items = images(GALLERY_BODY_MAX_TILES + 1);
            const mxEvent = createEvent(items);
            const vm = createVm({ mxEvent });
            vm.loadThumbnailsIfVisible();
            await flushPromises();
            expect(vm.getSnapshot().moreCount).toBe(1);

            editEvent(mxEvent, items.slice(1));
            await flushPromises();

            const snapshot = vm.getSnapshot();
            expect(snapshot.moreCount).toBe(0);
            expect(snapshot.items.at(-1)).toMatchObject({
                id: `mxc://server/item${GALLERY_BODY_MAX_TILES}`,
                state: GalleryBodyViewItemState.READY,
                src: `thumb:mxc://server/item${GALLERY_BODY_MAX_TILES}`,
            });
        });

        it("does not load thumbnails for an edit while the media is hidden", async () => {
            const mxEvent = createEvent([image("a")]);
            const vm = createVm({ mxEvent, mediaVisible: false });

            editEvent(mxEvent, [image("a"), image("b")]);
            await flushPromises();

            expect(vm.getSnapshot().items).toHaveLength(2);
            expect(getThumbnailUrl).not.toHaveBeenCalled();
        });

        it("ignores a thumbnail which arrives for an item the edit removed", async () => {
            let resolveA: (url: string) => void = () => {};
            getThumbnailUrl.mockImplementation(function (this: GalleryMedia) {
                if (this.mxc.endsWith("/a")) return new Promise((resolve) => (resolveA = resolve));
                return Promise.resolve(`thumb:${this.mxc}`);
            });
            const mxEvent = createEvent([image("a"), image("b")]);
            const vm = createVm({ mxEvent });
            vm.loadThumbnailsIfVisible();
            await flushPromises();

            editEvent(mxEvent, [image("b")]);
            const listener = vi.fn();
            vm.subscribe(listener);
            resolveA("thumb:late");
            await flushPromises();

            expect(listener).not.toHaveBeenCalled();
            expect(vm.getSnapshot().items).toMatchObject([{ id: "mxc://server/b", src: "thumb:mxc://server/b" }]);
        });

        it("shows the items once the event has been decrypted", async () => {
            const mxEvent = createEvent(undefined as unknown as unknown[]);
            const vm = createVm({ mxEvent });
            vm.loadThumbnailsIfVisible();
            expect(vm.getSnapshot().items).toEqual([]);

            vi.spyOn(mxEvent, "getContent").mockReturnValue(galleryContent([image("a")]));
            mxEvent.emit(MatrixEventEvent.Decrypted, mxEvent);
            await flushPromises();

            expect(vm.getSnapshot().items).toMatchObject([
                { id: "mxc://server/a", state: GalleryBodyViewItemState.READY, src: "thumb:mxc://server/a" },
            ]);
        });
    });

    describe("setEvent", () => {
        it("shows the items of the new event and follows its edits instead of the old one's", async () => {
            const first = createEvent([image("a")], "$first:server");
            const second = createEvent([image("b"), image("c")], "$second:server");
            const vm = createVm({ mxEvent: first });
            vm.loadThumbnailsIfVisible();
            await flushPromises();

            vm.setEvent(second);
            await flushPromises();

            expect(vm.getSnapshot().items).toMatchObject([
                { id: "mxc://server/b", state: GalleryBodyViewItemState.READY, src: "thumb:mxc://server/b" },
                { id: "mxc://server/c", state: GalleryBodyViewItemState.READY, src: "thumb:mxc://server/c" },
            ]);
            expect(first.listenerCount(MatrixEventEvent.Replaced)).toBe(0);
            expect(first.listenerCount(MatrixEventEvent.Decrypted)).toBe(0);

            editEvent(first, [image("x")]);
            expect(vm.getSnapshot().items.map((item) => item.id)).toEqual(["mxc://server/b", "mxc://server/c"]);

            editEvent(second, [image("c")]);
            expect(vm.getSnapshot().items.map((item) => item.id)).toEqual(["mxc://server/c"]);
        });

        it("opens the viewer for the new event", () => {
            vi.spyOn(Modal, "createDialog").mockReturnValue({} as any);
            const second = createEvent([image("b")], "$second:server");
            const vm = createVm();

            vm.setEvent(second);
            vm.onItemClick("mxc://server/b", clickEvent());

            expect(vi.mocked(Modal.createDialog).mock.calls[0][1]).toMatchObject({ mxEvent: second });
        });

        it("does nothing when given the event it already has", () => {
            const mxEvent = createEvent(images(2));
            const vm = createVm({ mxEvent });
            const listener = vi.fn();
            vm.subscribe(listener);

            vm.setEvent(mxEvent);

            expect(listener).not.toHaveBeenCalled();
            expect(mxEvent.listenerCount(MatrixEventEvent.Replaced)).toBe(1);
        });
    });

    describe("dispose", () => {
        it("stops following the event and releases the media of every item", async () => {
            const mxEvent = createEvent(images(GALLERY_BODY_MAX_TILES + 1));
            const vm = createVm({ mxEvent });
            vm.loadThumbnailsIfVisible();
            await flushPromises();
            expect(mxEvent.listenerCount(MatrixEventEvent.Replaced)).toBe(1);
            expect(mxEvent.listenerCount(MatrixEventEvent.Decrypted)).toBe(1);
            destroy.mockClear();

            vm.dispose();

            expect(vm.isDisposed).toBe(true);
            expect(mxEvent.listenerCount(MatrixEventEvent.Replaced)).toBe(0);
            expect(mxEvent.listenerCount(MatrixEventEvent.Decrypted)).toBe(0);
            // Including the media of the item which has no tile.
            expect(destroy).toHaveBeenCalledTimes(GALLERY_BODY_MAX_TILES + 1);
            expect(destroy.mock.contexts).toEqual(expect.arrayContaining(getThumbnailUrl.mock.contexts));
        });
    });
});
