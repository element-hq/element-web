/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MsgType } from "matrix-js-sdk/src/matrix";
import { flushPromises } from "test-utils";

import { type GalleryItem, MAX_GALLERY_ITEMS } from "../../utils/gallery";
import { GalleryComposerViewModel } from "./GalleryComposerViewModel";
import Modal from "../../Modal";
import { GalleryImageView } from "../../components/views/elements/GalleryImageView";

/** What the mocked `GalleryMedia` resolves the thumbnail of each item to, by the mxc URI of the item. */
const thumbnails = vi.hoisted(() => new Map<string, Promise<string | null>>());
/** Every `GalleryMedia` the view model has created, in order. */
const createdMedia = vi.hoisted(() => [] as Array<{ item: { url?: string }; destroy: () => void }>);

vi.mock("../../utils/GalleryMedia", () => {
    class GalleryMedia {
        public readonly destroy = vi.fn();

        public constructor(public readonly item: GalleryItem) {
            createdMedia.push(this);
        }

        public get isVideo(): boolean {
            return this.item.itemtype === "m.video";
        }

        public get name(): string {
            return this.item.filename ?? this.item.body;
        }

        public getThumbnailUrl(): Promise<string | null> {
            return thumbnails.get(this.item.url!) ?? Promise.resolve(null);
        }
    }
    return { GalleryMedia };
});

function mkFile(name: string, type = "image/png", size = 10): File {
    return new File([new Uint8Array(size)], name, { type });
}

function mkItem(name: string, itemtype: GalleryItem["itemtype"] = MsgType.Image): GalleryItem {
    return { itemtype, body: name, url: `mxc://server/${name}` };
}

