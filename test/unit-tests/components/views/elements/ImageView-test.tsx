/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { mocked } from "jest-mock";
import { render, fireEvent, waitFor } from "jest-matrix-react";
import fetchMock from "@fetch-mock/jest";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import ImageView from "../../../../../src/components/views/elements/ImageView";
import { FileDownloader } from "../../../../../src/utils/FileDownloader";
import Modal from "../../../../../src/Modal";
import ErrorDialog from "../../../../../src/components/views/dialogs/ErrorDialog";
import { stubClient } from "../../../../test-utils";

jest.mock("../../../../../src/utils/FileDownloader");

jest.mock("../../../../../src/accessibility/KeyboardShortcuts", () => ({
    KeyBindingAction: {
        Escape: "escape",
        Save: "save",
    },
}));

jest.mock("../../../../../src/KeyBindingsManager", () => ({
    getKeyBindingsManager: () => ({
        getAccessibilityAction: (ev: any) => {
            // Preserve existing Ctrl+S behavior
            if (ev?.ctrlKey && (ev?.key === "s" || ev?.code === "KeyS")) return "save";
            // For other keys, don't map to an accessibility action
            return undefined;
        },
    }),
}));

jest.mock("../../../../../src/components/views/avatars/MemberAvatar", () => ({
    __esModule: true,
    default: () => <div data-testid="member-avatar" />,
}));

describe("<ImageView />", () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it("renders correctly", () => {
        const { container } = render(<ImageView src="https://example.com/image.png" onFinished={jest.fn()} />);
        expect(container).toMatchSnapshot();
    });

    it("should download on click", async () => {
        fetchMock.get("https://example.com/image.png", "TESTFILE");
        const { getByRole } = render(
            <ImageView src="https://example.com/image.png" name="filename.png" onFinished={jest.fn()} />,
        );
        fireEvent.click(getByRole("button", { name: "Download" }));
        await waitFor(() =>
            expect(mocked(FileDownloader).mock.instances[0].download).toHaveBeenCalledWith({
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
            <ImageView
                src="https://test.dummy/fromSrc.png"
                name="fromName.png"
                onFinished={jest.fn()}
                mxEvent={event}
            />,
        );
        fireEvent.click(getByRole("button", { name: "Download" }));
        await waitFor(() =>
            expect(mocked(FileDownloader).mock.instances[0].download).toHaveBeenCalledWith({
                blob: expect.anything(),
                name: "fromEvent.png",
            }),
        );
        expect(fetchMock).toHaveFetched("http://this.is.a.url/test.dummy/fromEvent.png");
    });

    it("should start download on Ctrl+S", async () => {
        fetchMock.get("https://example.com/image.png", "TESTFILE");

        const { container } = render(
            <ImageView src="https://example.com/image.png" name="filename.png" onFinished={jest.fn()} />,
        );

        const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
        dialog?.focus();

        fireEvent.keyDown(dialog!, { key: "s", code: "KeyS", ctrlKey: true });

        await waitFor(() => {
            expect(mocked(FileDownloader).mock.instances[0].download).toHaveBeenCalledWith({
                blob: expect.anything(),
                name: "filename.png",
            });
        });

        expect(fetchMock).toHaveFetched("https://example.com/image.png");
    });

    it("should handle download errors", async () => {
        const modalSpy = jest.spyOn(Modal, "createDialog");
        fetchMock.get("https://example.com/image.png", { status: 500 });
        const { getByRole } = render(
            <ImageView src="https://example.com/image.png" name="filename.png" onFinished={jest.fn()} />,
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

    it("renders prev/next buttons and calls callbacks on click", () => {
        const onPrev = jest.fn();
        const onNext = jest.fn();

        const { container } = render(
            <ImageView src="https://example.com/image.png" onFinished={jest.fn()} onPrev={onPrev} onNext={onNext} />,
        );

        const prevBtn = container.querySelector(".mx_ImageView_nav_prev") as HTMLElement;
        const nextBtn = container.querySelector(".mx_ImageView_nav_next") as HTMLElement;

        expect(prevBtn).toBeTruthy();
        expect(nextBtn).toBeTruthy();

        fireEvent.click(nextBtn);
        expect(onNext).toHaveBeenCalledTimes(1);

        fireEvent.click(prevBtn);
        expect(onPrev).toHaveBeenCalledTimes(1);
    });

    it("navigates with ArrowLeft/ArrowRight keys when hasPrev/hasNext", () => {
        const onPrev = jest.fn();
        const onNext = jest.fn();

        const { container, rerender } = render(
            <ImageView
                src="https://example.com/image.png"
                onFinished={jest.fn()}
                onPrev={onPrev}
                onNext={undefined} // no "next" available initially
            />,
        );

        const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
        expect(dialog).toBeTruthy();

        fireEvent.keyDown(dialog, { key: "ArrowLeft" });
        expect(onPrev).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(dialog, { key: "ArrowRight" });
        expect(onNext).toHaveBeenCalledTimes(0);

        rerender(
            <ImageView
                src="https://example.com/image.png"
                onFinished={jest.fn()}
                onPrev={onPrev}
                onNext={onNext} // now "next" is available
            />,
        );

        fireEvent.keyDown(dialog, { key: "ArrowRight" });
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("resets interaction state when navigating to a different mxEvent", () => {
        const setStateSpy = jest.spyOn(ImageView.prototype as any, "setState");

        // Provide thumbnailInfo so the translation calculation path is exercised too
        const thumb = { positionX: 10, positionY: 10, width: 20, height: 20 };

        const evA = new MatrixEvent({
            event_id: "$a",
            type: "m.room.message",
            content: { msgtype: "m.image", body: "a.png", url: "mxc://test.dummy/a" },
            origin_server_ts: 0,
            room_id: "!room:server",
        });
        const evB = new MatrixEvent({
            event_id: "$b",
            type: "m.room.message",
            content: { msgtype: "m.image", body: "b.png", url: "mxc://test.dummy/b" },
            origin_server_ts: 0,
            room_id: "!room:server",
        });

        const { rerender } = render(
            <ImageView
                src="https://example.com/image.png"
                onFinished={jest.fn()}
                mxEvent={evA}
                thumbnailInfo={thumb}
            />,
        );

        rerender(
            <ImageView
                src="https://example.com/image.png"
                onFinished={jest.fn()}
                mxEvent={evB}
                thumbnailInfo={thumb}
            />,
        );

        expect(setStateSpy).toHaveBeenCalled();

        setStateSpy.mockRestore();
    });

    it("zooms in and out via toolbar buttons after image load", async () => {
        const { container, getByRole } = render(
            <ImageView src="https://example.com/image.png" onFinished={jest.fn()} />,
        );

        const wrapper = container.querySelector(".mx_ImageView_image_wrapper") as HTMLDivElement;
        const img = container.querySelector("img.mx_ImageView_image") as HTMLImageElement;

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
});
