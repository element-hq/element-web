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
import { mocked } from "jest-mock";
import { Beacon } from "matrix-js-sdk/src/matrix";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import OwnBeaconStatus from "../../../../src/components/views/beacon/OwnBeaconStatus";
import { BeaconDisplayStatus } from "../../../../src/components/views/beacon/displayStatus";
import { useOwnLiveBeacons } from "../../../../src/utils/beacon";
import { makeBeaconInfoEvent } from "../../../test-utils";

jest.mock("../../../../src/utils/beacon/useOwnLiveBeacons", () => ({
    useOwnLiveBeacons: jest.fn(),
}));

const defaultLiveBeaconsState = {
    onStopSharing: jest.fn(),
    onResetLocationPublishError: jest.fn(),
    stoppingInProgress: false,
    hasStopSharingError: false,
    hasLocationPublishError: false,
};

describe("<OwnBeaconStatus />", () => {
    const defaultProps = {
        displayStatus: BeaconDisplayStatus.Loading,
    };
    const userId = "@user:server";
    const roomId = "!room:server";
    let defaultBeacon: Beacon;
    const renderComponent = (props: Partial<React.ComponentProps<typeof OwnBeaconStatus>> = {}) =>
        render(<OwnBeaconStatus {...defaultProps} {...props} />);
    const getRetryButton = () => screen.getByRole("button", { name: "Retry" });
    const getStopButton = () => screen.getByRole("button", { name: "Stop" });

    beforeEach(() => {
        jest.spyOn(global.Date, "now").mockReturnValue(123456789);
        mocked(useOwnLiveBeacons).mockClear().mockReturnValue(defaultLiveBeaconsState);

        defaultBeacon = new Beacon(makeBeaconInfoEvent(userId, roomId));
    });

    it("renders without a beacon instance", () => {
        const { asFragment } = renderComponent();
        expect(asFragment()).toMatchSnapshot();
    });

    describe("Active state", () => {
        it("renders stop button", () => {
            const displayStatus = BeaconDisplayStatus.Active;
            mocked(useOwnLiveBeacons).mockReturnValue({
                ...defaultLiveBeaconsState,
                onStopSharing: jest.fn(),
            });
            renderComponent({ displayStatus, beacon: defaultBeacon });
            expect(screen.getByText("Live location enabled")).toBeInTheDocument();
            expect(getStopButton()).toBeInTheDocument();
        });

        it("stops sharing on stop button click", async () => {
            const displayStatus = BeaconDisplayStatus.Active;
            const onStopSharing = jest.fn();
            mocked(useOwnLiveBeacons).mockReturnValue({
                ...defaultLiveBeaconsState,
                onStopSharing,
            });
            renderComponent({ displayStatus, beacon: defaultBeacon });
            await userEvent.click(getStopButton());
            expect(onStopSharing).toHaveBeenCalled();
        });
    });

    describe("errors", () => {
        it("renders in error mode when displayStatus is error", () => {
            const displayStatus = BeaconDisplayStatus.Error;
            renderComponent({ displayStatus });
            expect(screen.getByText("Live location error")).toBeInTheDocument();

            // no actions for plain error
            expect(screen.queryByRole("button")).not.toBeInTheDocument();
        });

        describe("with location publish error", () => {
            it("renders in error mode", () => {
                const displayStatus = BeaconDisplayStatus.Active;
                mocked(useOwnLiveBeacons).mockReturnValue({
                    ...defaultLiveBeaconsState,
                    hasLocationPublishError: true,
                    onResetLocationPublishError: jest.fn(),
                });
                renderComponent({ displayStatus, beacon: defaultBeacon });
                expect(screen.getByText("Live location error")).toBeInTheDocument();
                // retry button
                expect(getRetryButton()).toBeInTheDocument();
            });

            it("retry button resets location publish error", async () => {
                const displayStatus = BeaconDisplayStatus.Active;
                const onResetLocationPublishError = jest.fn();
                mocked(useOwnLiveBeacons).mockReturnValue({
                    ...defaultLiveBeaconsState,
                    hasLocationPublishError: true,
                    onResetLocationPublishError,
                });
                renderComponent({ displayStatus, beacon: defaultBeacon });
                await userEvent.click(getRetryButton());

                expect(onResetLocationPublishError).toHaveBeenCalled();
            });
        });

        describe("with stopping error", () => {
            it("renders in error mode", () => {
                const displayStatus = BeaconDisplayStatus.Active;
                mocked(useOwnLiveBeacons).mockReturnValue({
                    ...defaultLiveBeaconsState,
                    hasLocationPublishError: false,
                    hasStopSharingError: true,
                    onStopSharing: jest.fn(),
                });
                renderComponent({ displayStatus, beacon: defaultBeacon });
                expect(screen.getByText("Live location error")).toBeInTheDocument();
                // retry button
                expect(getRetryButton()).toBeInTheDocument();
            });

            it("retry button retries stop sharing", async () => {
                const displayStatus = BeaconDisplayStatus.Active;
                const onStopSharing = jest.fn();
                mocked(useOwnLiveBeacons).mockReturnValue({
                    ...defaultLiveBeaconsState,
                    hasStopSharingError: true,
                    onStopSharing,
                });
                renderComponent({ displayStatus, beacon: defaultBeacon });
                await userEvent.click(getRetryButton());

                expect(onStopSharing).toHaveBeenCalled();
            });
        });
    });

    it("renders loading state correctly", () => {
        const component = renderComponent();
        expect(component).toBeTruthy();
    });
});
