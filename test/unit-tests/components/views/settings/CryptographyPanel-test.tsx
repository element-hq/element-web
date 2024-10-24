/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, waitFor } from "jest-matrix-react";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import * as TestUtils from "../../../../test-utils";
import CryptographyPanel from "../../../../../src/components/views/settings/CryptographyPanel";

describe("CryptographyPanel", () => {
    it("shows the session ID and key", async () => {
        const sessionId = "ABCDEFGHIJ";
        const sessionKey = "AbCDeFghIJK7L/m4nOPqRSTUVW4xyzaBCDef6gHIJkl";
        const sessionKeyFormatted = "<strong>AbCD eFgh IJK7 L/m4 nOPq RSTU VW4x yzaB CDef 6gHI Jkl</strong>";

        TestUtils.stubClient();
        const client: MatrixClient = MatrixClientPeg.safeGet();
        client.deviceId = sessionId;

        mocked(client.getCrypto()!.getOwnDeviceKeys).mockResolvedValue({ ed25519: sessionKey, curve25519: "1234" });

        // When we render the CryptographyPanel
        const rendered = render(<CryptographyPanel />);

        // Then it displays info about the user's session
        const codes = rendered.container.querySelectorAll("code");
        expect(codes.length).toEqual(2);
        expect(codes[0].innerHTML).toEqual(sessionId);

        // Initially a placeholder
        expect(codes[1].innerHTML).toEqual("<strong>...</strong>");

        // Then the actual key
        await waitFor(() => expect(codes[1].innerHTML).toEqual(sessionKeyFormatted));
    });

    it("handles errors fetching session key", async () => {
        const sessionId = "ABCDEFGHIJ";

        TestUtils.stubClient();
        const client: MatrixClient = MatrixClientPeg.safeGet();
        client.deviceId = sessionId;

        mocked(client.getCrypto()!.getOwnDeviceKeys).mockRejectedValue(new Error("bleh"));

        // When we render the CryptographyPanel
        const rendered = render(<CryptographyPanel />);

        // Then it displays info about the user's session
        const codes = rendered.container.querySelectorAll("code");

        // Initially a placeholder
        expect(codes[1].innerHTML).toEqual("<strong>...</strong>");

        // Then "not supported key
        await waitFor(() => expect(codes[1].innerHTML).toEqual("<strong>&lt;not supported&gt;</strong>"));
    });
});
