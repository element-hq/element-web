/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { act } from "jest-matrix-react";
import { toDataURL, type QRCodeSegment, type QRCodeToDataURLOptions } from "qrcode";

jest.mock("qrcode", () => ({
    ...jest.requireActual("qrcode"),
    toDataURL: jest.fn(),
}));

const realQRCode = jest.requireActual("qrcode") as { toDataURL: typeof toDataURL };
const mockedToDataURL = jest.mocked(toDataURL);

let qrCodeRenderPromise: Promise<string> | undefined;

export function mockQRCodeRender(): void {
    // Keep real PNG generation, but capture the promise so the test can await it directly.
    mockedToDataURL.mockImplementation(((data: string | QRCodeSegment[], options?: QRCodeToDataURLOptions) => {
        qrCodeRenderPromise = realQRCode.toDataURL(data, options);
        return qrCodeRenderPromise;
    }) as typeof toDataURL);
}

export async function waitForQRCodeRender(): Promise<void> {
    if (!qrCodeRenderPromise) {
        throw new Error("mockQRCodeRender() must be called before waitForQRCodeRender()");
    }

    // Flush the React state update scheduled by QRCode after toDataURL resolves.
    await act(async () => {
        await qrCodeRenderPromise;
        await Promise.resolve();
    });
}

export function resetQRCodeMock(): void {
    mockedToDataURL.mockReset();
    qrCodeRenderPromise = undefined;
}
