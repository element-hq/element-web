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
import userEvent from "@testing-library/user-event";
import fetchMock from "@fetch-mock/vitest";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { stubClient } from "test-utils";
import {
    MockViewModel,
    type LightboxNavigationViewActions,
    type LightboxNavigationViewSnapshot,
} from "@element-hq/web-shared-components";

import ImageView from "./ImageView";
import { FileDownloader } from "../../../utils/FileDownloader";
import Modal from "../../../Modal";
import ErrorDialog from "../dialogs/ErrorDialog";

vi.mock("../../../utils/FileDownloader");

class TestNavigationViewModel
    extends MockViewModel<LightboxNavigationViewSnapshot>
    implements LightboxNavigationViewActions
{
    public goToPrevious = vi.fn();
    public goToNext = vi.fn();

    public constructor(snapshot: Partial<LightboxNavigationViewSnapshot> = {}) {
        super({ canGoToPrevious: true, canGoToNext: true, isNavigating: false, ...snapshot });
    }
}

describe("<ImageView />", () => {
    afterEach(() => {
        vi.resetAllMocks();
    });

    it("renders correctly", () => {
        const { container } = render(<ImageView src="https://example.com/image.png" onFinished={vi.fn()} />);
        expect(container).toMatchSnapshot();
    });

    it("should close on Escape when the lightbox itself has focus", async () => {
        const onFinished = vi.fn();
        const { getByRole } = render(<ImageView src="https://example.com/image.png" onFinished={onFinished} />);
        const lightbox = getByRole("dialog");
        // Clicking non-interactive content, like the image, focuses the nearest focusable ancestor. Unless that
        // is the lightbox, focus falls back to the body, where the lightbox never sees the Escape key.
        expect(lightbox).toHaveAttribute("tabindex", "-1");
        lightbox.focus();
        expect(lightbox).toHaveFocus();

        await userEvent.keyboard("{Escape}");
        expect(onFinished).toHaveBeenCalled();
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
        it("shows no navigation buttons without a navigation view model", () => {
            const { queryByRole } = render(<ImageView src="https://example.com/image.png" onFinished={vi.fn()} />);
            expect(queryByRole("button", { name: "Previous" })).toBeNull();
            expect(queryByRole("button", { name: "Next" })).toBeNull();
        });

        it("shows the navigation buttons beside the image", () => {
            const navigation = new TestNavigationViewModel({ canGoToPrevious: false });
            const { getByRole, queryByRole } = render(
                <ImageView src="https://example.com/image.png" onFinished={vi.fn()} navigation={navigation} />,
            );
            expect(queryByRole("button", { name: "Previous" })).toBeNull();

            fireEvent.click(getByRole("button", { name: "Next" }));
            expect(navigation.goToNext).toHaveBeenCalled();
        });

        it("navigates with the arrow keys", () => {
            const navigation = new TestNavigationViewModel();
            const onFinished = vi.fn();
            const { container } = render(
                <ImageView src="https://example.com/image.png" onFinished={onFinished} navigation={navigation} />,
            );
            const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;

            fireEvent.keyDown(dialog, { key: "ArrowLeft" });
            expect(navigation.goToPrevious).toHaveBeenCalledTimes(1);
            fireEvent.keyDown(dialog, { key: "ArrowRight" });
            expect(navigation.goToNext).toHaveBeenCalledTimes(1);
            expect(onFinished).not.toHaveBeenCalled();
        });

        it("resets zoom and rotation when the image changes", () => {
            const navigation = new TestNavigationViewModel();
            const { container, getByRole, rerender } = render(
                <ImageView src="https://example.com/image.png" onFinished={vi.fn()} navigation={navigation} />,
            );
            const image = container.querySelector<HTMLImageElement>(".mx_ImageView_image")!;
            fireEvent.click(getByRole("button", { name: "Rotate Right" }));
            expect(image.style.transform).toContain("rotate(90deg)");

            rerender(<ImageView src="https://example.com/other.png" onFinished={vi.fn()} navigation={navigation} />);
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
