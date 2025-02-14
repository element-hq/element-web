/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ForwardedRef, forwardRef } from "react";
import { type IPusher, PUSHER_DEVICE_ID, type LocalNotificationSettings } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../languageHandler";
import AccessibleButton from "../../elements/AccessibleButton";
import { FilterDropdown, type FilterDropdownOption } from "../../elements/FilterDropdown";
import DeviceDetails from "./DeviceDetails";
import { DeviceExpandDetailsButton } from "./DeviceExpandDetailsButton";
import DeviceSecurityCard from "./DeviceSecurityCard";
import { filterDevicesBySecurityRecommendation, type FilterVariation, INACTIVE_DEVICE_AGE_DAYS } from "./filter";
import SelectableDeviceTile from "./SelectableDeviceTile";
import { type DevicesDictionary, DeviceSecurityVariation, type ExtendedDevice } from "./types";
import { type DevicesState } from "./useOwnDevices";
import FilteredDeviceListHeader from "./FilteredDeviceListHeader";
import Spinner from "../../elements/Spinner";
import { DeviceSecurityLearnMore } from "./DeviceSecurityLearnMore";
import DeviceTile from "./DeviceTile";

interface Props {
    devices: DevicesDictionary;
    pushers: IPusher[];
    localNotificationSettings: Map<string, LocalNotificationSettings>;
    expandedDeviceIds: ExtendedDevice["device_id"][];
    signingOutDeviceIds: ExtendedDevice["device_id"][];
    selectedDeviceIds: ExtendedDevice["device_id"][];
    filter?: FilterVariation;
    onFilterChange: (filter: FilterVariation | undefined) => void;
    onDeviceExpandToggle: (deviceId: ExtendedDevice["device_id"]) => void;
    onSignOutDevices: (deviceIds: ExtendedDevice["device_id"][]) => void;
    saveDeviceName: DevicesState["saveDeviceName"];
    onRequestDeviceVerification?: (deviceId: ExtendedDevice["device_id"]) => void;
    setPushNotifications: (deviceId: string, enabled: boolean) => Promise<void>;
    setSelectedDeviceIds: (deviceIds: ExtendedDevice["device_id"][]) => void;
    supportsMSC3881?: boolean | undefined;
    /**
     * If the user's account is managed externally then sessions must be signed out individually
     * Removes checkboxes and multi selection header
     * Removes session info as that can be seen in the account management
     * Changes sign out button to be a manage button
     */
    delegatedAuthAccountUrl?: string;
}

const isDeviceSelected = (
    deviceId: ExtendedDevice["device_id"],
    selectedDeviceIds: ExtendedDevice["device_id"][],
): boolean => selectedDeviceIds.includes(deviceId);

// devices without timestamp metadata should be sorted last
const sortDevicesByLatestActivityThenDisplayName = (left: ExtendedDevice, right: ExtendedDevice): number =>
    (right.last_seen_ts || 0) - (left.last_seen_ts || 0) ||
    (left.display_name || left.device_id).localeCompare(right.display_name || right.device_id);

const getFilteredSortedDevices = (devices: DevicesDictionary, filter?: FilterVariation): ExtendedDevice[] =>
    filterDevicesBySecurityRecommendation(Object.values(devices), filter ? [filter] : []).sort(
        sortDevicesByLatestActivityThenDisplayName,
    );

const ALL_FILTER_ID = "ALL";
type DeviceFilterKey = FilterVariation | typeof ALL_FILTER_ID;

const isSecurityVariation = (filter?: DeviceFilterKey): filter is FilterVariation =>
    !!filter &&
    (
        [
            DeviceSecurityVariation.Inactive,
            DeviceSecurityVariation.Unverified,
            DeviceSecurityVariation.Verified,
        ] as string[]
    ).includes(filter);

const FilterSecurityCard: React.FC<{ filter?: DeviceFilterKey }> = ({ filter }) => {
    if (isSecurityVariation(filter)) {
        const securityCardContent: Record<
            DeviceSecurityVariation,
            {
                title: string;
                description: string;
            }
        > = {
            [DeviceSecurityVariation.Verified]: {
                title: _t("settings|sessions|verified_sessions"),
                description: _t("settings|sessions|verified_sessions_list_description"),
            },
            [DeviceSecurityVariation.Unverified]: {
                title: _t("settings|sessions|unverified_sessions"),
                description: _t("settings|sessions|unverified_sessions_list_description"),
            },
            [DeviceSecurityVariation.Unverifiable]: {
                title: _t("settings|sessions|unverified_session"),
                description: _t("settings|sessions|unverified_session_explainer_1"),
            },
            [DeviceSecurityVariation.Inactive]: {
                title: _t("settings|sessions|inactive_sessions"),
                description: _t("settings|sessions|inactive_sessions_list_description", {
                    inactiveAgeDays: INACTIVE_DEVICE_AGE_DAYS,
                }),
            },
        };

        const { title, description } = securityCardContent[filter];
        return (
            <div className="mx_FilteredDeviceList_securityCard">
                <DeviceSecurityCard
                    variation={filter}
                    heading={title}
                    description={
                        <span>
                            {description}
                            <DeviceSecurityLearnMore variation={filter} />
                        </span>
                    }
                />
            </div>
        );
    }

    return null;
};

