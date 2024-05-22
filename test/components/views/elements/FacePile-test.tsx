/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { render } from "@testing-library/react";
import React from "react";
import { KnownMembership } from "matrix-js-sdk/src/types";

import FacePile from "../../../../src/components/views/elements/FacePile";
import { mkRoomMember } from "../../../test-utils";

describe("<FacePile />", () => {
    it("renders with a tooltip", () => {
        const member = mkRoomMember("123", "456", KnownMembership.Join);

        const { asFragment } = render(
            <FacePile members={[member]} size="36px" overflow={false} tooltipLabel="tooltip" />,
        );

        expect(asFragment()).toMatchSnapshot();
    });
});
