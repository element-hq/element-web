/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { mocked } from "jest-mock";
import { render, fireEvent, waitFor } from "jest-matrix-react";
import fetchMock from "fetch-mock-jest";

import ImageView from "../../../../../src/components/views/elements/ImageView";
import { FileDownloader } from "../../../../../src/utils/FileDownloader";

jest.mock("../../../../../src/utils/FileDownloader");

describe("<ImageView />", () => {
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
});
