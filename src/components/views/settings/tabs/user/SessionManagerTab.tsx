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

import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { MatrixClient } from 'matrix-js-sdk/src/client';
import { logger } from 'matrix-js-sdk/src/logger';

import { _t } from "../../../../../languageHandler";
import { DevicesState, useOwnDevices } from '../../devices/useOwnDevices';
import SettingsSubsection from '../../shared/SettingsSubsection';
import { FilteredDeviceList } from '../../devices/FilteredDeviceList';
import CurrentDeviceSection from '../../devices/CurrentDeviceSection';
import SecurityRecommendations from '../../devices/SecurityRecommendations';
import { DeviceSecurityVariation, DeviceWithVerification } from '../../devices/types';
import SettingsTab from '../SettingsTab';
import Modal from '../../../../../Modal';
import SetupEncryptionDialog from '../../../dialogs/security/SetupEncryptionDialog';
import VerificationRequestDialog from '../../../dialogs/VerificationRequestDialog';
import LogoutDialog from '../../../dialogs/LogoutDialog';
import MatrixClientContext from '../../../../../contexts/MatrixClientContext';
import { deleteDevicesWithInteractiveAuth } from '../../devices/deleteDevices';

const useSignOut = (
    matrixClient: MatrixClient,
    refreshDevices: DevicesState['refreshDevices'],
): {
        onSignOutCurrentDevice: () => void;
        onSignOutOtherDevices: (deviceIds: DeviceWithVerification['device_id'][]) => Promise<void>;
        signingOutDeviceIds: DeviceWithVerification['device_id'][];
    } => {
    const [signingOutDeviceIds, setSigningOutDeviceIds] = useState<DeviceWithVerification['device_id'][]>([]);

    const onSignOutCurrentDevice = () => {
        Modal.createDialog(
            LogoutDialog,
            {}, // props,
            undefined, // className
            false, // isPriority
            true, // isStatic
        );
    };

    const onSignOutOtherDevices = async (deviceIds: DeviceWithVerification['device_id'][]) => {
        if (!deviceIds.length) {
            return;
        }
        try {
            setSigningOutDeviceIds([...signingOutDeviceIds, ...deviceIds]);
            await deleteDevicesWithInteractiveAuth(
                matrixClient,
                deviceIds,
                async (success) => {
                    if (success) {
                        // @TODO(kerrya) clear selection if was bulk deletion
                        // when added in PSG-659
                        await refreshDevices();
                    }
                    setSigningOutDeviceIds(signingOutDeviceIds.filter(deviceId => !deviceIds.includes(deviceId)));
                },
            );
        } catch (error) {
            logger.error("Error deleting sessions", error);
            setSigningOutDeviceIds(signingOutDeviceIds.filter(deviceId => !deviceIds.includes(deviceId)));
        }
    };

    return {
        onSignOutCurrentDevice,
        onSignOutOtherDevices,
        signingOutDeviceIds,
    };
};

const SessionManagerTab: React.FC = () => {
    const {
        devices,
        currentDeviceId,
        isLoadingDeviceList,
        requestDeviceVerification,
        refreshDevices,
        saveDeviceName,
    } = useOwnDevices();
    const [filter, setFilter] = useState<DeviceSecurityVariation>();
    const [expandedDeviceIds, setExpandedDeviceIds] = useState<DeviceWithVerification['device_id'][]>([]);
    const filteredDeviceListRef = useRef<HTMLDivElement>(null);
    const scrollIntoViewTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

    const matrixClient = useContext(MatrixClientContext);
    const userId = matrixClient.getUserId();
    const currentUserMember = userId && matrixClient.getUser(userId) || undefined;

    const onDeviceExpandToggle = (deviceId: DeviceWithVerification['device_id']): void => {
        if (expandedDeviceIds.includes(deviceId)) {
            setExpandedDeviceIds(expandedDeviceIds.filter(id => id !== deviceId));
        } else {
            setExpandedDeviceIds([...expandedDeviceIds, deviceId]);
        }
    };

    const onGoToFilteredList = (filter: DeviceSecurityVariation) => {
        setFilter(filter);
        // @TODO(kerrya) clear selection when added in PSG-659
        clearTimeout(scrollIntoViewTimeoutRef.current);
        // wait a tick for the filtered section to rerender with different height
        scrollIntoViewTimeoutRef.current =
            window.setTimeout(() => filteredDeviceListRef.current?.scrollIntoView({
                // align element to top of scrollbox
                block: 'start',
                inline: 'nearest',
                behavior: 'smooth',
            }));
    };

    const { [currentDeviceId]: currentDevice, ...otherDevices } = devices;
    const shouldShowOtherSessions = Object.keys(otherDevices).length > 0;

    const onVerifyCurrentDevice = () => {
        Modal.createDialog(
            SetupEncryptionDialog as unknown as React.ComponentType,
            { onFinished: refreshDevices },
        );
    };

    const onTriggerDeviceVerification = useCallback((deviceId: DeviceWithVerification['device_id']) => {
        if (!requestDeviceVerification) {
            return;
        }
        const verificationRequestPromise = requestDeviceVerification(deviceId);
        Modal.createDialog(VerificationRequestDialog, {
            verificationRequestPromise,
            member: currentUserMember,
            onFinished: async () => {
                const request = await verificationRequestPromise;
                request.cancel();
                await refreshDevices();
            },
        });
    }, [requestDeviceVerification, refreshDevices, currentUserMember]);

    const {
        onSignOutCurrentDevice,
        onSignOutOtherDevices,
        signingOutDeviceIds,
    } = useSignOut(matrixClient, refreshDevices);

    useEffect(() => () => {
        clearTimeout(scrollIntoViewTimeoutRef.current);
    }, [scrollIntoViewTimeoutRef]);

    return <SettingsTab heading={_t('Sessions')}>
        <SecurityRecommendations
            devices={devices}
            goToFilteredList={onGoToFilteredList}
            currentDeviceId={currentDeviceId}
        />
        <CurrentDeviceSection
            device={currentDevice}
            isSigningOut={signingOutDeviceIds.includes(currentDevice?.device_id)}
            isLoading={isLoadingDeviceList}
            saveDeviceName={(deviceName) => saveDeviceName(currentDevice?.device_id, deviceName)}
            onVerifyCurrentDevice={onVerifyCurrentDevice}
            onSignOutCurrentDevice={onSignOutCurrentDevice}
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
                    signingOutDeviceIds={signingOutDeviceIds}
                    onFilterChange={setFilter}
                    onDeviceExpandToggle={onDeviceExpandToggle}
                    onRequestDeviceVerification={requestDeviceVerification ? onTriggerDeviceVerification : undefined}
                    onSignOutDevices={onSignOutOtherDevices}
                    saveDeviceName={saveDeviceName}
                    ref={filteredDeviceListRef}
                />
            </SettingsSubsection>
        }
    </SettingsTab>;
};

export default SessionManagerTab;
