/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { act, render, cleanup } from "jest-matrix-react";
import React from "react";
import { toDataURL, type QRCodeSegment, type QRCodeToDataURLOptions } from "qrcode";

import QRCode from "../../../../../src/components/views/elements/QRCode";

jest.mock("qrcode", () => ({
    ...jest.requireActual("qrcode"),
    toDataURL: jest.fn(),
}));

const realQRCode = jest.requireActual("qrcode") as { toDataURL: typeof toDataURL };
const mockedToDataURL = jest.mocked(toDataURL);

let qrCodeRenderPromise: Promise<string>;

function mockQRCodeRender(): void {
    // Keep real PNG generation, but capture the promise so the test can await it directly.
    mockedToDataURL.mockImplementation(((data: string | QRCodeSegment[], options?: QRCodeToDataURLOptions) => {
        qrCodeRenderPromise = realQRCode.toDataURL(data, options);
        return qrCodeRenderPromise;
    }) as typeof toDataURL);
}

async function waitForQRCodeRender(): Promise<void> {
    // Flush the React state update scheduled by QRCode after toDataURL resolves.
    await act(async () => {
        await qrCodeRenderPromise;
        await Promise.resolve();
    });
}

describe("<QRCode />", () => {
    afterEach(() => {
        mockedToDataURL.mockReset();
        cleanup();
    });

    it("shows a spinner when data is null", async () => {
        const { container } = render(<QRCode data={null} />);
        expect(container.querySelector(".mx_Spinner")).toBeDefined();
    });

    it("renders a QR with defaults", async () => {
        mockQRCodeRender();
        const { container, getAllByAltText } = render(<QRCode data="asd" />);
        await waitForQRCodeRender();
        expect(getAllByAltText("QR Code")).toHaveLength(1);
        expect(container).toMatchSnapshot();
    });

    it("renders a QR with high error correction level", async () => {
        mockQRCodeRender();
        const { container, getAllByAltText } = render(<QRCode data="asd" errorCorrectionLevel="high" />);
        await waitForQRCodeRender();
        expect(getAllByAltText("QR Code")).toHaveLength(1);
        expect(container).toMatchSnapshot();
    });
});
