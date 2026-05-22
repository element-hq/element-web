/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { act, cleanup, render } from "jest-matrix-react";
import React from "react";
import { toDataURL, type QRCodeSegment, type QRCodeToDataURLOptions } from "qrcode";

import VerificationQRCode from "../../../../../../src/components/views/elements/crypto/VerificationQRCode";

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

describe("<VerificationQRCode />", () => {
    afterEach(() => {
        mockedToDataURL.mockReset();
        cleanup();
    });

    it("renders a QR code", async () => {
        mockQRCodeRender();
        const { container, getAllByAltText } = render(
            <VerificationQRCode qrCodeBytes={new Uint8ClampedArray(Buffer.from("asd"))} />,
        );
        // wait for the spinner to go away
        await waitForQRCodeRender();
        expect(getAllByAltText("QR Code")).toHaveLength(1);
        expect(container).toMatchSnapshot();
    });
});
