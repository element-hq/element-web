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
import fetchMock from "fetch-mock-jest";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import ImageView from "../../../../../src/components/views/elements/ImageView";
import { FileDownloader } from "../../../../../src/utils/FileDownloader";
import Modal from "../../../../../src/Modal";
import ErrorDialog from "../../../../../src/components/views/dialogs/ErrorDialog";
import { stubClient } from "../../../../test-utils";

jest.mock("../../../../../src/utils/FileDownloader");

describe("<ImageView />", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        fetchMock.reset();
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
});