describe("GalleryComposerViewModel", () => {
    let createObjectURL: ReturnType<typeof vi.spyOn>;
    let revokeObjectURL: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        thumbnails.clear();
        createdMedia.length = 0;
        let counter = 0;
        createObjectURL = vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:preview-${counter++}`);
        revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("starting from files", () => {
        it("previews every file from an object URL", () => {
            const image = mkFile("photo.png");
            const video = mkFile("clip.mp4", "video/mp4");
            const vm = new GalleryComposerViewModel({ items: [image, video] });

            expect(createObjectURL).toHaveBeenCalledWith(image);
            expect(createObjectURL).toHaveBeenCalledWith(video);
            expect(vm.getSnapshot()).toEqual({
                items: [
                    {
                        id: "item-0",
                        type: "image",
                        name: "photo.png",
                        previewUrl: "blob:preview-0",
                        previewIsVideo: false,
                    },
                    {
                        id: "item-1",
                        type: "video",
                        name: "clip.mp4",
                        previewUrl: "blob:preview-1",
                        previewIsVideo: true,
                    },
                ],
                canAddMore: true,
                countLabel: `2 of ${MAX_GALLERY_ITEMS} items`,
                notice: undefined,
                hint: "You've added more than one image or video, so this will be sent as a gallery. People using older apps will only see your text, not the images.",
            });
            vm.dispose();
        });

        it("starts empty when it is given nothing", () => {
            const vm = new GalleryComposerViewModel({ items: [] });

            expect(vm.getSnapshot()).toEqual({
                items: [],
                canAddMore: true,
                countLabel: `0 of ${MAX_GALLERY_ITEMS} items`,
                notice: undefined,
            });
            expect(vm.getItems()).toEqual([]);
            vm.dispose();
        });

        it("names a file without a name", () => {
            const vm = new GalleryComposerViewModel({ items: [mkFile("")] });

            expect(vm.getSnapshot().items[0].name).toBe("Attachment");
            vm.dispose();
        });

        it("uses the singular for a single item", () => {
            const vm = new GalleryComposerViewModel({ items: [mkFile("photo.png")] });

            expect(vm.getSnapshot().countLabel).toBe(`1 of ${MAX_GALLERY_ITEMS} item`);
            vm.dispose();
        });
    });

    describe("starting from the items of a gallery", () => {
        it("shows the items as loading until their thumbnails are known", async () => {
            const image = mkItem("photo.png");
            const video = mkItem("clip.mp4", MsgType.Video);
            thumbnails.set(image.url!, Promise.resolve("blob:thumb-image"));
            thumbnails.set(video.url!, Promise.resolve("https://server/thumb-video"));

            const vm = new GalleryComposerViewModel({ items: [image, video] });

            expect(createObjectURL).not.toHaveBeenCalled();
            expect(vm.getSnapshot().items).toEqual([
                { id: "item-0", type: "image", name: "photo.png", previewUrl: undefined, loading: true },
                { id: "item-1", type: "video", name: "clip.mp4", previewUrl: undefined, loading: true },
            ]);

            const listener = vi.fn();
            vm.subscribe(listener);
            await flushPromises();

            expect(listener).toHaveBeenCalled();
            // The preview of a video which was already sent is its thumbnail, so it is not flagged as a video.
            expect(vm.getSnapshot().items).toEqual([
                { id: "item-0", type: "image", name: "photo.png", previewUrl: "blob:thumb-image", loading: false },
                {
                    id: "item-1",
                    type: "video",
                    name: "clip.mp4",
                    previewUrl: "https://server/thumb-video",
                    loading: false,
                },
            ]);
            vm.dispose();
        });

        it("keeps an item whose preview cannot be loaded", async () => {
            const item = mkItem("broken.png");
            thumbnails.set(item.url!, Promise.reject(new Error("cannot decrypt")));

            const vm = new GalleryComposerViewModel({ items: [item] });
            await flushPromises();

            expect(vm.getSnapshot().items).toEqual([
                { id: "item-0", type: "image", name: "broken.png", previewUrl: undefined, loading: false },
            ]);
            expect(vm.getItems()).toEqual([item]);
            vm.dispose();
        });

        it("shows a video without a thumbnail as an empty tile", async () => {
            const vm = new GalleryComposerViewModel({ items: [mkItem("clip.mp4", MsgType.Video)] });
            await flushPromises();

            expect(vm.getSnapshot().items[0]).toMatchObject({ type: "video", previewUrl: undefined, loading: false });
            vm.dispose();
        });

        it("does not update once disposed", async () => {
            const item = mkItem("photo.png");
            const thumbnail = Promise.withResolvers<string | null>();
            thumbnails.set(item.url!, thumbnail.promise);
            const vm = new GalleryComposerViewModel({ items: [item] });
            const listener = vi.fn();
            vm.subscribe(listener);

            vm.dispose();
            thumbnail.resolve("blob:late");
            await flushPromises();

            expect(listener).not.toHaveBeenCalled();
            expect(vm.getSnapshot().items[0].loading).toBe(true);
        });

        it("lists existing items before the files added to them", () => {
            const item = mkItem("old.png");
            const file = mkFile("new.png");
            const vm = new GalleryComposerViewModel({ items: [file, item] });

            expect(vm.getSnapshot().items.map(({ name }) => name)).toEqual(["old.png", "new.png"]);
            expect(vm.getItems()).toEqual([item, file]);
            vm.dispose();
        });
    });

    describe("onAddFiles", () => {
        it("appends the files and updates the count", () => {
            const vm = new GalleryComposerViewModel({ items: [mkFile("a.png")] });
            const listener = vi.fn();
            vm.subscribe(listener);
            const added = [mkFile("b.png"), mkFile("c.mp4", "video/mp4")];

            vm.onAddFiles(added);

            expect(listener).toHaveBeenCalledTimes(1);
            const snapshot = vm.getSnapshot();
            expect(snapshot.items.map(({ name }) => name)).toEqual(["a.png", "b.png", "c.mp4"]);
            expect(new Set(snapshot.items.map(({ id }) => id)).size).toBe(3);
            expect(snapshot.countLabel).toBe(`3 of ${MAX_GALLERY_ITEMS} items`);
            expect(snapshot.notice).toBeUndefined();
            vm.dispose();
        });

        it("leaves out files which are not images or videos", () => {
            const vm = new GalleryComposerViewModel({ items: [mkFile("a.png")] });

            vm.onAddFiles([mkFile("notes.pdf", "application/pdf"), mkFile("b.png"), mkFile("song.ogg", "audio/ogg")]);

            const snapshot = vm.getSnapshot();
            expect(snapshot.items.map(({ name }) => name)).toEqual(["a.png", "b.png"]);
            expect(snapshot.notice).toBe("Only images and videos can be added. Other files were left out.");
            vm.dispose();
        });

        it("leaves out files which are too large to upload", () => {
            const vm = new GalleryComposerViewModel({ items: [], maxFileSize: 1024 });

            vm.onAddFiles([mkFile("small.png", "image/png", 1024), mkFile("large.png", "image/png", 1025)]);

            const snapshot = vm.getSnapshot();
            expect(snapshot.items.map(({ name }) => name)).toEqual(["small.png"]);
            expect(snapshot.notice).toBe(
                "Some files were left out because they are larger than the upload limit of 1 KB.",
            );
            vm.dispose();
        });

        it("applies the upload limit to the files it starts with", () => {
            const vm = new GalleryComposerViewModel({
                items: [mkFile("large.png", "image/png", 2048), mkFile("small.png")],
                maxFileSize: 1024,
            });

            expect(vm.getSnapshot().items.map(({ name }) => name)).toEqual(["small.png"]);
            expect(vm.getSnapshot().notice).toContain("upload limit");
            vm.dispose();
        });

        it("leaves out the files which do not fit", () => {
            const files = Array.from({ length: MAX_GALLERY_ITEMS - 1 }, (_, index) => mkFile(`${index}.png`));
            const vm = new GalleryComposerViewModel({ items: files });
            expect(vm.getSnapshot().canAddMore).toBe(true);
            const fits = mkFile("fits.png");
            const leftOut = mkFile("left-out.png");

            vm.onAddFiles([fits, leftOut]);

            const snapshot = vm.getSnapshot();
            expect(snapshot.items).toHaveLength(MAX_GALLERY_ITEMS);
            expect(snapshot.items.at(-1)!.name).toBe("fits.png");
            expect(snapshot.canAddMore).toBe(false);
            expect(snapshot.countLabel).toBe(`${MAX_GALLERY_ITEMS} of ${MAX_GALLERY_ITEMS} items`);
            expect(snapshot.notice).toBe(
                `A gallery can hold up to ${MAX_GALLERY_ITEMS} items. The rest were left out.`,
            );
            // No preview is prepared for a file which is not added.
            expect(createObjectURL).not.toHaveBeenCalledWith(leftOut);
            expect(vm.getItems()).not.toContain(leftOut);
            vm.dispose();
        });

        it("clears the notice once files are added without a problem", () => {
            const vm = new GalleryComposerViewModel({ items: [] });
            vm.onAddFiles([mkFile("notes.pdf", "application/pdf")]);
            expect(vm.getSnapshot().notice).toBeDefined();

            vm.onAddFiles([mkFile("a.png")]);

            expect(vm.getSnapshot().notice).toBeUndefined();
            vm.dispose();
        });
    });

    describe("setMaxFileSize", () => {
        it("turns away larger files from then on", () => {
            const vm = new GalleryComposerViewModel({ items: [] });
            const large = mkFile("large.png", "image/png", 2048);
            vm.onAddFiles([large]);
            expect(vm.getSnapshot().items.map(({ name }) => name)).toEqual(["large.png"]);

            vm.setMaxFileSize(1024);
            const alsoLarge = mkFile("also-large.png", "image/png", 2048);
            vm.onAddFiles([alsoLarge, mkFile("small.png", "image/png", 512)]);

            const snapshot = vm.getSnapshot();
            // What was already added stays: the limit is applied when files are added.
            expect(snapshot.items.map(({ name }) => name)).toEqual(["large.png", "small.png"]);
            expect(snapshot.notice).toBe(
                "Some files were left out because they are larger than the upload limit of 1 KB.",
            );
            expect(vm.getItems()).not.toContain(alsoLarge);
            vm.dispose();
        });

        it("accepts files of any size again once there is no limit", () => {
            const vm = new GalleryComposerViewModel({ items: [], maxFileSize: 1024 });
            vm.onAddFiles([mkFile("large.png", "image/png", 2048)]);
            expect(vm.getSnapshot().items).toHaveLength(0);

            vm.setMaxFileSize(undefined);
            vm.onAddFiles([mkFile("large.png", "image/png", 2048)]);

            expect(vm.getSnapshot().items.map(({ name }) => name)).toEqual(["large.png"]);
            expect(vm.getSnapshot().notice).toBeUndefined();
            vm.dispose();
        });

        it("does not notify subscribers, as nothing shown changes", () => {
            const vm = new GalleryComposerViewModel({ items: [mkFile("a.png")] });
            const listener = vi.fn();
            vm.subscribe(listener);

            vm.setMaxFileSize(1);

            expect(listener).not.toHaveBeenCalled();
            expect(vm.getSnapshot().items).toHaveLength(1);
            vm.dispose();
        });
    });

    describe("clear", () => {
        it("removes every item and releases its preview", async () => {
            const vm = new GalleryComposerViewModel({ items: [mkItem("old.png"), mkFile("a.png"), mkFile("b.png")] });
            await flushPromises();
            const listener = vi.fn();
            vm.subscribe(listener);

            vm.clear();

            expect(revokeObjectURL).toHaveBeenCalledTimes(2);
            expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-0");
            expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
            expect(createdMedia).toHaveLength(1);
            expect(createdMedia[0].destroy).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledTimes(1);
            expect(vm.getSnapshot()).toEqual({
                items: [],
                canAddMore: true,
                countLabel: `0 of ${MAX_GALLERY_ITEMS} items`,
                notice: undefined,
            });
            expect(vm.getItems()).toEqual([]);
            vm.dispose();
        });

        it("clears the notice", () => {
            const vm = new GalleryComposerViewModel({ items: [mkFile("a.png")] });
            vm.onAddFiles([mkFile("notes.pdf", "application/pdf")]);
            expect(vm.getSnapshot().notice).toBeDefined();

            vm.clear();

            expect(vm.getSnapshot().notice).toBeUndefined();
            vm.dispose();
        });

        it("makes room again in a gallery which was full", () => {
            const files = Array.from({ length: MAX_GALLERY_ITEMS }, (_, index) => mkFile(`${index}.png`));
            const vm = new GalleryComposerViewModel({ items: files });
            expect(vm.getSnapshot().canAddMore).toBe(false);

            vm.clear();

            expect(vm.getSnapshot().canAddMore).toBe(true);
            vm.dispose();
        });

        it("can be filled again, without releasing anything twice", () => {
            const vm = new GalleryComposerViewModel({ items: [mkFile("a.png")] });
            vm.clear();
            expect(revokeObjectURL).toHaveBeenCalledTimes(1);

            const next = mkFile("b.png");
            vm.onAddFiles([next]);

            expect(vm.getSnapshot().items.map(({ name }) => name)).toEqual(["b.png"]);
            expect(vm.getItems()).toEqual([next]);

            vm.dispose();
            // Only the preview of the file added after clearing was left to release.
            expect(revokeObjectURL).toHaveBeenCalledTimes(2);
            expect(revokeObjectURL).toHaveBeenLastCalledWith("blob:preview-1");
        });

        it("ignores a thumbnail which arrives for an item that was cleared", async () => {
            const deferred = Promise.withResolvers<string | null>();
            thumbnails.set("mxc://server/old.png", deferred.promise);
            const vm = new GalleryComposerViewModel({ items: [mkItem("old.png")] });
            vm.clear();
            const listener = vi.fn();
            vm.subscribe(listener);

            deferred.resolve("https://server/thumbnail");
            await flushPromises();

            expect(listener).not.toHaveBeenCalled();
            expect(vm.getSnapshot().items).toEqual([]);
            vm.dispose();
        });
    });

    describe("onOpenItem", () => {
        it("opens the attachments in the media viewer, at the one which was activated", () => {
            const createDialog = vi.spyOn(Modal, "createDialog").mockReturnValue(undefined as never);
            const kept = mkItem("kept.png");
            const added = mkFile("added.png");
            const vm = new GalleryComposerViewModel({ items: [kept, added] });
            const [, second] = vm.getSnapshot().items;

            vm.onOpenItem(second.id);

            expect(createDialog).toHaveBeenCalledWith(
                GalleryImageView,
                { items: [kept, added], initialIndex: 1 },
                "mx_Dialog_lightbox",
                undefined,
                true,
            );
            // The viewer gets the very items, so it can show the files which have not been sent yet.
            expect(createDialog.mock.calls[0][1]!.items![1]).toBe(added);
            vm.dispose();
        });

        it("opens the attachments as they stand after some were removed", () => {
            const createDialog = vi.spyOn(Modal, "createDialog").mockReturnValue(undefined as never);
            const first = mkFile("first.png");
            const second = mkFile("second.png");
            const third = mkFile("third.png");
            const vm = new GalleryComposerViewModel({ items: [first, second, third] });
            const ids = vm.getSnapshot().items.map((item) => item.id);

            vm.onRemoveItem(ids[0]);
            vm.onOpenItem(ids[2]);

            expect(createDialog.mock.calls[0][1]).toEqual({ items: [second, third], initialIndex: 1 });
            vm.dispose();
        });

        it("does nothing for an attachment it does not have", () => {
            const createDialog = vi.spyOn(Modal, "createDialog").mockReturnValue(undefined as never);
            const vm = new GalleryComposerViewModel({ items: [mkFile("photo.png")] });

            vm.onOpenItem("not-an-item");

            expect(createDialog).not.toHaveBeenCalled();
            vm.dispose();
        });
    });

    describe("onRemoveItem", () => {
        it("removes a file and releases its preview", () => {
            const vm = new GalleryComposerViewModel({ items: [mkFile("a.png"), mkFile("b.png")] });

            vm.onRemoveItem("item-0");

            expect(vm.getSnapshot().items.map(({ name }) => name)).toEqual(["b.png"]);
            expect(vm.getSnapshot().countLabel).toBe(`1 of ${MAX_GALLERY_ITEMS} item`);
            expect(revokeObjectURL).toHaveBeenCalledTimes(1);
            expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-0");
            vm.dispose();
        });

        it("removes an existing item and releases its media", async () => {
            const kept = mkItem("kept.png");
            const removed = mkItem("removed.png");
            const vm = new GalleryComposerViewModel({ items: [kept, removed] });
            await flushPromises();

            vm.onRemoveItem("item-1");

            expect(vm.getItems()).toEqual([kept]);
            expect(createdMedia[1].destroy).toHaveBeenCalledTimes(1);
            expect(createdMedia[0].destroy).not.toHaveBeenCalled();
            vm.dispose();
        });

        it("clears the notice and allows adding again", () => {
            const files = Array.from({ length: MAX_GALLERY_ITEMS + 1 }, (_, index) => mkFile(`${index}.png`));
            const vm = new GalleryComposerViewModel({ items: files });
            expect(vm.getSnapshot().notice).toBeDefined();
            expect(vm.getSnapshot().canAddMore).toBe(false);

            vm.onRemoveItem("item-0");

            expect(vm.getSnapshot().notice).toBeUndefined();
            expect(vm.getSnapshot().canAddMore).toBe(true);
            vm.dispose();
        });

        it("ignores an item it does not know", () => {
            const vm = new GalleryComposerViewModel({ items: [mkFile("a.png")] });
            const listener = vi.fn();
            vm.subscribe(listener);

            vm.onRemoveItem("no-such-item");

            expect(listener).not.toHaveBeenCalled();
            expect(vm.getSnapshot().items).toHaveLength(1);
            vm.dispose();
        });

        it("ignores a thumbnail which arrives for an item that was removed", async () => {
            const item = mkItem("photo.png");
            const thumbnail = Promise.withResolvers<string | null>();
            thumbnails.set(item.url!, thumbnail.promise);
            const vm = new GalleryComposerViewModel({ items: [item, mkFile("a.png")] });
            vm.onRemoveItem("item-0");
            const listener = vi.fn();
            vm.subscribe(listener);

            thumbnail.resolve("blob:late");
            await flushPromises();

            expect(listener).not.toHaveBeenCalled();
            vm.dispose();
        });
    });

    describe("hint for older apps", () => {
        const hint =
            "You've added more than one image or video, so this will be sent as a gallery. People using older apps will only see your text, not the images.";

        it("is given once there are several attachments, which are sent as a gallery", () => {
            const vm = new GalleryComposerViewModel({ items: [] });
            expect(vm.getSnapshot().hint).toBeUndefined();

            // One image or video is sent as an ordinary message, which every app shows.
            vm.onAddFiles([mkFile("a.png")]);
            expect(vm.getSnapshot().hint).toBeUndefined();

            vm.onAddFiles([mkFile("b.png")]);
            expect(vm.getSnapshot().hint).toBe(hint);

            vm.onRemoveItem(vm.getSnapshot().items[0].id);
            expect(vm.getSnapshot().hint).toBeUndefined();
            vm.dispose();
        });

        it("is given for a message being edited which has several items", () => {
            const vm = new GalleryComposerViewModel({ items: [mkItem("a.png"), mkItem("b.png")] });

            expect(vm.getSnapshot().hint).toBe(hint);
            vm.dispose();
        });
    });

    describe("isModified", () => {
        it("is false until the user adds or removes an attachment", async () => {
            const kept = mkItem("old.png");
            const vm = new GalleryComposerViewModel({ items: [kept, mkItem("other.png")] });
            expect(vm.isModified).toBe(false);

            // A preview which finishes loading changes the snapshot, but not the attachments.
            await Promise.resolve();
            await Promise.resolve();
            expect(vm.isModified).toBe(false);

            vm.onRemoveItem("item-0");
            expect(vm.isModified).toBe(true);
            vm.dispose();
        });

        it("is true once a file was added", () => {
            const vm = new GalleryComposerViewModel({ items: [mkItem("old.png")] });

            vm.onAddFiles([mkFile("a.png")]);

            expect(vm.isModified).toBe(true);
            vm.dispose();
        });

        it("is true when one attachment was swapped for another, leaving as many", () => {
            const vm = new GalleryComposerViewModel({ items: [mkItem("old.png")] });

            vm.onRemoveItem("item-0");
            vm.onAddFiles([mkFile("a.png")]);

            expect(vm.isModified).toBe(true);
            vm.dispose();
        });

        it("is false for files the view model was created with", () => {
            const vm = new GalleryComposerViewModel({ items: [mkFile("a.png"), mkItem("old.png")] });

            expect(vm.isModified).toBe(false);
            vm.dispose();
        });
    });

    describe("getItems", () => {
        it("returns the attachments in order, after files were added and removed", () => {
            const kept = mkItem("old.png");
            const first = mkFile("a.png");
            const second = mkFile("b.png");
            const third = mkFile("c.png");
            const vm = new GalleryComposerViewModel({ items: [first, kept, second] });
            vm.onAddFiles([third]);
            // Items which are already part of the message come first, then the files in order.
            vm.onRemoveItem("item-2");

            expect(vm.getItems()).toEqual([kept, first, third]);
            // The very objects it was given, so the caller can tell which items were kept.
            expect(vm.getItems()[0]).toBe(kept);
            expect(vm.getItems()[1]).toBe(first);
            vm.dispose();
        });

        it("returns a new list each time, which the caller is free to change", () => {
            const vm = new GalleryComposerViewModel({ items: [mkFile("a.png")] });

            vm.getItems().pop();

            expect(vm.getItems()).toHaveLength(1);
            vm.dispose();
        });
    });

    describe("dispose", () => {
        it("releases the previews of files and the media of existing items", async () => {
            const vm = new GalleryComposerViewModel({ items: [mkItem("old.png"), mkFile("a.png"), mkFile("b.png")] });
            await flushPromises();

            vm.dispose();

            expect(revokeObjectURL).toHaveBeenCalledTimes(2);
            expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-0");
            expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
            expect(createdMedia).toHaveLength(1);
            expect(createdMedia[0].destroy).toHaveBeenCalledTimes(1);
            expect(vm.isDisposed).toBe(true);
        });
    });
});
