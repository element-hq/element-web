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

import React from "react";
import { render } from "@testing-library/react";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import * as TestUtils from "../../../test-utils";
import CryptographyPanel from "../../../../src/components/views/settings/CryptographyPanel";

describe("CryptographyPanel", () => {
    it("shows the session ID and key", () => {
        const sessionId = "ABCDEFGHIJ";
        const sessionKey = "AbCDeFghIJK7L/m4nOPqRSTUVW4xyzaBCDef6gHIJkl";
        const sessionKeyFormatted = "<b>AbCD eFgh IJK7 L/m4 nOPq RSTU VW4x yzaB CDef 6gHI Jkl</b>";

        TestUtils.stubClient();
        const client: MatrixClient = MatrixClientPeg.safeGet();
        client.deviceId = sessionId;
        client.getDeviceEd25519Key = () => sessionKey;

        // When we render the CryptographyPanel
        const rendered = render(<CryptographyPanel />);

        // Then it displays info about the user's session
        const codes = rendered.container.querySelectorAll("code");
        expect(codes.length).toEqual(2);
        expect(codes[0].innerHTML).toEqual(sessionId);
        expect(codes[1].innerHTML).toEqual(sessionKeyFormatted);
    });
});