const getNoResultsMessage = (filter?: FilterVariation): string => {
    switch (filter) {
        case DeviceSecurityVariation.Verified:
            return _t("settings|sessions|no_verified_sessions");
        case DeviceSecurityVariation.Unverified:
            return _t("settings|sessions|no_unverified_sessions");
        case DeviceSecurityVariation.Inactive:
            return _t("settings|sessions|no_inactive_sessions");
        default:
            return _t("settings|sessions|no_sessions");
    }
};
interface NoResultsProps {
    filter?: FilterVariation;
    clearFilter: () => void;
}
const NoResults: React.FC<NoResultsProps> = ({ filter, clearFilter }) => (
    <div className="mx_FilteredDeviceList_noResults">
        {getNoResultsMessage(filter)}
        {
            /* No clear filter button when filter is falsy (ie 'All') */
            !!filter && (
                <>
                    &nbsp;
                    <AccessibleButton kind="link_inline" onClick={clearFilter} data-testid="devices-clear-filter-btn">
                        {_t("action|show_all")}
                    </AccessibleButton>
                </>
            )
        }
    </div>
);

const DeviceListItem: React.FC<{
    device: ExtendedDevice;
    pusher?: IPusher | undefined;
    localNotificationSettings?: LocalNotificationSettings | undefined;
    isExpanded: boolean;
    isSigningOut: boolean;
    isSelected: boolean;
    onDeviceExpandToggle: () => void;
    onSignOutDevice: () => void;
    saveDeviceName: (deviceName: string) => Promise<void>;
    onRequestDeviceVerification?: () => void;
    toggleSelected: () => void;
    setPushNotifications: (deviceId: string, enabled: boolean) => Promise<void>;
    supportsMSC3881?: boolean | undefined;
    isSelectDisabled?: boolean;
    delegatedAuthAccountUrl?: string;
}> = ({
    device,
    pusher,
    localNotificationSettings,
    isExpanded,
    isSigningOut,
    isSelected,
    onDeviceExpandToggle,
    onSignOutDevice,
    saveDeviceName,
    onRequestDeviceVerification,
    setPushNotifications,
    toggleSelected,
    supportsMSC3881,
    isSelectDisabled,
    delegatedAuthAccountUrl,
}) => {
    const tileContent = (
        <>
            {isSigningOut && <Spinner w={16} h={16} />}
            <DeviceExpandDetailsButton isExpanded={isExpanded} onClick={onDeviceExpandToggle} />
        </>
    );
    return (
        <li className="mx_FilteredDeviceList_listItem">
            {isSelectDisabled ? (
                <DeviceTile device={device} onClick={onDeviceExpandToggle}>
                    {tileContent}
                </DeviceTile>
            ) : (
                <SelectableDeviceTile
                    isSelected={isSelected}
                    onSelect={toggleSelected}
                    onClick={onDeviceExpandToggle}
                    device={device}
                >
                    {tileContent}
                </SelectableDeviceTile>
            )}
            {isExpanded && (
                <DeviceDetails
                    device={device}
                    pusher={pusher}
                    localNotificationSettings={localNotificationSettings}
                    isSigningOut={isSigningOut}
                    onVerifyDevice={onRequestDeviceVerification}
                    onSignOutDevice={onSignOutDevice}
                    saveDeviceName={saveDeviceName}
                    setPushNotifications={setPushNotifications}
                    supportsMSC3881={supportsMSC3881}
                    className="mx_FilteredDeviceList_deviceDetails"
                    delegatedAuthAccountUrl={delegatedAuthAccountUrl}
                />
            )}
        </li>
    );
};

/**
 * Filtered list of devices
 * Sorted by latest activity descending
 */
