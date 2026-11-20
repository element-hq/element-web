/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, fireEvent, waitFor } from "test-utils-rtl";
import fetchMock from "@fetch-mock/vitest";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { stubClient } from "test-utils";

import ImageView from "./ImageView";
import { FileDownloader } from "../../../utils/FileDownloader";
import { type MediaEventHelper } from "../../../utils/MediaEventHelper";
import Modal from "../../../Modal";
import ErrorDialog from "../dialogs/ErrorDialog";

vi.mock("../../../utils/FileDownloader");

describe("<ImageView />", () => {
    afterEach(() => {
        vi.resetAllMocks();
    });

    it("renders correctly", () => {
        const { container } = render(<ImageView src="https://example.com/image.png" onFinished={vi.fn()} />);
        expect(container).toMatchSnapshot();
    });

    it("should download on click", async () => {
        fetchMock.get("https://example.com/image.png", "TESTFILE");
        const { getByRole } = render(
            <ImageView src="https://example.com/image.png" name="filename.png" onFinished={vi.fn()} />,
        );
        fireEvent.click(getByRole("button", { name: "Download" }));
        await waitFor(() =>
            expect(vi.mocked(FileDownloader).mock.instances[0].download).toHaveBeenCalledWith({
                blob: expect.anything(),
                name: "filename.png",
            }),
        );
        expect(fetchMock).toHaveFetched("https://example.com/image.png");
    });

    it("should use event as download source if given", async () => {
        stubClient();

        const event = new MatrixEvent({
            event_id: "$eventId",
            type: "m.image",
            content: {
                body: "fromEvent.png",
                url: "mxc://test.dummy/fromEvent.png",
                file_name: "filename.png",
            },
            origin_server_ts: new Date(2000, 0, 1, 0, 0, 0, 0).getTime(),
        });

        fetchMock.get("http://this.is.a.url/test.dummy/fromEvent.png", "TESTFILE");
        const { getByRole } = render(
            <ImageView src="https://test.dummy/fromSrc.png" name="fromName.png" onFinished={vi.fn()} mxEvent={event} />,
        );
        fireEvent.click(getByRole("button", { name: "Download" }));
        await waitFor(() =>
            expect(vi.mocked(FileDownloader).mock.instances[0].download).toHaveBeenCalledWith({
                blob: expect.anything(),
                name: "fromEvent.png",
            }),
        );
        expect(fetchMock).toHaveFetched("http://this.is.a.url/test.dummy/fromEvent.png");
    });

    it("should start download on Ctrl+S", async () => {
        fetchMock.get("https://example.com/image.png", "TESTFILE");

        const { container } = render(
            <ImageView src="https://example.com/image.png" name="filename.png" onFinished={vi.fn()} />,
        );

        const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
        dialog?.focus();

        fireEvent.keyDown(dialog!, { key: "s", code: "KeyS", ctrlKey: true });

        await waitFor(() => {
            expect(vi.mocked(FileDownloader).mock.instances[0].download).toHaveBeenCalledWith({
                blob: expect.anything(),
                name: "filename.png",
            });
        });

        expect(fetchMock).toHaveFetched("https://example.com/image.png");
    });

    describe("media which is part of a set", () => {
        const galleryEvent = (): MatrixEvent =>
            new MatrixEvent({
                event_id: "$gallery",
                type: "m.room.message",
                sender: "@alice:example.org",
                room_id: "!room:example.org",
                content: {
                    msgtype: "dm.filament.gallery",
                    body: "The caption",
                    itemtypes: [{ itemtype: "m.image", body: "item.png", url: "mxc://test.dummy/item.png" }],
                },
                origin_server_ts: new Date(2000, 0, 1, 0, 0, 0, 0).getTime(),
            });

        it("shows the given title in place of the file name of the event", () => {
            stubClient();

            const { getByText, queryByText, container } = render(
                <ImageView
                    src="https://example.com/image.png"
                    title="item.png (1 of 3)"
                    mxEvent={galleryEvent()}
                    mediaEventHelper={{} as MediaEventHelper}
                    onFinished={vi.fn()}
                />,
            );

            expect(getByText("item.png (1 of 3)")).toBeInTheDocument();
            expect(container.querySelector(".mx_ImageView_title")).toHaveTextContent("item.png (1 of 3)");
            expect(queryByText("The caption")).not.toBeInTheDocument();
        });

        it("has no previous or next button unless it is told how to navigate", () => {
            const { queryByRole } = render(<ImageView src="https://example.com/image.png" onFinished={vi.fn()} />);

            expect(queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
            expect(queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
        });

        it("only shows the button for the direction it can navigate in", () => {
            const { getByRole, queryByRole } = render(
                <ImageView src="https://example.com/image.png" onNext={vi.fn()} onFinished={vi.fn()} />,
            );

            expect(getByRole("button", { name: "Next" })).toBeInTheDocument();
            expect(queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
        });

        it("navigates with the buttons without closing the view", () => {
            const onPrevious = vi.fn();
            const onNext = vi.fn();
            const onFinished = vi.fn();
            const { getByRole } = render(
                <ImageView
                    src="https://example.com/image.png"
                    onPrevious={onPrevious}
                    onNext={onNext}
                    onFinished={onFinished}
                />,
            );

            const next = getByRole("button", { name: "Next" });
            // A press on the background closes the view, which a press on a button must not do.
            fireEvent.mouseDown(next);
            fireEvent.click(next);
            expect(onNext).toHaveBeenCalledTimes(1);
            expect(onPrevious).not.toHaveBeenCalled();

            const previous = getByRole("button", { name: "Previous" });
            fireEvent.mouseDown(previous);
            fireEvent.click(previous);
            expect(onPrevious).toHaveBeenCalledTimes(1);
            expect(onNext).toHaveBeenCalledTimes(1);

            expect(onFinished).not.toHaveBeenCalled();
        });

        it("still closes when the background is pressed", () => {
            const onFinished = vi.fn();
            const { container } = render(
                <ImageView src="https://example.com/image.png" onNext={vi.fn()} onFinished={onFinished} />,
            );

            fireEvent.mouseDown(container.querySelector(".mx_ImageView_image_wrapper")!);

            expect(onFinished).toHaveBeenCalledTimes(1);
        });

        it("navigates with the arrow keys", () => {
            const onPrevious = vi.fn();
            const onNext = vi.fn();
            const { container } = render(
                <ImageView
                    src="https://example.com/image.png"
                    onPrevious={onPrevious}
                    onNext={onNext}
                    onFinished={vi.fn()}
                />,
            );
            const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;

            fireEvent.keyDown(dialog, { key: "ArrowRight", code: "ArrowRight" });
            expect(onNext).toHaveBeenCalledTimes(1);
            expect(onPrevious).not.toHaveBeenCalled();

            fireEvent.keyDown(dialog, { key: "ArrowLeft", code: "ArrowLeft" });
            expect(onPrevious).toHaveBeenCalledTimes(1);
            expect(onNext).toHaveBeenCalledTimes(1);
        });

        it("leaves the arrow keys to the controls of a video", () => {
            const onPrevious = vi.fn();
            const onNext = vi.fn();
            const { container } = render(
                <ImageView
                    src="https://example.com/video.mp4"
                    isVideo
                    onPrevious={onPrevious}
                    onNext={onNext}
                    onFinished={vi.fn()}
                />,
            );
            const video = container.querySelector("video")!;

            fireEvent.keyDown(video, { key: "ArrowRight", code: "ArrowRight" });
            fireEvent.keyDown(video, { key: "ArrowLeft", code: "ArrowLeft" });

            expect(onNext).not.toHaveBeenCalled();
            expect(onPrevious).not.toHaveBeenCalled();

            // Elsewhere in the view they still navigate.
            fireEvent.keyDown(container.querySelector('[role="dialog"]')!, { key: "ArrowRight", code: "ArrowRight" });
            expect(onNext).toHaveBeenCalledTimes(1);
        });

        it("plays a video with the browser's controls instead of showing a zoomable image", () => {
            const onFinished = vi.fn();
            const { container, getByRole, queryByRole } = render(
                <ImageView src="https://example.com/video.mp4" name="video.mp4" isVideo onFinished={onFinished} />,
            );

            const video = container.querySelector("video")!;
            expect(video).toHaveAttribute("src", "https://example.com/video.mp4");
            expect(video).toHaveAttribute("controls");
            expect(container.querySelector("img")).toBeNull();

            for (const name of ["Zoom out", "Zoom in", "Rotate Left", "Rotate Right"]) {
                expect(queryByRole("button", { name })).not.toBeInTheDocument();
            }
            expect(getByRole("button", { name: "Download" })).toBeInTheDocument();
            expect(getByRole("button", { name: "Close" })).toBeInTheDocument();

            // Using the controls of the video must not close the view.
            fireEvent.mouseDown(video);
            expect(onFinished).not.toHaveBeenCalled();
        });

        it("keeps the zoom and rotate buttons for an image", () => {
            const { getByRole } = render(<ImageView src="https://example.com/image.png" onFinished={vi.fn()} />);

            for (const name of ["Zoom out", "Zoom in", "Rotate Left", "Rotate Right"]) {
                expect(getByRole("button", { name })).toBeInTheDocument();
            }
        });

        it("shows the placeholder while there is nothing to display", () => {
            const { container, getByText, rerender, queryByText } = render(
                <ImageView src="" placeholder={<div>Still loading</div>} onNext={vi.fn()} onFinished={vi.fn()} />,
            );

            expect(getByText("Still loading")).toBeInTheDocument();
            expect(container.querySelector("img")).toBeNull();
            expect(container.querySelector("video")).toBeNull();

            // The placeholder gives way once there is a source.
            rerender(
                <ImageView
                    src="https://example.com/image.png"
                    name="image.png"
                    placeholder={<div>Still loading</div>}
                    onNext={vi.fn()}
                    onFinished={vi.fn()}
                />,
            );
            expect(queryByText("Still loading")).not.toBeInTheDocument();
            expect(container.querySelector("img")).toHaveAttribute("src", "https://example.com/image.png");
        });

        it("downloads through the given helper rather than through the event", async () => {
            stubClient();
            const blob = new Blob(["ITEM"], { type: "image/png" });
            const mediaEventHelper = {
                sourceBlob: { value: Promise.resolve(blob) },
                fileName: "item.png",
            } as unknown as MediaEventHelper;

            // A helper for the gallery event itself cannot be made: it has no media of its own.
            const { getByRole } = render(
                <ImageView
                    src="https://test.dummy/fromSrc.png"
                    name="fromName.png"
                    title="item.png (1 of 1)"
                    mxEvent={galleryEvent()}
                    mediaEventHelper={mediaEventHelper}
                    onFinished={vi.fn()}
                />,
            );
            fireEvent.click(getByRole("button", { name: "Download" }));

            await waitFor(() =>
                expect(vi.mocked(FileDownloader).mock.instances[0].download).toHaveBeenCalledWith({
                    blob,
                    name: "item.png",
                }),
            );
            expect(fetchMock).not.toHaveFetched("https://test.dummy/fromSrc.png");
        });
    });

    it("should handle download errors", async () => {
        const modalSpy = vi.spyOn(Modal, "createDialog");
        fetchMock.get("https://example.com/image.png", { status: 500 });
        const { getByRole } = render(
            <ImageView src="https://example.com/image.png" name="filename.png" onFinished={vi.fn()} />,
        );
        fireEvent.click(getByRole("button", { name: "Download" }));
        await waitFor(() =>
            expect(modalSpy).toHaveBeenCalledWith(
                ErrorDialog,
                expect.objectContaining({
                    title: "Download failed",
                }),
            ),
        );
    });
});
