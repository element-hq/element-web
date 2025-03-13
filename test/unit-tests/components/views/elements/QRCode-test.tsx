/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render, waitFor, cleanup } from "jest-matrix-react";
import React from "react";

import QRCode from "../../../../../src/components/views/elements/QRCode";

describe("<QRCode />", () => {
    afterEach(() => {
        cleanup();
    });

    it("shows a spinner when data is null", async () => {
        const { container } = render(<QRCode data={null} />);
        expect(container.querySelector(".mx_Spinner")).toBeDefined();
    });

    it("renders a QR with defaults", async () => {
        const { container, getAllByAltText } = render(<QRCode data="asd" />);
        await waitFor(() => getAllByAltText("QR Code").length === 1);
        expect(container).toMatchSnapshot();
    });

    it("renders a QR with high error correction level", async () => {
        const { container, getAllByAltText } = render(<QRCode data="asd" errorCorrectionLevel="high" />);
        await waitFor(() => getAllByAltText("QR Code").length === 1);
        expect(container).toMatchSnapshot();
    });
});
