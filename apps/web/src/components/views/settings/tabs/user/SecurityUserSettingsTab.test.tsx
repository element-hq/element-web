/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "test-utils-rtl";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsServer,
    mockClientMethodsUser,
    mockClientMethodsCrypto,
    mockClientMethodsDevice,
    mockPlatformPeg,
    TestSDKContext,
} from "test-utils";
import React, { act } from "react";
import userEvent from "@testing-library/user-event";

import SecurityUserSettingsTab from "./SecurityUserSettingsTab";
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";
import { SDKContext } from "../../../../../contexts/SDKContext";
import defaultDispatcher from "../../../../../dispatcher/dispatcher";
import { UIFeature } from "../../../../../settings/UIFeature";
import SettingsStore from "../../../../../settings/SettingsStore";

describe("<SecurityUserSettingsTab />", () => {
    const getIgnoredUsers = vi.fn();
    const setIgnoredUsers = vi.fn();

    const userId = "@alice:server.org";
    const deviceId = "alices-device";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsServer(),
        ...mockClientMethodsDevice(deviceId),
        ...mockClientMethodsCrypto(),
        getRooms: vi.fn().mockReturnValue([]),
        getPushers: vi.fn().mockReturnValue([]),
        getIgnoredUsers,
        setIgnoredUsers,
    });

    const sdkContext = new TestSDKContext();
    sdkContext._client = mockClient;

    const getComponent = () => (
        <MatrixClientContext.Provider value={mockClient}>
            <SDKContext.Provider value={sdkContext}>
                <SecurityUserSettingsTab />
            </SDKContext.Provider>
        </MatrixClientContext.Provider>
    );

    beforeEach(() => {
        mockPlatformPeg();
        vi.clearAllMocks();
    });

    it("renders security section", () => {
        const { container } = render(getComponent());

        expect(container).toMatchSnapshot();
    });

    it("renders ignored users", () => {
        getIgnoredUsers.mockReturnValue(["@bob:example.org"]);
        const { getByRole } = render(getComponent());
        const ignoredUsers = getByRole("list", { name: "Ignored users" });

        expect(ignoredUsers).toMatchSnapshot();
    });

    it("allows unignoring a user", async () => {
        getIgnoredUsers.mockReturnValue(["@bob:example.org"]);
        const { getByText, getByRole } = render(getComponent());
        await userEvent.click(getByRole("button", { name: "Unignore" }));
        expect(setIgnoredUsers).toHaveBeenCalledWith([]);
        await act(() => {
            getIgnoredUsers.mockReturnValue([]);
            defaultDispatcher.dispatch(
                {
                    action: "ignore_state_changed",
                },
                true,
            );
        });
        expect(getByText("You have no ignored users.")).toBeVisible();
    });

    it("does not render privacy header if 3pid features are disabled", async () => {
        vi.spyOn(SettingsStore, "getValue").mockImplementation((key: any): any => {
            if (key === UIFeature.ThirdPartyID) return false;
        });

        render(getComponent());

        expect(screen.queryByRole("heading", { name: "Privacy" })).toBeNull();
    });
});
