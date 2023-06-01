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

import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../../languageHandler";
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";
import Modal from "../../../../../Modal";
import SettingsSubsection from "../../shared/SettingsSubsection";
import SetupEncryptionDialog from "../../../dialogs/security/SetupEncryptionDialog";
import VerificationRequestDialog from "../../../dialogs/VerificationRequestDialog";
import LogoutDialog from "../../../dialogs/LogoutDialog";
import { useOwnDevices } from "../../devices/useOwnDevices";
import { FilteredDeviceList } from "../../devices/FilteredDeviceList";
import CurrentDeviceSection from "../../devices/CurrentDeviceSection";
import SecurityRecommendations from "../../devices/SecurityRecommendations";
import { ExtendedDevice } from "../../devices/types";
import { deleteDevicesWithInteractiveAuth } from "../../devices/deleteDevices";
import SettingsTab from "../SettingsTab";
import LoginWithQRSection from "../../devices/LoginWithQRSection";
import LoginWithQR, { Mode } from "../../../auth/LoginWithQR";
import { useAsyncMemo } from "../../../../../hooks/useAsyncMemo";
import QuestionDialog from "../../../dialogs/QuestionDialog";
import { FilterVariation } from "../../devices/filter";
import { OtherSessionsSectionHeading } from "../../devices/OtherSessionsSectionHeading";
import { SettingsSection } from "../../shared/SettingsSection";

const confirmSignOut = async (sessionsToSignOutCount: number): Promise<boolean> => {
    const { finished } = Modal.createDialog(QuestionDialog, {
        title: _t("Sign out"),
        description: (
            <div>
                <p>
                    {_t("Are you sure you want to sign out of %(count)s sessions?", {
                        count: sessionsToSignOutCount,
                    })}
                </p>
            </div>
        ),
        cancelButton: _t("Cancel"),
        button: _t("Sign out"),
    });
    const [confirmed] = await finished;

    return !!confirmed;
};

