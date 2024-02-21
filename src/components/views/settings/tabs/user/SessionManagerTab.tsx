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

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../../languageHandler";
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
import { OidcLogoutDialog } from "../../../dialogs/oidc/OidcLogoutDialog";
import { SDKContext } from "../../../../../contexts/SDKContext";

const confirmSignOut = async (sessionsToSignOutCount: number): Promise<boolean> => {
    const { finished } = Modal.createDialog(QuestionDialog, {
        title: _t("action|sign_out"),
        description: (
            <div>
                <p>
                    {_t("settings|sessions|sign_out_confirm_description", {
                        count: sessionsToSignOutCount,
                    })}
                </p>
            </div>
        ),
        cancelButton: _t("action|cancel"),
        button: _t("action|sign_out"),
    });
    const [confirmed] = await finished;

    return !!confirmed;
};

const confirmDelegatedAuthSignOut = async (delegatedAuthAccountUrl: string, deviceId: string): Promise<boolean> => {
    const { finished } = Modal.createDialog(OidcLogoutDialog, {
        deviceId,
        delegatedAuthAccountUrl,
    });
    const [confirmed] = await finished;

    return !!confirmed;
};

const useSignOut = (
    matrixClient: MatrixClient,
    onSignoutResolvedCallback: () => Promise<void>,
    delegatedAuthAccountUrl?: string,
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
        // we can only sign out exactly one OIDC-aware device at a time
        // we should not encounter this
        if (delegatedAuthAccountUrl && deviceIds.length !== 1) {
            logger.warn("Unexpectedly tried to sign out multiple OIDC-aware devices.");
            return;
        }

        // delegated auth logout flow confirms and signs out together
        // so only confirm if we are NOT doing a delegated auth sign out
        if (!delegatedAuthAccountUrl) {
            const userConfirmedSignout = await confirmSignOut(deviceIds.length);
            if (!userConfirmedSignout) {
                return;
            }
        }

        try {
            setSigningOutDeviceIds([...signingOutDeviceIds, ...deviceIds]);

            const onSignOutFinished = async (success: boolean): Promise<void> => {
                if (success) {
                    await onSignoutResolvedCallback();
                }
                setSigningOutDeviceIds(signingOutDeviceIds.filter((deviceId) => !deviceIds.includes(deviceId)));
            };

            if (delegatedAuthAccountUrl) {
                const [deviceId] = deviceIds;
                try {
                    setSigningOutDeviceIds([...signingOutDeviceIds, deviceId]);
                    const success = await confirmDelegatedAuthSignOut(delegatedAuthAccountUrl, deviceId);
                    await onSignOutFinished(success);
                } catch (error) {
                    logger.error("Error deleting OIDC-aware sessions", error);
                }
            } else {
                await deleteDevicesWithInteractiveAuth(matrixClient, deviceIds, onSignOutFinished);
            }
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

    const sdkContext = useContext(SDKContext);
    const matrixClient = sdkContext.client!;
    /**
     * If we have a delegated auth account management URL, all sessions but the current session need to be managed in the
     * delegated auth provider.
     * See https://github.com/matrix-org/matrix-spec-proposals/pull/3824
     */
    const delegatedAuthAccountUrl = useAsyncMemo(async () => {
        await sdkContext.oidcClientStore.readyPromise; // wait for the store to be ready
        return sdkContext.oidcClientStore.accountManagementEndpoint;
    }, [sdkContext.oidcClientStore]);
    const disableMultipleSignout = !!delegatedAuthAccountUrl;

    const userId = matrixClient?.getUserId();
    const currentUserMember = (userId && matrixClient?.getUser(userId)) || undefined;
    const clientVersions = useAsyncMemo(() => matrixClient.getVersions(), [matrixClient]);
    const capabilities = useAsyncMemo(async () => matrixClient?.getCapabilities(), [matrixClient]);
    const wellKnown = useMemo(() => matrixClient?.getClientWellKnown(), [matrixClient]);

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
        delegatedAuthAccountUrl,
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

    const signOutAllOtherSessions =
        shouldShowOtherSessions && !disableMultipleSignout
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
            <SettingsSection heading={_t("settings|sessions|title")}>
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
                                signOutAllOtherSessions={signOutAllOtherSessions}
                                disabled={!!signingOutDeviceIds.length}
                            />
                        }
                        description={_t("settings|sessions|best_security_note")}
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
                            disableMultipleSignout={disableMultipleSignout}
                        />
                    </SettingsSubsection>
                )}
                <LoginWithQRSection
                    onShowQr={onShowQrClicked}
                    versions={clientVersions}
                    capabilities={capabilities}
                    wellKnown={wellKnown}
                />
            </SettingsSection>
        </SettingsTab>
    );
};

export default SessionManagerTab;
