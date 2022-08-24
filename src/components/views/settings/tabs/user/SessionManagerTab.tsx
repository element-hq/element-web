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

import React, { useState } from 'react';

import { _t } from "../../../../../languageHandler";
import { useOwnDevices } from '../../devices/useOwnDevices';
import SettingsSubsection from '../../shared/SettingsSubsection';
import FilteredDeviceList from '../../devices/FilteredDeviceList';
import CurrentDeviceSection from '../../devices/CurrentDeviceSection';
import SecurityRecommendations from '../../devices/SecurityRecommendations';
import { DeviceSecurityVariation, DeviceWithVerification } from '../../devices/types';
import SettingsTab from '../SettingsTab';

const SessionManagerTab: React.FC = () => {
    const { devices, currentDeviceId, isLoading } = useOwnDevices();
    const [filter, setFilter] = useState<DeviceSecurityVariation>();
    const [expandedDeviceIds, setExpandedDeviceIds] = useState([]);

    const onDeviceExpandToggle = (deviceId: DeviceWithVerification['device_id']): void => {
        if (expandedDeviceIds.includes(deviceId)) {
            setExpandedDeviceIds(expandedDeviceIds.filter(id => id !== deviceId));
        } else {
            setExpandedDeviceIds([...expandedDeviceIds, deviceId]);
        }
    };

    const { [currentDeviceId]: currentDevice, ...otherDevices } = devices;
    const shouldShowOtherSessions = Object.keys(otherDevices).length > 0;

    return <SettingsTab heading={_t('Sessions')}>
        <SecurityRecommendations devices={devices} />
        <CurrentDeviceSection
            device={currentDevice}
            isLoading={isLoading}
        />
        {
            shouldShowOtherSessions &&
            <SettingsSubsection
                heading={_t('Other sessions')}
                description={_t(
                    `For best security, verify your sessions and sign out ` +
                    `from any session that you don't recognize or use anymore.`,
                )}
                data-testid='other-sessions-section'
            >
                <FilteredDeviceList
                    devices={otherDevices}
                    filter={filter}
                    expandedDeviceIds={expandedDeviceIds}
                    onFilterChange={setFilter}
                    onDeviceExpandToggle={onDeviceExpandToggle}
                />
            </SettingsSubsection>
        }
    </SettingsTab>;
};

export default SessionManagerTab;