const useSignOut = (
    matrixClient: MatrixClient,
    onSignoutResolvedCallback: () => Promise<void>,
): {
    onSignOutCurrentDevice: () => void;
    onSignOutOtherDevices: (deviceIds: ExtendedDevice["device_id"][]) => Promise<void>;
    signingOutDeviceIds: ExtendedDevice["device_id"][];
} => {
    const [signingOutDeviceIds, setSigningOutDeviceIds] = useState<ExtendedDevice["device_id"][]>([]);

    const onSignOutCurrentDevice = (): void => {
        Modal.createDialog(
            LogoutDialog,
            {}, // props,
            undefined, // className
            false, // isPriority
            true, // isStatic
        );
    };

    const onSignOutOtherDevices = async (deviceIds: ExtendedDevice["device_id"][]): Promise<void> => {
        if (!deviceIds.length) {
            return;
        }
        const userConfirmedSignout = await confirmSignOut(deviceIds.length);
        if (!userConfirmedSignout) {
            return;
        }

        try {
            setSigningOutDeviceIds([...signingOutDeviceIds, ...deviceIds]);
            await deleteDevicesWithInteractiveAuth(matrixClient, deviceIds, async (success): Promise<void> => {
                if (success) {
                    await onSignoutResolvedCallback();
                }
                setSigningOutDeviceIds(signingOutDeviceIds.filter((deviceId) => !deviceIds.includes(deviceId)));
            });
        } catch (error) {
            logger.error("Error deleting sessions", error);
            setSigningOutDeviceIds(signingOutDeviceIds.filter((deviceId) => !deviceIds.includes(deviceId)));
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
        pushers,
        localNotificationSettings,
        currentDeviceId,
        isLoadingDeviceList,
        requestDeviceVerification,
        refreshDevices,
        saveDeviceName,
        setPushNotifications,
        supportsMSC3881,
    } = useOwnDevices();
    const [filter, setFilter] = useState<FilterVariation>();
    const [expandedDeviceIds, setExpandedDeviceIds] = useState<ExtendedDevice["device_id"][]>([]);
    const [selectedDeviceIds, setSelectedDeviceIds] = useState<ExtendedDevice["device_id"][]>([]);
    const filteredDeviceListRef = useRef<HTMLDivElement>(null);
    const scrollIntoViewTimeoutRef = useRef<number>();

    const matrixClient = useContext(MatrixClientContext);
    const userId = matrixClient?.getUserId();
    const currentUserMember = (userId && matrixClient?.getUser(userId)) || undefined;
    const clientVersions = useAsyncMemo(() => matrixClient.getVersions(), [matrixClient]);
    const capabilities = useAsyncMemo(async () => matrixClient?.getCapabilities(), [matrixClient]);

    const onDeviceExpandToggle = (deviceId: ExtendedDevice["device_id"]): void => {
        if (expandedDeviceIds.includes(deviceId)) {
            setExpandedDeviceIds(expandedDeviceIds.filter((id) => id !== deviceId));
        } else {
            setExpandedDeviceIds([...expandedDeviceIds, deviceId]);
        }
    };

    const onGoToFilteredList = (filter: FilterVariation): void => {
        setFilter(filter);
        clearTimeout(scrollIntoViewTimeoutRef.current);
        // wait a tick for the filtered section to rerender with different height
        scrollIntoViewTimeoutRef.current = window.setTimeout(() =>
            filteredDeviceListRef.current?.scrollIntoView({
                // align element to top of scrollbox
                block: "start",
                inline: "nearest",
                behavior: "smooth",
            }),
        );
    };

    const { [currentDeviceId]: currentDevice, ...otherDevices } = devices;
    const otherSessionsCount = Object.keys(otherDevices).length;
    const shouldShowOtherSessions = otherSessionsCount > 0;

    const onVerifyCurrentDevice = (): void => {
        Modal.createDialog(SetupEncryptionDialog, { onFinished: refreshDevices });
    };

    const onTriggerDeviceVerification = useCallback(
        (deviceId: ExtendedDevice["device_id"]) => {
            if (!requestDeviceVerification) {
                return;
            }
            const verificationRequestPromise = requestDeviceVerification(deviceId);
            Modal.createDialog(VerificationRequestDialog, {
                verificationRequestPromise,
                member: currentUserMember,
                onFinished: async (): Promise<void> => {
                    const request = await verificationRequestPromise;
                    request.cancel();
                    await refreshDevices();
                },
            });
        },
        [requestDeviceVerification, refreshDevices, currentUserMember],
    );

    const onSignoutResolvedCallback = async (): Promise<void> => {
        await refreshDevices();
        setSelectedDeviceIds([]);
    };
    const { onSignOutCurrentDevice, onSignOutOtherDevices, signingOutDeviceIds } = useSignOut(
        matrixClient,
        onSignoutResolvedCallback,
    );

    useEffect(
        () => () => {
            clearTimeout(scrollIntoViewTimeoutRef.current);
        },
        [scrollIntoViewTimeoutRef],
    );

    // clear selection when filter changes
    useEffect(() => {
        setSelectedDeviceIds([]);
    }, [filter, setSelectedDeviceIds]);

    const signOutAllOtherSessions = shouldShowOtherSessions
        ? () => {
              onSignOutOtherDevices(Object.keys(otherDevices));
          }
        : undefined;

    const [signInWithQrMode, setSignInWithQrMode] = useState<Mode | null>();

    const onQrFinish = useCallback(() => {
        setSignInWithQrMode(null);
    }, [setSignInWithQrMode]);

    const onShowQrClicked = useCallback(() => {
        setSignInWithQrMode(Mode.Show);
    }, [setSignInWithQrMode]);

    if (signInWithQrMode) {
        return <LoginWithQR mode={signInWithQrMode} onFinished={onQrFinish} client={matrixClient} />;
    }

    return (
        <SettingsTab>
            <SettingsSection heading={_t("Sessions")}>
                <SecurityRecommendations
                    devices={devices}
                    goToFilteredList={onGoToFilteredList}
                    currentDeviceId={currentDeviceId}
                />
                <CurrentDeviceSection
                    device={currentDevice}
                    localNotificationSettings={localNotificationSettings.get(currentDeviceId)}
                    setPushNotifications={setPushNotifications}
                    isSigningOut={signingOutDeviceIds.includes(currentDeviceId)}
                    isLoading={isLoadingDeviceList}
                    saveDeviceName={(deviceName) => saveDeviceName(currentDeviceId, deviceName)}
                    onVerifyCurrentDevice={onVerifyCurrentDevice}
                    onSignOutCurrentDevice={onSignOutCurrentDevice}
                    signOutAllOtherSessions={signOutAllOtherSessions}
                    otherSessionsCount={otherSessionsCount}
                />
                {shouldShowOtherSessions && (
                    <SettingsSubsection
                        heading={
                            <OtherSessionsSectionHeading
                                otherSessionsCount={otherSessionsCount}
                                signOutAllOtherSessions={signOutAllOtherSessions!}
                                disabled={!!signingOutDeviceIds.length}
                            />
                        }
                        description={_t(
                            `For best security, verify your sessions and sign out ` +
                                `from any session that you don't recognize or use anymore.`,
                        )}
                        data-testid="other-sessions-section"
                        stretchContent
                    >
                        <FilteredDeviceList
                            devices={otherDevices}
                            pushers={pushers}
                            localNotificationSettings={localNotificationSettings}
                            filter={filter}
                            expandedDeviceIds={expandedDeviceIds}
                            signingOutDeviceIds={signingOutDeviceIds}
                            selectedDeviceIds={selectedDeviceIds}
                            setSelectedDeviceIds={setSelectedDeviceIds}
                            onFilterChange={setFilter}
                            onDeviceExpandToggle={onDeviceExpandToggle}
                            onRequestDeviceVerification={
                                requestDeviceVerification ? onTriggerDeviceVerification : undefined
                            }
                            onSignOutDevices={onSignOutOtherDevices}
                            saveDeviceName={saveDeviceName}
                            setPushNotifications={setPushNotifications}
                            ref={filteredDeviceListRef}
                            supportsMSC3881={supportsMSC3881}
                        />
                    </SettingsSubsection>
                )}
                <LoginWithQRSection onShowQr={onShowQrClicked} versions={clientVersions} capabilities={capabilities} />
            </SettingsSection>
        </SettingsTab>
    );
};

export default SessionManagerTab;
