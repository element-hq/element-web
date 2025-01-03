/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { cleanup, render, waitFor } from "jest-matrix-react";
import React from "react";

import VerificationQRCode from "../../../../../../src/components/views/elements/crypto/VerificationQRCode";

describe("<VerificationQRCode />", () => {
    afterEach(() => {
        cleanup();
    });

    it("renders a QR code", async () => {
        const { container, getAllByAltText } = render(
            <VerificationQRCode qrCodeBytes={new Uint8ClampedArray(Buffer.from("asd"))} />,
        );
        // wait for the spinner to go away
        await waitFor(() => getAllByAltText("QR Code").length === 1);
        expect(container).toMatchSnapshot();
    });
});
