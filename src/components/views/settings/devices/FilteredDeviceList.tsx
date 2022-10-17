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

import React, { ForwardedRef, forwardRef } from 'react';
import { IPusher } from 'matrix-js-sdk/src/@types/PushRules';
import { PUSHER_DEVICE_ID } from 'matrix-js-sdk/src/@types/event';
import { LocalNotificationSettings } from 'matrix-js-sdk/src/@types/local_notifications';

import { _t } from '../../../../languageHandler';
import AccessibleButton from '../../elements/AccessibleButton';
import { FilterDropdown, FilterDropdownOption } from '../../elements/FilterDropdown';
import DeviceDetails from './DeviceDetails';
import DeviceExpandDetailsButton from './DeviceExpandDetailsButton';
import DeviceSecurityCard from './DeviceSecurityCard';
import {
    filterDevicesBySecurityRecommendation,
    INACTIVE_DEVICE_AGE_DAYS,
} from './filter';
import SelectableDeviceTile from './SelectableDeviceTile';
import {
    DevicesDictionary,
    DeviceSecurityVariation,
    ExtendedDevice,
} from './types';
import { DevicesState } from './useOwnDevices';
import FilteredDeviceListHeader from './FilteredDeviceListHeader';
import Spinner from '../../elements/Spinner';

interface Props {
    devices: DevicesDictionary;
    pushers: IPusher[];
    localNotificationSettings: Map<string, LocalNotificationSettings>;
    expandedDeviceIds: ExtendedDevice['device_id'][];
    signingOutDeviceIds: ExtendedDevice['device_id'][];
    selectedDeviceIds: ExtendedDevice['device_id'][];
    filter?: DeviceSecurityVariation;
    onFilterChange: (filter: DeviceSecurityVariation | undefined) => void;
    onDeviceExpandToggle: (deviceId: ExtendedDevice['device_id']) => void;
    onSignOutDevices: (deviceIds: ExtendedDevice['device_id'][]) => void;
    saveDeviceName: DevicesState['saveDeviceName'];
    onRequestDeviceVerification?: (deviceId: ExtendedDevice['device_id']) => void;
    setPushNotifications: (deviceId: string, enabled: boolean) => Promise<void>;
    setSelectedDeviceIds: (deviceIds: ExtendedDevice['device_id'][]) => void;
    supportsMSC3881?: boolean | undefined;
}

const isDeviceSelected = (
    deviceId: ExtendedDevice['device_id'],
    selectedDeviceIds: ExtendedDevice['device_id'][],
) => selectedDeviceIds.includes(deviceId);

// devices without timestamp metadata should be sorted last
const sortDevicesByLatestActivity = (left: ExtendedDevice, right: ExtendedDevice) =>
    (right.last_seen_ts || 0) - (left.last_seen_ts || 0);

const getFilteredSortedDevices = (devices: DevicesDictionary, filter?: DeviceSecurityVariation) =>
    filterDevicesBySecurityRecommendation(Object.values(devices), filter ? [filter] : [])
        .sort(sortDevicesByLatestActivity);

const ALL_FILTER_ID = 'ALL';
type DeviceFilterKey = DeviceSecurityVariation | typeof ALL_FILTER_ID;

const FilterSecurityCard: React.FC<{ filter?: DeviceFilterKey }> = ({ filter }) => {
    switch (filter) {
        case DeviceSecurityVariation.Verified:
            return <div className='mx_FilteredDeviceList_securityCard'>
                <DeviceSecurityCard
                    variation={DeviceSecurityVariation.Verified}
                    heading={_t('Verified sessions')}
                    description={_t(
                        `For best security, sign out from any session` +
                    ` that you don't recognize or use anymore.`,
                    )}
                />
            </div>
            ;
        case DeviceSecurityVariation.Unverified:
            return <div className='mx_FilteredDeviceList_securityCard'>
                <DeviceSecurityCard
                    variation={DeviceSecurityVariation.Unverified}
                    heading={_t('Unverified sessions')}
                    description={_t(
                        `Verify your sessions for enhanced secure messaging or sign out`
                    + ` from those you don't recognize or use anymore.`,
                    )}
                />
            </div>
            ;
        case DeviceSecurityVariation.Inactive:
            return <div className='mx_FilteredDeviceList_securityCard'>
                <DeviceSecurityCard
                    variation={DeviceSecurityVariation.Inactive}
                    heading={_t('Inactive sessions')}
                    description={_t(
                        `Consider signing out from old sessions ` +
                    `(%(inactiveAgeDays)s days or older) you don't use anymore`,
                        { inactiveAgeDays: INACTIVE_DEVICE_AGE_DAYS },
                    )}
                />
            </div>
            ;
        default:
            return null;
    }
};

