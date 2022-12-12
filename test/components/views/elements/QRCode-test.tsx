/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { render, waitFor, cleanup } from "@testing-library/react";
import React from "react";

import QRCode from "../../../../src/components/views/elements/QRCode";

describe("<QRCode />", () => {
    afterEach(() => {
        cleanup();
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
