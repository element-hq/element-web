/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { KnownMembership } from "matrix-js-sdk/src/types";

import ConfirmUserActionDialog from "../../../../../src/components/views/dialogs/ConfirmUserActionDialog";
import { mkRoomMember } from "../../../../test-utils";

describe("ConfirmUserActionDialog", () => {
    it("renders", () => {
        const { asFragment } = render(
            <ConfirmUserActionDialog
                onFinished={jest.fn()}
                member={mkRoomMember("123", "@user:test.com", KnownMembership.Join)}
                action="Ban"
                title="Ban this " // eg. 'Ban this user?'
            />,
        );
        expect(asFragment()).toMatchSnapshot();
    });
});
