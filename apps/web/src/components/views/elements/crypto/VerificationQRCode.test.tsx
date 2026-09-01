/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render } from "test-utils-rtl";
import { mockQRCodeRender, resetQRCodeMock, waitForQRCodeRender } from "test-utils/qrcode";
import React from "react";

import VerificationQRCode from "./VerificationQRCode";

vi.mock("qrcode", async () => ({
    ...(await vi.importActual("qrcode")),
    toDataURL: vi.fn(),
}));

describe("<VerificationQRCode />", () => {
    afterEach(() => {
        resetQRCodeMock();
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
