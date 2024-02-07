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
import { RoomMember } from "matrix-js-sdk/src/matrix";
import { getByTestId, render } from "@testing-library/react";

import Marker from "../../../../src/components/views/location/Marker";

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
