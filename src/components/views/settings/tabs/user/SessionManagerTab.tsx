/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { lazy, Suspense, useCallback, useContext, useEffect, useRef, useState } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { defer } from "matrix-js-sdk/src/utils";

import { _t } from "../../../../../languageHandler";
import Modal from "../../../../../Modal";
import { SettingsSubsection } from "../../shared/SettingsSubsection";
import SetupEncryptionDialog from "../../../dialogs/security/SetupEncryptionDialog";
import VerificationRequestDialog from "../../../dialogs/VerificationRequestDialog";
import LogoutDialog from "../../../dialogs/LogoutDialog";
import { useOwnDevices } from "../../devices/useOwnDevices";
import { FilteredDeviceList } from "../../devices/FilteredDeviceList";
import CurrentDeviceSection from "../../devices/CurrentDeviceSection";
import SecurityRecommendations from "../../devices/SecurityRecommendations";
import { type ExtendedDevice } from "../../devices/types";
import { deleteDevicesWithInteractiveAuth } from "../../devices/deleteDevices";
import SettingsTab from "../SettingsTab";
import LoginWithQRSection from "../../devices/LoginWithQRSection";
import { Mode } from "../../../auth/LoginWithQR-types";
import { useAsyncMemo } from "../../../../../hooks/useAsyncMemo";
import QuestionDialog from "../../../dialogs/QuestionDialog";
import { type FilterVariation } from "../../devices/filter";
import { OtherSessionsSectionHeading } from "../../devices/OtherSessionsSectionHeading";
import { SettingsSection } from "../../shared/SettingsSection";
import { getManageDeviceUrl } from "../../../../../utils/oidc/urls.ts";
import { SDKContext } from "../../../../../contexts/SDKContext";
import Spinner from "../../../elements/Spinner";

// We import `LoginWithQR` asynchronously to avoid importing the entire Rust Crypto WASM into the main bundle.
const LoginWithQR = lazy(() => import("../../../auth/LoginWithQR"));

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

        const userConfirmedSignout = await confirmSignOut(deviceIds.length);
        if (!userConfirmedSignout) {
            return;
        }

        let success = false;
        try {
            setSigningOutDeviceIds((signingOutDeviceIds) => [...signingOutDeviceIds, ...deviceIds]);

            if (delegatedAuthAccountUrl) {
                const [deviceId] = deviceIds;
                const url = getManageDeviceUrl(delegatedAuthAccountUrl, deviceId);
                window.open(url, "_blank");
            } else {
                const deferredSuccess = defer<boolean>();
                await deleteDevicesWithInteractiveAuth(matrixClient, deviceIds, async (success) => {
                    deferredSuccess.resolve(success);
                });
                success = await deferredSuccess.promise;
            }
        } catch (error) {
            logger.error("Error deleting sessions", error);
        } finally {
            if (success) {
                await onSignoutResolvedCallback();
            }
            setSigningOutDeviceIds((signingOutDeviceIds) =>
                signingOutDeviceIds.filter((deviceId) => !deviceIds.includes(deviceId)),
            );
        }
    };

    return {
        onSignOutCurrentDevice,
        onSignOutOtherDevices,
        signingOutDeviceIds,
    };
};

const SessionManagerTab: React.FC<{
    showMsc4108QrCode?: boolean;
}> = ({ showMsc4108QrCode }) => {
    const {
        devices,
        dehydratedDeviceId,
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
    const oidcClientConfig = useAsyncMemo(async () => {
        try {
            return await matrixClient?.getAuthMetadata();
        } catch (e) {
            logger.error("Failed to discover OIDC metadata", e);
        }
    }, [matrixClient]);
    const isCrossSigningReady = useAsyncMemo(
        async () => matrixClient.getCrypto()?.isCrossSigningReady() ?? false,
        [matrixClient],
    );

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
    if (dehydratedDeviceId && otherDevices[dehydratedDeviceId]?.isVerified) {
        delete otherDevices[dehydratedDeviceId];
    }
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

    const [signInWithQrMode, setSignInWithQrMode] = useState<Mode | null>(showMsc4108QrCode ? Mode.Show : null);

    const onQrFinish = useCallback(() => {
        setSignInWithQrMode(null);
    }, [setSignInWithQrMode]);

    const onShowQrClicked = useCallback(() => {
        setSignInWithQrMode(Mode.Show);
    }, [setSignInWithQrMode]);

    if (signInWithQrMode) {
        return (
            <Suspense fallback={<Spinner />}>
                <LoginWithQR mode={signInWithQrMode} onFinished={onQrFinish} client={matrixClient} />
            </Suspense>
        );
    }

    return (
        <SettingsTab>
            <SettingsSection>
                <LoginWithQRSection
                    onShowQr={onShowQrClicked}
                    versions={clientVersions}
                    oidcClientConfig={oidcClientConfig}
                    isCrossSigningReady={isCrossSigningReady}
                />
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
                    delegatedAuthAccountUrl={delegatedAuthAccountUrl}
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
                            delegatedAuthAccountUrl={delegatedAuthAccountUrl}
                        />
                    </SettingsSubsection>
                )}
            </SettingsSection>
        </SettingsTab>
    );
};

export default SessionManagerTab;
