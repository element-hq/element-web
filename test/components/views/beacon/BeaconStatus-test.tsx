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
import { render, screen } from "@testing-library/react";
import { Beacon } from "matrix-js-sdk/src/matrix";

import BeaconStatus from "../../../../src/components/views/beacon/BeaconStatus";
import { BeaconDisplayStatus } from "../../../../src/components/views/beacon/displayStatus";
import { makeBeaconInfoEvent } from "../../../test-utils";

describe("<BeaconStatus />", () => {
    const defaultProps = {
        displayStatus: BeaconDisplayStatus.Loading,
        label: "test label",
        withIcon: true,
    };
    const renderComponent = (props = {}) => render(<BeaconStatus {...defaultProps} {...props} />);

    it("renders loading state", () => {
        const { asFragment } = renderComponent({ displayStatus: BeaconDisplayStatus.Loading });
        expect(asFragment()).toMatchSnapshot();
    });

    it("renders stopped state", () => {
        const { asFragment } = renderComponent({ displayStatus: BeaconDisplayStatus.Stopped });
        expect(asFragment()).toMatchSnapshot();
    });

    it("renders without icon", () => {
        const iconClassName = "mx_StyledLiveBeaconIcon";
        const { container } = renderComponent({ withIcon: false, displayStatus: BeaconDisplayStatus.Stopped });
        expect(container.getElementsByClassName(iconClassName)).toHaveLength(0);
    });

    describe("active state", () => {
        it("renders without children", () => {
            // mock for stable snapshot
            jest.spyOn(Date, "now").mockReturnValue(123456789);
            const beacon = new Beacon(makeBeaconInfoEvent("@user:server", "!room:server", { isLive: false }, "$1"));
            const { asFragment } = renderComponent({ beacon, displayStatus: BeaconDisplayStatus.Active });
            expect(asFragment()).toMatchSnapshot();
        });

        it("renders with children", () => {
            const beacon = new Beacon(makeBeaconInfoEvent("@user:server", "!room:sever", { isLive: false }));
            renderComponent({
                beacon,
                children: <span data-testid="test-child">test</span>,
                displayStatus: BeaconDisplayStatus.Active,
            });
            expect(screen.getByTestId("test-child")).toMatchSnapshot();
        });

        it("renders static remaining time when displayLiveTimeRemaining is falsy", () => {
            // mock for stable snapshot
            jest.spyOn(Date, "now").mockReturnValue(123456789);
            const beacon = new Beacon(makeBeaconInfoEvent("@user:server", "!room:server", { isLive: false }, "$1"));
            renderComponent({ beacon, displayStatus: BeaconDisplayStatus.Active });
            expect(screen.getByText("Live until 11:17")).toBeInTheDocument();
        });

        it("renders live time remaining when displayLiveTimeRemaining is truthy", () => {
            // mock for stable snapshot
            jest.spyOn(Date, "now").mockReturnValue(123456789);
            const beacon = new Beacon(makeBeaconInfoEvent("@user:server", "!room:server", { isLive: false }, "$1"));
            renderComponent({
                beacon,
                displayStatus: BeaconDisplayStatus.Active,
                displayLiveTimeRemaining: true,
            });
            expect(screen.getByText("1h left")).toBeInTheDocument();
        });
    });
});
