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

import React, { useState } from "react";
import { LocalNotificationSettings } from "matrix-js-sdk/src/@types/local_notifications";

import { _t } from "../../../../languageHandler";
import Spinner from "../../elements/Spinner";
import SettingsSubsection from "../shared/SettingsSubsection";
import { SettingsSubsectionHeading } from "../shared/SettingsSubsectionHeading";
import DeviceDetails from "./DeviceDetails";
import { DeviceExpandDetailsButton } from "./DeviceExpandDetailsButton";
import DeviceTile from "./DeviceTile";
import { DeviceVerificationStatusCard } from "./DeviceVerificationStatusCard";
import { ExtendedDevice } from "./types";
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
            label={_t("Sign out")}
            onClick={onSignOutCurrentDevice}
            isDestructive
        />,
        ...(signOutAllOtherSessions
            ? [
                  <IconizedContextMenuOption
                      key="sign-out-all-others"
                      label={_t("Sign out of all other sessions (%(otherSessionsCount)s)", { otherSessionsCount })}
                      onClick={signOutAllOtherSessions}
                      isDestructive
                  />,
              ]
            : []),
    ];
    return (
        <SettingsSubsectionHeading heading={_t("Current session")}>
            <KebabContextMenu
                disabled={disabled}
                title={_t("Options")}
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
