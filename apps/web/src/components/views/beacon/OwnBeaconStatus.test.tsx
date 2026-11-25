/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Beacon } from "matrix-js-sdk/src/matrix";
import { render, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { makeBeaconInfoEvent } from "test-utils";

import OwnBeaconStatus from "./OwnBeaconStatus";
import { BeaconDisplayStatus } from "./displayStatus";
import { useOwnLiveBeacons } from "../../../utils/beacon";

vi.mock("../../../utils/beacon/useOwnLiveBeacons", () => ({
    useOwnLiveBeacons: vi.fn(),
}));

const defaultLiveBeaconsState = {
    onStopSharing: vi.fn(),
    onResetLocationPublishError: vi.fn(),
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
        vi.spyOn(global.Date, "now").mockReturnValue(123456789);
        vi.mocked(useOwnLiveBeacons).mockClear().mockReturnValue(defaultLiveBeaconsState);

        defaultBeacon = new Beacon(makeBeaconInfoEvent(userId, roomId));
    });

    it("renders without a beacon instance", () => {
        const { asFragment } = renderComponent();
        expect(asFragment()).toMatchSnapshot();
    });

    describe("Active state", () => {
        it("renders stop button", () => {
            const displayStatus = BeaconDisplayStatus.Active;
            vi.mocked(useOwnLiveBeacons).mockReturnValue({
                ...defaultLiveBeaconsState,
                onStopSharing: vi.fn(),
            });
            renderComponent({ displayStatus, beacon: defaultBeacon });
            expect(screen.getByText("Live location enabled")).toBeInTheDocument();
            expect(getStopButton()).toBeInTheDocument();
        });

        it("stops sharing on stop button click", async () => {
            const displayStatus = BeaconDisplayStatus.Active;
            const onStopSharing = vi.fn();
            vi.mocked(useOwnLiveBeacons).mockReturnValue({
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
                vi.mocked(useOwnLiveBeacons).mockReturnValue({
                    ...defaultLiveBeaconsState,
                    hasLocationPublishError: true,
                    onResetLocationPublishError: vi.fn(),
                });
                renderComponent({ displayStatus, beacon: defaultBeacon });
                expect(screen.getByText("Live location error")).toBeInTheDocument();
                // retry button
                expect(getRetryButton()).toBeInTheDocument();
            });

            it("retry button resets location publish error", async () => {
                const displayStatus = BeaconDisplayStatus.Active;
                const onResetLocationPublishError = vi.fn();
                vi.mocked(useOwnLiveBeacons).mockReturnValue({
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
                vi.mocked(useOwnLiveBeacons).mockReturnValue({
                    ...defaultLiveBeaconsState,
                    hasLocationPublishError: false,
                    hasStopSharingError: true,
                    onStopSharing: vi.fn(),
                });
                renderComponent({ displayStatus, beacon: defaultBeacon });
                expect(screen.getByText("Live location error")).toBeInTheDocument();
                // retry button
                expect(getRetryButton()).toBeInTheDocument();
            });

            it("retry button retries stop sharing", async () => {
                const displayStatus = BeaconDisplayStatus.Active;
                const onStopSharing = vi.fn();
                vi.mocked(useOwnLiveBeacons).mockReturnValue({
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