export const FilteredDeviceList = forwardRef(
    (
        {
            devices,
            pushers,
            localNotificationSettings,
            filter,
            expandedDeviceIds,
            signingOutDeviceIds,
            selectedDeviceIds,
            onFilterChange,
            onDeviceExpandToggle,
            saveDeviceName,
            onSignOutDevices,
            onRequestDeviceVerification,
            setPushNotifications,
            setSelectedDeviceIds,
            supportsMSC3881,
            delegatedAuthAccountUrl,
        }: Props,
        ref: ForwardedRef<HTMLDivElement>,
    ) => {
        const sortedDevices = getFilteredSortedDevices(devices, filter);

        function getPusherForDevice(device: ExtendedDevice): IPusher | undefined {
            return pushers.find((pusher) => pusher[PUSHER_DEVICE_ID.name] === device.device_id);
        }

        const toggleSelection = (deviceId: ExtendedDevice["device_id"]): void => {
            if (isDeviceSelected(deviceId, selectedDeviceIds)) {
                // remove from selection
                setSelectedDeviceIds(selectedDeviceIds.filter((id) => id !== deviceId));
            } else {
                setSelectedDeviceIds([...selectedDeviceIds, deviceId]);
            }
        };

        const options: FilterDropdownOption<DeviceFilterKey>[] = [
            { id: ALL_FILTER_ID, label: _t("settings|sessions|filter_all") },
            {
                id: DeviceSecurityVariation.Verified,
                label: _t("common|verified"),
                description: _t("settings|sessions|filter_verified_description"),
            },
            {
                id: DeviceSecurityVariation.Unverified,
                label: _t("common|unverified"),
                description: _t("settings|sessions|filter_unverified_description"),
            },
            {
                id: DeviceSecurityVariation.Inactive,
                label: _t("settings|sessions|filter_inactive"),
                description: _t("settings|sessions|filter_inactive_description", {
                    inactiveAgeDays: INACTIVE_DEVICE_AGE_DAYS,
                }),
            },
        ];

        const onFilterOptionChange = (filterId: DeviceFilterKey): void => {
            onFilterChange(filterId === ALL_FILTER_ID ? undefined : (filterId as FilterVariation));
        };

        const isAllSelected = selectedDeviceIds.length >= sortedDevices.length;
        const toggleSelectAll = (): void => {
            if (isAllSelected) {
                setSelectedDeviceIds([]);
            } else {
                setSelectedDeviceIds(sortedDevices.map((device) => device.device_id));
            }
        };

        const isSigningOut = !!signingOutDeviceIds.length;

        return (
            <div className="mx_FilteredDeviceList" ref={ref}>
                <FilteredDeviceListHeader
                    selectedDeviceCount={selectedDeviceIds.length}
                    isAllSelected={isAllSelected}
                    toggleSelectAll={toggleSelectAll}
                    isSelectDisabled={!!delegatedAuthAccountUrl}
                >
                    {selectedDeviceIds.length ? (
                        <>
                            <AccessibleButton
                                data-testid="sign-out-selection-cta"
                                kind="danger_inline"
                                disabled={isSigningOut}
                                onClick={() => onSignOutDevices(selectedDeviceIds)}
                                className="mx_FilteredDeviceList_headerButton"
                            >
                                {isSigningOut && <Spinner w={16} h={16} />}
                                {_t("action|sign_out")}
                            </AccessibleButton>
                            <AccessibleButton
                                data-testid="cancel-selection-cta"
                                kind="content_inline"
                                disabled={isSigningOut}
                                onClick={() => setSelectedDeviceIds([])}
                                className="mx_FilteredDeviceList_headerButton"
                            >
                                {_t("action|cancel")}
                            </AccessibleButton>
                        </>
                    ) : (
                        <FilterDropdown<DeviceFilterKey>
                            id="device-list-filter"
                            label={_t("settings|sessions|filter_label")}
                            value={filter || ALL_FILTER_ID}
                            onOptionChange={onFilterOptionChange}
                            options={options}
                            selectedLabel={_t("action|show")}
                        />
                    )}
                </FilteredDeviceListHeader>
                {!!sortedDevices.length ? (
                    <FilterSecurityCard filter={filter} />
                ) : (
                    <NoResults filter={filter} clearFilter={() => onFilterChange(undefined)} />
                )}
                <ol className="mx_FilteredDeviceList_list">
                    {sortedDevices.map((device) => (
                        <DeviceListItem
                            key={device.device_id}
                            device={device}
                            pusher={getPusherForDevice(device)}
                            localNotificationSettings={localNotificationSettings.get(device.device_id)}
                            isExpanded={expandedDeviceIds.includes(device.device_id)}
                            isSigningOut={signingOutDeviceIds.includes(device.device_id)}
                            isSelected={isDeviceSelected(device.device_id, selectedDeviceIds)}
                            isSelectDisabled={!!delegatedAuthAccountUrl}
                            onDeviceExpandToggle={() => onDeviceExpandToggle(device.device_id)}
                            onSignOutDevice={() => onSignOutDevices([device.device_id])}
                            saveDeviceName={(deviceName: string) => saveDeviceName(device.device_id, deviceName)}
                            onRequestDeviceVerification={
                                onRequestDeviceVerification
                                    ? () => onRequestDeviceVerification(device.device_id)
                                    : undefined
                            }
                            setPushNotifications={setPushNotifications}
                            toggleSelected={() => toggleSelection(device.device_id)}
                            supportsMSC3881={supportsMSC3881}
                            delegatedAuthAccountUrl={delegatedAuthAccountUrl}
                        />
                    ))}
                </ol>
            </div>
        );
    },
);
