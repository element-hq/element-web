/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState } from "react";
import { type LocalNotificationSettings } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../languageHandler";
import Spinner from "../../elements/Spinner";
import { SettingsSubsection } from "../shared/SettingsSubsection";
import { SettingsSubsectionHeading } from "../shared/SettingsSubsectionHeading";
import DeviceDetails from "./DeviceDetails";
import { DeviceExpandDetailsButton } from "./DeviceExpandDetailsButton";
import DeviceTile from "./DeviceTile";
import { DeviceVerificationStatusCard } from "./DeviceVerificationStatusCard";
import { type ExtendedDevice } from "./types";
import { KebabContextMenu } from "../../context_menus/KebabContextMenu";
import { IconizedContextMenuOption } from "../../context_menus/IconizedContextMenu";

interface Props {
    device?: ExtendedDevice;
    isLoading: boolean;
    isSigningOut: boolean;
    localNotificationSettings?: LocalNotificationSettings;
    // number of other sessions the user has
    // excludes current session
    otherSessionsCount: number;
    setPushNotifications: (deviceId: string, enabled: boolean) => Promise<void>;
    onVerifyCurrentDevice: () => void;
    onSignOutCurrentDevice: () => void;
    signOutAllOtherSessions?: () => void;
    saveDeviceName: (deviceName: string) => Promise<void>;
    delegatedAuthAccountUrl?: string;
}

type CurrentDeviceSectionHeadingProps = Pick<
    Props,
    "onSignOutCurrentDevice" | "signOutAllOtherSessions" | "otherSessionsCount"
> & {
    disabled?: boolean;
};

const CurrentDeviceSectionHeading: React.FC<CurrentDeviceSectionHeadingProps> = ({
    onSignOutCurrentDevice,
    signOutAllOtherSessions,
    otherSessionsCount,
    disabled,
}) => {
    const menuOptions = [
        <IconizedContextMenuOption
            key="sign-out"
            label={_t("action|sign_out")}
            onClick={onSignOutCurrentDevice}
            isDestructive
        />,
        ...(signOutAllOtherSessions
            ? [
                  <IconizedContextMenuOption
                      key="sign-out-all-others"
                      label={_t("settings|sessions|sign_out_all_other_sessions", { otherSessionsCount })}
                      onClick={signOutAllOtherSessions}
                      isDestructive
                  />,
              ]
            : []),
    ];
    return (
        <SettingsSubsectionHeading heading={_t("settings|sessions|current_session")}>
            <KebabContextMenu
                disabled={disabled}
                title={_t("common|options")}
                options={menuOptions}
                data-testid="current-session-menu"
            />
        </SettingsSubsectionHeading>
    );
};

const CurrentDeviceSection: React.FC<Props> = ({
    device,
    isLoading,
    isSigningOut,
    localNotificationSettings,
    otherSessionsCount,
    setPushNotifications,
    onVerifyCurrentDevice,
    onSignOutCurrentDevice,
    signOutAllOtherSessions,
    saveDeviceName,
    delegatedAuthAccountUrl,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <SettingsSubsection
            data-testid="current-session-section"
            heading={
                <CurrentDeviceSectionHeading
                    onSignOutCurrentDevice={onSignOutCurrentDevice}
                    signOutAllOtherSessions={signOutAllOtherSessions}
                    otherSessionsCount={otherSessionsCount}
                    disabled={isLoading || !device || isSigningOut}
                />
            }
        >
            {/* only show big spinner on first load */}
            {isLoading && !device && <Spinner />}
            {!!device && (
                <>
                    <DeviceTile device={device} onClick={() => setIsExpanded(!isExpanded)}>
                        <DeviceExpandDetailsButton
                            data-testid="current-session-toggle-details"
                            isExpanded={isExpanded}
                            onClick={() => setIsExpanded(!isExpanded)}
                        />
                    </DeviceTile>
                    {isExpanded ? (
                        <DeviceDetails
                            device={device}
                            localNotificationSettings={localNotificationSettings}
                            setPushNotifications={setPushNotifications}
                            isSigningOut={isSigningOut}
                            onVerifyDevice={onVerifyCurrentDevice}
                            onSignOutDevice={onSignOutCurrentDevice}
                            saveDeviceName={saveDeviceName}
                            className="mx_CurrentDeviceSection_deviceDetails"
                            delegatedAuthAccountUrl={delegatedAuthAccountUrl}
                            isCurrentDevice
                        />
                    ) : (
                        <>
                            <br />
                            <DeviceVerificationStatusCard
                                device={device}
                                onVerifyDevice={onVerifyCurrentDevice}
                                isCurrentDevice
                            />
                        </>
                    )}
                </>
            )}
        </SettingsSubsection>
    );
};

export default CurrentDeviceSection;
