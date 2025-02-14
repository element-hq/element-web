/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps } from "react";
import { act, fireEvent, render } from "jest-matrix-react";

import { FilteredDeviceList } from "../../../../../../src/components/views/settings/devices/FilteredDeviceList";
import { DeviceSecurityVariation } from "../../../../../../src/components/views/settings/devices/types";
import { flushPromises, mockPlatformPeg } from "../../../../../test-utils";
import { DeviceType } from "../../../../../../src/utils/device/parseUserAgent";

mockPlatformPeg();

const MS_DAY = 86400000;
describe("<FilteredDeviceList />", () => {
    // 14.03.2022 16:15
    const now = 1647270879403;
    jest.spyOn(global.Date, "now").mockReturnValue(now);
    const newDevice = {
        device_id: "new",
        last_seen_ts: Date.now() - 500,
        last_seen_ip: "123.456.789",
        display_name: "My Device",
        isVerified: true,
        deviceType: DeviceType.Unknown,
    };
    const unverifiedNoMetadata = {
        device_id: "unverified-no-metadata",
        isVerified: false,
        deviceType: DeviceType.Unknown,
    };
    const verifiedNoMetadata = {
        device_id: "verified-no-metadata",
        isVerified: true,
        deviceType: DeviceType.Unknown,
    };
    const hundredDaysOld = {
        device_id: "100-days-old",
        isVerified: true,
        last_seen_ts: Date.now() - MS_DAY * 100,
        deviceType: DeviceType.Unknown,
    };
    const hundredDaysOldUnverified = {
        device_id: "unverified-100-days-old",
        isVerified: false,
        last_seen_ts: Date.now() - MS_DAY * 100,
        deviceType: DeviceType.Unknown,
    };
    const defaultProps: ComponentProps<typeof FilteredDeviceList> = {
        onFilterChange: jest.fn(),
        onDeviceExpandToggle: jest.fn(),
        onSignOutDevices: jest.fn(),
        saveDeviceName: jest.fn(),
        setPushNotifications: jest.fn(),
        setSelectedDeviceIds: jest.fn(),
        localNotificationSettings: new Map(),
        expandedDeviceIds: [],
        signingOutDeviceIds: [],
        selectedDeviceIds: [],
        devices: {
            [unverifiedNoMetadata.device_id]: unverifiedNoMetadata,
            [verifiedNoMetadata.device_id]: verifiedNoMetadata,
            [newDevice.device_id]: newDevice,
            [hundredDaysOld.device_id]: hundredDaysOld,
            [hundredDaysOldUnverified.device_id]: hundredDaysOldUnverified,
        },
        pushers: [],
        supportsMSC3881: true,
    };

    const getComponent = (props = {}) => <FilteredDeviceList {...defaultProps} {...props} />;

    afterAll(() => {
        jest.spyOn(global.Date, "now").mockRestore();
    });

    it("renders devices in correct order", () => {
        const { container } = render(getComponent());
        const tiles = container.querySelectorAll(".mx_DeviceTile");
        expect(tiles[0].getAttribute("data-testid")).toEqual(`device-tile-${newDevice.device_id}`);
        expect(tiles[1].getAttribute("data-testid")).toEqual(`device-tile-${hundredDaysOld.device_id}`);
        expect(tiles[2].getAttribute("data-testid")).toEqual(`device-tile-${hundredDaysOldUnverified.device_id}`);
        expect(tiles[3].getAttribute("data-testid")).toEqual(`device-tile-${unverifiedNoMetadata.device_id}`);
        expect(tiles[4].getAttribute("data-testid")).toEqual(`device-tile-${verifiedNoMetadata.device_id}`);
    });

    it("updates list order when devices change", () => {
        const updatedOldDevice = { ...hundredDaysOld, last_seen_ts: new Date().getTime() };
        const updatedDevices = {
            [hundredDaysOld.device_id]: updatedOldDevice,
            [newDevice.device_id]: newDevice,
        };
        const { container, rerender } = render(getComponent());

        rerender(getComponent({ devices: updatedDevices }));

        const tiles = container.querySelectorAll(".mx_DeviceTile");
        expect(tiles.length).toBe(2);
        expect(tiles[0].getAttribute("data-testid")).toEqual(`device-tile-${hundredDaysOld.device_id}`);
        expect(tiles[1].getAttribute("data-testid")).toEqual(`device-tile-${newDevice.device_id}`);
    });

    it("displays no results message when there are no devices", () => {
        const { container } = render(getComponent({ devices: {} }));

        expect(container.getElementsByClassName("mx_FilteredDeviceList_noResults")).toMatchSnapshot();
    });

    describe("filtering", () => {
        const setFilter = async (container: HTMLElement, option: DeviceSecurityVariation | string) => {
            const dropdown = container.querySelector('[aria-label="Filter devices"]');

            fireEvent.click(dropdown as Element);
            // tick to let dropdown render
            await flushPromises();

            fireEvent.click(container.querySelector(`#device-list-filter__${option}`) as Element);
        };

        it("does not display filter description when filter is falsy", () => {
            const { container } = render(getComponent({ filter: undefined }));
            const tiles = container.querySelectorAll(".mx_DeviceTile");
            expect(container.getElementsByClassName("mx_FilteredDeviceList_securityCard").length).toBeFalsy();
            expect(tiles.length).toEqual(5);
        });

        it("updates filter when prop changes", () => {
            const { container, rerender } = render(getComponent({ filter: DeviceSecurityVariation.Verified }));
            const tiles = container.querySelectorAll(".mx_DeviceTile");
            expect(tiles.length).toEqual(3);
            expect(tiles[0].getAttribute("data-testid")).toEqual(`device-tile-${newDevice.device_id}`);
            expect(tiles[1].getAttribute("data-testid")).toEqual(`device-tile-${hundredDaysOld.device_id}`);
            expect(tiles[2].getAttribute("data-testid")).toEqual(`device-tile-${verifiedNoMetadata.device_id}`);

            rerender(getComponent({ filter: DeviceSecurityVariation.Inactive }));

            const rerenderedTiles = container.querySelectorAll(".mx_DeviceTile");
            expect(rerenderedTiles.length).toEqual(2);
            expect(rerenderedTiles[0].getAttribute("data-testid")).toEqual(`device-tile-${hundredDaysOld.device_id}`);
            expect(rerenderedTiles[1].getAttribute("data-testid")).toEqual(
                `device-tile-${hundredDaysOldUnverified.device_id}`,
            );
        });

        it("calls onFilterChange handler", async () => {
            const onFilterChange = jest.fn();
            const { container } = render(getComponent({ onFilterChange }));
            await setFilter(container, DeviceSecurityVariation.Verified);

            expect(onFilterChange).toHaveBeenCalledWith(DeviceSecurityVariation.Verified);
        });

        it("calls onFilterChange handler correctly when setting filter to All", async () => {
            const onFilterChange = jest.fn();
            const { container } = render(getComponent({ onFilterChange, filter: DeviceSecurityVariation.Verified }));
            await setFilter(container, "ALL");

            // filter is cleared
            expect(onFilterChange).toHaveBeenCalledWith(undefined);
        });

        it.each([
            [DeviceSecurityVariation.Verified, [newDevice, hundredDaysOld, verifiedNoMetadata]],
            [DeviceSecurityVariation.Unverified, [hundredDaysOldUnverified, unverifiedNoMetadata]],
            [DeviceSecurityVariation.Inactive, [hundredDaysOld, hundredDaysOldUnverified]],
        ])("filters correctly for %s", (filter, expectedDevices) => {
            const { container } = render(getComponent({ filter }));
            expect(container.getElementsByClassName("mx_FilteredDeviceList_securityCard")).toMatchSnapshot();
            const tileDeviceIds = [...container.querySelectorAll(".mx_DeviceTile")].map((tile) =>
                tile.getAttribute("data-testid"),
            );
            expect(tileDeviceIds).toEqual(expectedDevices.map((device) => `device-tile-${device.device_id}`));
        });

        it.each([
            [DeviceSecurityVariation.Verified],
            [DeviceSecurityVariation.Unverified],
            [DeviceSecurityVariation.Inactive],
        ])("renders no results correctly for %s", (filter) => {
            const { container } = render(getComponent({ filter, devices: {} }));
            expect(container.getElementsByClassName("mx_FilteredDeviceList_securityCard").length).toBeFalsy();
            expect(container.getElementsByClassName("mx_FilteredDeviceList_noResults")).toMatchSnapshot();
        });

        it("clears filter from no results message", () => {
            const onFilterChange = jest.fn();
            const { getByTestId } = render(
                getComponent({
                    onFilterChange,
                    filter: DeviceSecurityVariation.Verified,
                    devices: {
                        [unverifiedNoMetadata.device_id]: unverifiedNoMetadata,
                    },
                }),
            );
            act(() => {
                fireEvent.click(getByTestId("devices-clear-filter-btn"));
            });

            expect(onFilterChange).toHaveBeenCalledWith(undefined);
        });
    });

    describe("device details", () => {
        it("renders expanded devices with device details", () => {
            const expandedDeviceIds = [newDevice.device_id, hundredDaysOld.device_id];
            const { container, getByTestId } = render(getComponent({ expandedDeviceIds }));
            expect(container.getElementsByClassName("mx_DeviceDetails").length).toBeTruthy();
            expect(getByTestId(`device-detail-${newDevice.device_id}`)).toBeTruthy();
            expect(getByTestId(`device-detail-${hundredDaysOld.device_id}`)).toBeTruthy();
        });

        it("clicking toggle calls onDeviceExpandToggle", () => {
            const onDeviceExpandToggle = jest.fn();
            const { getByTestId } = render(getComponent({ onDeviceExpandToggle }));

            act(() => {
                const tile = getByTestId(`device-tile-${hundredDaysOld.device_id}`);
                const toggle = tile.querySelector('[aria-label="Show details"]');
                fireEvent.click(toggle as Element);
            });

            expect(onDeviceExpandToggle).toHaveBeenCalledWith(hundredDaysOld.device_id);
        });
    });
});
