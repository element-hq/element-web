/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import { Beacon } from "matrix-js-sdk/src/matrix";

import BeaconStatus from "../../../../../src/components/views/beacon/BeaconStatus";
import { BeaconDisplayStatus } from "../../../../../src/components/views/beacon/displayStatus";
import { makeBeaconInfoEvent } from "../../../../test-utils";

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
