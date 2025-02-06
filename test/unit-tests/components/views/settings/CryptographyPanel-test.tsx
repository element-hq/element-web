/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, waitFor, screen, fireEvent } from "jest-matrix-react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import * as TestUtils from "../../../../test-utils";
import CryptographyPanel from "../../../../../src/components/views/settings/CryptographyPanel";
import { withClientContextRenderOptions } from "../../../../test-utils";

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
        const rendered = render(<CryptographyPanel />, withClientContextRenderOptions(client));

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
        const rendered = render(<CryptographyPanel />, withClientContextRenderOptions(client));

        // Then it displays info about the user's session
        const codes = rendered.container.querySelectorAll("code");

        // Initially a placeholder
        expect(codes[1].innerHTML).toEqual("<strong>...</strong>");

        // Then "not supported key
        await waitFor(() => expect(codes[1].innerHTML).toEqual("<strong>&lt;not supported&gt;</strong>"));
    });

    it("should open the export e2e keys dialog on click", async () => {
        const sessionId = "ABCDEFGHIJ";
        const sessionKey = "AbCDeFghIJK7L/m4nOPqRSTUVW4xyzaBCDef6gHIJkl";

        TestUtils.stubClient();
        const client: MatrixClient = MatrixClientPeg.safeGet();
        client.deviceId = sessionId;

        mocked(client.getCrypto()!.getOwnDeviceKeys).mockResolvedValue({ ed25519: sessionKey, curve25519: "1234" });

        render(<CryptographyPanel />, withClientContextRenderOptions(client));
        fireEvent.click(await screen.findByRole("button", { name: "Export E2E room keys" }));
        await expect(screen.findByRole("heading", { name: "Export room keys" })).resolves.toBeInTheDocument();
    });

    it("should open the import e2e keys dialog on click", async () => {
        const sessionId = "ABCDEFGHIJ";
        const sessionKey = "AbCDeFghIJK7L/m4nOPqRSTUVW4xyzaBCDef6gHIJkl";

        TestUtils.stubClient();
        const client: MatrixClient = MatrixClientPeg.safeGet();
        client.deviceId = sessionId;

        mocked(client.getCrypto()!.getOwnDeviceKeys).mockResolvedValue({ ed25519: sessionKey, curve25519: "1234" });

        render(<CryptographyPanel />, withClientContextRenderOptions(client));
        fireEvent.click(await screen.findByRole("button", { name: "Import E2E room keys" }));
        await expect(screen.findByRole("heading", { name: "Import room keys" })).resolves.toBeInTheDocument();
    });
});
