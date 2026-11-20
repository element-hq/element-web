/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "test-utils-rtl";
import fetchMock from "@fetch-mock/vitest";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { stubClient } from "test-utils";

import { GalleryImageView } from "./GalleryImageView";
import { GalleryMedia } from "../../../utils/GalleryMedia";
import { FileDownloader } from "../../../utils/FileDownloader";

vi.mock("../../../utils/FileDownloader");

type Item = Record<string, unknown>;

const image = (name: string): Item => ({
    itemtype: "m.image",
    body: name,
    url: `mxc://server/${name}`,
    info: { mimetype: "image/png", w: 640, h: 480, size: 1234 },
});

const video = (name: string): Item => ({
    itemtype: "m.video",
    body: name,
    url: `mxc://server/${name}`,
    info: { mimetype: "video/mp4", duration: 5000 },
});

const makeEvent = (itemtypes: unknown[]): MatrixEvent =>
    new MatrixEvent({
        event_id: "$gallery",
        type: "m.room.message",
        sender: "@alice:example.org",
        room_id: "!room:example.org",
        origin_server_ts: new Date(2000, 0, 1, 0, 0, 0, 0).getTime(),
        content: { msgtype: "dm.filament.gallery", body: "", itemtypes },
    });

describe("<GalleryImageView />", () => {
    beforeEach(() => {
        // Turns the mxc URI of an item into http://this.is.a.url/<server>/<media id>
        stubClient();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const renderViewer = (
        itemtypes: unknown[],
        props: Partial<React.ComponentProps<typeof GalleryImageView>> = {},
    ): ReturnType<typeof render> & { onFinished: ReturnType<typeof vi.fn> } => {
        const onFinished = vi.fn();
        const result = render(
            <GalleryImageView mxEvent={makeEvent(itemtypes)} initialIndex={0} onFinished={onFinished} {...props} />,
        );
        return { ...result, onFinished };
    };

    it("opens on the item that was clicked", async () => {
        renderViewer([image("one.png"), image("two.png"), image("three.png")], { initialIndex: 1 });

        expect(screen.getByText("two.png (2 of 3)")).toBeInTheDocument();
        const img = await screen.findByRole("img", { name: "two.png" });
        expect(img).toHaveAttribute("src", "http://this.is.a.url/server/two.png");
    });

    it("steps through the items, with no button to go past either end", async () => {
        renderViewer([image("one.png"), image("two.png"), image("three.png")]);

        expect(screen.getByText("one.png (1 of 3)")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        expect(screen.getByText("two.png (2 of 3)")).toBeInTheDocument();
        expect(await screen.findByRole("img", { name: "two.png" })).toHaveAttribute(
            "src",
            "http://this.is.a.url/server/two.png",
        );
        expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        expect(screen.getByText("three.png (3 of 3)")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Previous" }));
        expect(screen.getByText("two.png (2 of 3)")).toBeInTheDocument();
        expect(screen.queryByText("three.png (3 of 3)")).not.toBeInTheDocument();
    });

    it("steps through the items with the arrow keys", () => {
        const { container } = renderViewer([image("one.png"), image("two.png")]);

        fireEvent.keyDown(container.querySelector('[role="dialog"]')!, { key: "ArrowRight", code: "ArrowRight" });
        expect(screen.getByText("two.png (2 of 2)")).toBeInTheDocument();

        fireEvent.keyDown(container.querySelector('[role="dialog"]')!, { key: "ArrowLeft", code: "ArrowLeft" });
        expect(screen.getByText("one.png (1 of 2)")).toBeInTheDocument();
    });

    it("has no navigation for a gallery with a single item", () => {
        renderViewer([image("one.png")]);

        expect(screen.getByText("one.png (1 of 1)")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    });

    it("shows a spinner until the source of the item is known", async () => {
        const source = Promise.withResolvers<string | null>();
        vi.spyOn(GalleryMedia.prototype, "getSourceUrl").mockReturnValue(source.promise);
        const { container } = renderViewer([image("one.png"), image("two.png")]);

        expect(screen.getByRole("progressbar")).toBeInTheDocument();
        expect(container.querySelector("img.mx_ImageView_image")).toBeNull();
        // The viewer can be used while the item loads.
        expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();

        await act(async () => {
            source.resolve("blob:decrypted");
        });

        expect(screen.getByRole("img", { name: "one.png" })).toHaveAttribute("src", "blob:decrypted");
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("says so when an image cannot be loaded", async () => {
        vi.spyOn(GalleryMedia.prototype, "getSourceUrl").mockRejectedValue(new Error("Unable to decrypt"));
        const { container } = renderViewer([image("one.png"), image("two.png")]);

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to show image due to error");
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
        expect(container.querySelector("img.mx_ImageView_image")).toBeNull();
        // The other items can still be reached.
        expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    });

    it("says so when there is no form of an image that can be displayed", async () => {
        vi.spyOn(GalleryMedia.prototype, "getSourceUrl").mockResolvedValue(null);
        renderViewer([image("one.png")]);

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to show image due to error");
    });

    it("says so when a video cannot be loaded", async () => {
        vi.spyOn(GalleryMedia.prototype, "getSourceUrl").mockRejectedValue(new Error("Unable to download"));
        const { container } = renderViewer([video("clip.mp4")]);

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to show video due to error");
        expect(container.querySelector("video")).toBeNull();
    });

    it("only reports the failure of the item that failed", async () => {
        vi.spyOn(GalleryMedia.prototype, "getSourceUrl")
            .mockRejectedValueOnce(new Error("Unable to decrypt"))
            .mockResolvedValueOnce("blob:two");
        renderViewer([image("one.png"), image("two.png")]);
        expect(await screen.findByRole("alert")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Next" }));

        expect(await screen.findByRole("img", { name: "two.png" })).toHaveAttribute("src", "blob:two");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("plays videos", async () => {
        const { container } = renderViewer([image("one.png"), video("clip.mp4")], { initialIndex: 1 });

        expect(screen.getByText("clip.mp4 (2 of 2)")).toBeInTheDocument();
        await waitFor(() =>
            expect(container.querySelector("video")).toHaveAttribute("src", "http://this.is.a.url/server/clip.mp4"),
        );
        expect(container.querySelector("img.mx_ImageView_image")).toBeNull();
        expect(screen.queryByRole("button", { name: "Zoom in" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Previous" }));
        expect(await screen.findByRole("img", { name: "one.png" })).toBeInTheDocument();
        expect(container.querySelector("video")).toBeNull();
        expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    });

    it("resolves the source of each item once, however often it is shown", async () => {
        const getSourceUrl = vi.spyOn(GalleryMedia.prototype, "getSourceUrl");
        renderViewer([image("one.png"), image("two.png")]);
        await screen.findByRole("img", { name: "one.png" });

        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        await screen.findByRole("img", { name: "two.png" });
        fireEvent.click(screen.getByRole("button", { name: "Previous" }));
        await screen.findByRole("img", { name: "one.png" });
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        await screen.findByRole("img", { name: "two.png" });

        expect(getSourceUrl).toHaveBeenCalledTimes(2);
    });

    it("downloads the item being shown rather than the message", async () => {
        fetchMock.get("http://this.is.a.url/server/two.png", "TWO");
        renderViewer([image("one.png"), image("two.png")], { initialIndex: 1 });
        await screen.findByRole("img", { name: "two.png" });

        fireEvent.click(screen.getByRole("button", { name: "Download" }));

        await waitFor(() =>
            expect(vi.mocked(FileDownloader).mock.instances[0].download).toHaveBeenCalledWith({
                blob: expect.anything(),
                name: "two.png",
            }),
        );
        expect(fetchMock).toHaveFetched("http://this.is.a.url/server/two.png");
    });

    it("skips the items of a gallery which cannot be displayed", () => {
        renderViewer([
            image("one.png"),
            { itemtype: "m.file", body: "notes.pdf", url: "mxc://server/notes.pdf" },
            { itemtype: "m.image", body: "no-media.png" },
            image("two.png"),
        ]);

        expect(screen.getByText("one.png (1 of 2)")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        expect(screen.getByText("two.png (2 of 2)")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    });

    it("opens on the last item when asked for one past the end", () => {
        renderViewer([image("one.png"), image("two.png")], { initialIndex: 5 });

        expect(screen.getByText("two.png (2 of 2)")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();

        // One step back from there is the item before it
        fireEvent.click(screen.getByRole("button", { name: "Previous" }));
        expect(screen.getByText("one.png (1 of 2)")).toBeInTheDocument();
    });

    it("opens on the first item when asked for one before the start", () => {
        renderViewer([image("one.png"), image("two.png")], { initialIndex: -1 });

        expect(screen.getByText("one.png (1 of 2)")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
    });

    it("renders nothing for a gallery without items it can display", () => {
        const { container } = renderViewer([{ itemtype: "m.file", body: "notes.pdf", url: "mxc://server/notes.pdf" }]);

        expect(container).toBeEmptyDOMElement();
    });

    it("grows out of the tile when it opens, but not when coming back to that item", async () => {
        const thumbnailInfo = { positionX: 0, positionY: 0, width: 100, height: 100 };
        renderViewer([image("one.png"), image("two.png")], { thumbnailInfo });

        // Until it has loaded the image sits over the tile, away from the centre of the window.
        const opened = await screen.findByRole("img", { name: "one.png" });
        expect(opened.style.transform).not.toContain("translateX(0px)");

        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        await screen.findByRole("img", { name: "two.png" });
        fireEvent.click(screen.getByRole("button", { name: "Previous" }));

        const revisited = await screen.findByRole("img", { name: "one.png" });
        expect(revisited.style.transform).toContain("translateX(0px)");
    });

    it("closes when asked to", async () => {
        const { onFinished } = renderViewer([image("one.png")]);

        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        expect(onFinished).toHaveBeenCalledTimes(1);
    });

    describe("for the attachments of a message being written", () => {
        const photo = new File(["photo"], "photo.png", { type: "image/png" });
        const clip = new File(["a video"], "clip.mp4", { type: "video/mp4" });

        beforeEach(() => {
            vi.spyOn(URL, "createObjectURL").mockImplementation((file) => `blob:${(file as File).name}`);
            vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
        });

        const renderAttachments = (
            items: Array<File | Item>,
            initialIndex = 0,
        ): ReturnType<typeof render> & { onFinished: ReturnType<typeof vi.fn> } => {
            const onFinished = vi.fn();
            const result = render(
                <GalleryImageView
                    items={items as React.ComponentProps<typeof GalleryImageView>["items"]}
                    initialIndex={initialIndex}
                    onFinished={onFinished}
                />,
            );
            return { ...result, onFinished };
        };

        it("shows a file which has not been sent yet from the device", async () => {
            renderAttachments([photo]);

            expect(screen.getByText("photo.png (1 of 1)")).toBeInTheDocument();
            expect(await screen.findByRole("img", { name: "photo.png" })).toHaveAttribute("src", "blob:photo.png");
        });

        it("steps through files and items the message already has, in order", async () => {
            const { container } = renderAttachments([image("kept.png"), photo, clip]);

            expect(await screen.findByRole("img", { name: "kept.png" })).toHaveAttribute(
                "src",
                "http://this.is.a.url/server/kept.png",
            );
            expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole("button", { name: "Next" }));
            expect(screen.getByText("photo.png (2 of 3)")).toBeInTheDocument();
            expect(await screen.findByRole("img", { name: "photo.png" })).toHaveAttribute("src", "blob:photo.png");

            fireEvent.click(screen.getByRole("button", { name: "Next" }));
            expect(screen.getByText("clip.mp4 (3 of 3)")).toBeInTheDocument();
            await waitFor(() => expect(container.querySelector("video")).toHaveAttribute("src", "blob:clip.mp4"));
            expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
        });

        it("opens on the attachment which was activated", async () => {
            renderAttachments([photo, clip], 1);

            expect(screen.getByText("clip.mp4 (2 of 2)")).toBeInTheDocument();
        });

        it("offers no options for a message, as there is none yet", async () => {
            renderAttachments([photo]);
            await screen.findByRole("img", { name: "photo.png" });

            // There is no message to show the sender or time of.
            expect(screen.queryByRole("button", { name: "Options" })).not.toBeInTheDocument();
        });

        it("releases the URLs of the files when it closes", async () => {
            const { unmount } = renderAttachments([photo, clip]);
            await screen.findByRole("img", { name: "photo.png" });
            fireEvent.click(screen.getByRole("button", { name: "Next" }));
            await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(2));
            expect(URL.revokeObjectURL).not.toHaveBeenCalled();

            unmount();

            expect(vi.mocked(URL.revokeObjectURL).mock.calls.map(([url]) => url)).toEqual(
                expect.arrayContaining(["blob:photo.png", "blob:clip.mp4"]),
            );
        });

        it("shows the message's items rather than the attachments when given both", async () => {
            render(
                <GalleryImageView
                    mxEvent={makeEvent([image("from-event.png")])}
                    items={[photo]}
                    initialIndex={0}
                    onFinished={vi.fn()}
                />,
            );

            expect(screen.getByText("from-event.png (1 of 1)")).toBeInTheDocument();
            expect(URL.createObjectURL).not.toHaveBeenCalled();
        });

        it("renders nothing without attachments", () => {
            const { container } = renderAttachments([]);

            expect(container).toBeEmptyDOMElement();
        });
    });

    it("releases the media of every item when it closes", async () => {
        const destroy = vi.spyOn(GalleryMedia.prototype, "destroy");
        const { unmount } = renderViewer([image("one.png"), image("two.png"), video("clip.mp4")]);
        await screen.findByRole("img", { name: "one.png" });
        expect(destroy).not.toHaveBeenCalled();

        unmount();

        expect(destroy).toHaveBeenCalledTimes(3);
        expect(new Set(destroy.mock.contexts.map((media) => (media as GalleryMedia).name))).toEqual(
            new Set(["one.png", "two.png", "clip.mp4"]),
        );
    });
});
