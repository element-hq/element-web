/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import React from "react";
import { KnownMembership } from "matrix-js-sdk/src/types";

import FacePile from "../../../../../src/components/views/elements/FacePile";
import { mkRoomMember } from "../../../../test-utils";

describe("<FacePile />", () => {
    it("renders with a tooltip", () => {
        const member = mkRoomMember("123", "456", KnownMembership.Join);

        const { asFragment } = render(
            <FacePile members={[member]} size="36px" overflow={false} tooltipLabel="tooltip" />,
        );

        expect(asFragment()).toMatchSnapshot();
    });
});