const getNoResultsMessage = (filter?: DeviceSecurityVariation): string => {
    switch (filter) {
        case DeviceSecurityVariation.Verified:
            return _t('No verified sessions found.');
        case DeviceSecurityVariation.Unverified:
            return _t('No unverified sessions found.');
        case DeviceSecurityVariation.Inactive:
            return _t('No inactive sessions found.');
        default:
            return _t('No sessions found.');
    }
};
interface NoResultsProps { filter?: DeviceSecurityVariation, clearFilter: () => void}
const NoResults: React.FC<NoResultsProps> = ({ filter, clearFilter }) =>
    <div className='mx_FilteredDeviceList_noResults'>
        { getNoResultsMessage(filter) }
        {
            /* No clear filter button when filter is falsy (ie 'All') */
            !!filter &&
            <>
                &nbsp;
                <AccessibleButton
                    kind='link_inline'
                    onClick={clearFilter}
                    data-testid='devices-clear-filter-btn'
                >
                    { _t('Show all') }
                </AccessibleButton>
            </>
        }
    </div>;

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
}) => <li className='mx_FilteredDeviceList_listItem'>
    <SelectableDeviceTile
        isSelected={isSelected}
        onSelect={toggleSelected}
        onClick={onDeviceExpandToggle}
        device={device}
    >
        { isSigningOut && <Spinner w={16} h={16} /> }
        <DeviceExpandDetailsButton
            isExpanded={isExpanded}
            onClick={onDeviceExpandToggle}
        />
    </SelectableDeviceTile>
    {
        isExpanded &&
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
        />
    }
</li>;

/**
 * Filtered list of devices
 * Sorted by latest activity descending
 */
export const FilteredDeviceList =
    forwardRef(({
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
    }: Props, ref: ForwardedRef<HTMLDivElement>) => {
        const sortedDevices = getFilteredSortedDevices(devices, filter);

        function getPusherForDevice(device: ExtendedDevice): IPusher | undefined {
            return pushers.find(pusher => pusher[PUSHER_DEVICE_ID.name] === device.device_id);
        }

        const toggleSelection = (deviceId: ExtendedDevice['device_id']): void => {
            if (isDeviceSelected(deviceId, selectedDeviceIds)) {
                // remove from selection
                setSelectedDeviceIds(selectedDeviceIds.filter(id => id !== deviceId));
            } else {
                setSelectedDeviceIds([...selectedDeviceIds, deviceId]);
            }
        };

        const options: FilterDropdownOption<DeviceFilterKey>[] = [
            { id: ALL_FILTER_ID, label: _t('All') },
            {
                id: DeviceSecurityVariation.Verified,
                label: _t('Verified'),
                description: _t('Ready for secure messaging'),
            },
            {
                id: DeviceSecurityVariation.Unverified,
                label: _t('Unverified'),
                description: _t('Not ready for secure messaging'),
            },
            {
                id: DeviceSecurityVariation.Inactive,
                label: _t('Inactive'),
                description: _t(
                    'Inactive for %(inactiveAgeDays)s days or longer',
                    { inactiveAgeDays: INACTIVE_DEVICE_AGE_DAYS },
                ),
            },
        ];

        const onFilterOptionChange = (filterId: DeviceFilterKey) => {
            onFilterChange(filterId === ALL_FILTER_ID ? undefined : filterId as DeviceSecurityVariation);
        };

        const isAllSelected = selectedDeviceIds.length >= sortedDevices.length;
        const toggleSelectAll = () => {
            if (isAllSelected) {
                setSelectedDeviceIds([]);
            } else {
                setSelectedDeviceIds(sortedDevices.map(device => device.device_id));
            }
        };

        const isSigningOut = !!signingOutDeviceIds.length;

        return <div className='mx_FilteredDeviceList' ref={ref}>
            <FilteredDeviceListHeader
                selectedDeviceCount={selectedDeviceIds.length}
                isAllSelected={isAllSelected}
                toggleSelectAll={toggleSelectAll}
            >
                { selectedDeviceIds.length
                    ? <>
                        <AccessibleButton
                            data-testid='sign-out-selection-cta'
                            kind='danger_inline'
                            disabled={isSigningOut}
                            onClick={() => onSignOutDevices(selectedDeviceIds)}
                            className='mx_FilteredDeviceList_headerButton'
                        >
                            { isSigningOut && <Spinner w={16} h={16} /> }
                            { _t('Sign out') }
                        </AccessibleButton>
                        <AccessibleButton
                            data-testid='cancel-selection-cta'
                            kind='content_inline'
                            disabled={isSigningOut}
                            onClick={() => setSelectedDeviceIds([])}
                            className='mx_FilteredDeviceList_headerButton'
                        >
                            { _t('Cancel') }
                        </AccessibleButton>
                    </>
                    : <FilterDropdown<DeviceFilterKey>
                        id='device-list-filter'
                        label={_t('Filter devices')}
                        value={filter || ALL_FILTER_ID}
                        onOptionChange={onFilterOptionChange}
                        options={options}
                        selectedLabel={_t('Show')}
                    />
                }
            </FilteredDeviceListHeader>
            { !!sortedDevices.length
                ? <FilterSecurityCard filter={filter} />
                : <NoResults filter={filter} clearFilter={() => onFilterChange(undefined)} />
            }
            <ol className='mx_FilteredDeviceList_list'>
                { sortedDevices.map((device) => <DeviceListItem
                    key={device.device_id}
                    device={device}
                    pusher={getPusherForDevice(device)}
                    localNotificationSettings={localNotificationSettings.get(device.device_id)}
                    isExpanded={expandedDeviceIds.includes(device.device_id)}
                    isSigningOut={signingOutDeviceIds.includes(device.device_id)}
                    isSelected={isDeviceSelected(device.device_id, selectedDeviceIds)}
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
                />,
                ) }
            </ol>
        </div>;
    });

