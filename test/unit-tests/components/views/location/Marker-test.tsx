/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { RoomMember } from "matrix-js-sdk/src/matrix";
import { getByTestId, render } from "jest-matrix-react";

import Marker from "../../../../../src/components/views/location/Marker";

describe("<Marker />", () => {
    const defaultProps = {
        id: "abc123",
    };
    const getComponent = (props = {}) => render(<Marker {...defaultProps} {...props} />);

    it("renders with location icon when no room member", () => {
        const { asFragment } = getComponent();
        expect(asFragment()).toMatchSnapshot();
    });

    it("does not try to use member color without room member", () => {
        const { container } = getComponent({ useMemberColor: true });
        expect(container.querySelector(".mx_Marker.mx_Marker_defaultColor")).toBeInTheDocument();
    });

    it("uses member color class", () => {
        const member = new RoomMember("!room:server", "@user:server");
        const { container } = getComponent({ useMemberColor: true, roomMember: member });
        expect(container.querySelector(".mx_Marker.mx_Username_color3")).toBeInTheDocument();
    });

    it("renders member avatar when roomMember is truthy", () => {
        const member = new RoomMember("!room:server", "@user:server");
        const { container } = getComponent({ roomMember: member });
        expect(getByTestId(container, "avatar-img")).toBeInTheDocument();
    });
});
