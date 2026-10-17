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

    describe("navigation", () => {
        it("shows no navigation buttons unless callbacks are given", () => {
            const { queryByRole, container } = render(
                <ImageView src="https://example.com/image.png" onFinished={vi.fn()} />,
            );
            expect(queryByRole("button", { name: "Previous" })).toBeNull();
            expect(queryByRole("button", { name: "Next" })).toBeNull();
            expect(container.querySelector(".mx_ImageView_nav")).toBeNull();
        });

        it("shows only the buttons for which a callback is given, keeping both gutters", () => {
            const onNext = vi.fn();
            const { getByRole, queryByRole, container } = render(
                <ImageView src="https://example.com/image.png" onFinished={vi.fn()} onNext={onNext} />,
            );
            expect(queryByRole("button", { name: "Previous" })).toBeNull();
            expect(container.querySelectorAll(".mx_ImageView_nav")).toHaveLength(2);

            fireEvent.click(getByRole("button", { name: "Next" }));
            expect(onNext).toHaveBeenCalled();
        });

        it("navigates with the arrow keys", () => {
            const onPrev = vi.fn();
            const onNext = vi.fn();
            const onFinished = vi.fn();
            const { container } = render(
                <ImageView
                    src="https://example.com/image.png"
                    onFinished={onFinished}
                    onPrev={onPrev}
                    onNext={onNext}
                />,
            );
            const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;

            fireEvent.keyDown(dialog, { key: "ArrowLeft" });
            expect(onPrev).toHaveBeenCalledTimes(1);
            fireEvent.keyDown(dialog, { key: "ArrowRight" });
            expect(onNext).toHaveBeenCalledTimes(1);
            expect(onFinished).not.toHaveBeenCalled();
        });

        it("ignores arrow keys at the boundaries and while navigating", () => {
            const onNext = vi.fn();
            const { container, getByRole, rerender } = render(
                <ImageView src="https://example.com/image.png" onFinished={vi.fn()} onNext={onNext} />,
            );
            const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
            fireEvent.keyDown(dialog, { key: "ArrowLeft" }); // no onPrev
            expect(() => fireEvent.keyDown(dialog, { key: "ArrowLeft" })).not.toThrow();

            rerender(
                <ImageView
                    src="https://example.com/image.png"
                    onFinished={vi.fn()}
                    onNext={onNext}
                    navigationInProgress={true}
                />,
            );
            expect(getByRole("button", { name: "Next" })).toHaveAttribute("aria-disabled", "true");
            fireEvent.keyDown(dialog, { key: "ArrowRight" });
            expect(onNext).not.toHaveBeenCalled();
        });

        it("keeps focus inside the lightbox when the focused button disappears", () => {
            const { getByRole, container, rerender } = render(
                <ImageView src="https://example.com/1.png" onFinished={vi.fn()} onPrev={vi.fn()} onNext={vi.fn()} />,
            );
            getByRole("button", { name: "Next" }).focus();

            // Reached the newest image: the Next button goes away
            rerender(<ImageView src="https://example.com/2.png" onFinished={vi.fn()} onPrev={vi.fn()} />);
            expect(document.activeElement).toBe(getByRole("button", { name: "Previous" }));

            // Only image left: both buttons go away
            rerender(<ImageView src="https://example.com/2.png" onFinished={vi.fn()} />);
            expect(document.activeElement).toBe(container.querySelector('[role="dialog"]'));
        });

        it("resets zoom and rotation when the image changes", () => {
            const { container, getByRole, rerender } = render(
                <ImageView src="https://example.com/image.png" onFinished={vi.fn()} onNext={vi.fn()} />,
            );
            const image = container.querySelector<HTMLImageElement>(".mx_ImageView_image")!;
            fireEvent.click(getByRole("button", { name: "Rotate Right" }));
            expect(image.style.transform).toContain("rotate(90deg)");

            rerender(<ImageView src="https://example.com/other.png" onFinished={vi.fn()} onNext={vi.fn()} />);
            expect(image.getAttribute("src")).toBe("https://example.com/other.png");
            expect(image.style.transform).toContain("rotate(0deg)");
        });
    });

    it("closes on Escape key", () => {
        const onFinished = vi.fn();
        const { container } = render(<ImageView src="https://example.com/image.png" onFinished={onFinished} />);

        const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
        fireEvent.keyDown(dialog, { key: "Escape" });

        expect(onFinished).toHaveBeenCalledTimes(1);
    });

    it("zooms in and out via toolbar buttons after image load", async () => {
        const { container, getByRole } = render(<ImageView src="https://example.com/image.png" onFinished={vi.fn()} />);

        const wrapper = container.querySelector<HTMLDivElement>(".mx_ImageView_image_wrapper")!;
        const img = container.querySelector<HTMLImageElement>("img.mx_ImageView_image")!;

        expect(wrapper).toBeTruthy();
        expect(img).toBeTruthy();

        Object.defineProperty(wrapper, "clientWidth", { value: 800, configurable: true });
        Object.defineProperty(wrapper, "clientHeight", { value: 600, configurable: true });

        Object.defineProperty(img, "naturalWidth", { value: 1600, configurable: true });
        Object.defineProperty(img, "naturalHeight", { value: 1200, configurable: true });

        fireEvent.load(img);

        const zoomIn = getByRole("button", { name: "Zoom in" });
        const zoomOut = getByRole("button", { name: "Zoom out" });

        const initialTransform = img.style.transform;
        expect(initialTransform).toContain("scale(");

        fireEvent.click(zoomIn);
        const afterZoomIn = img.style.transform;
        expect(afterZoomIn).toContain("scale(");
        expect(afterZoomIn).not.toEqual(initialTransform);

        fireEvent.click(zoomOut);
        const afterZoomOut = img.style.transform;
        expect(afterZoomOut).toContain("scale(");
        expect(afterZoomOut).not.toEqual(afterZoomIn);
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
