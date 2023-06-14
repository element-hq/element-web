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

import React from "react";
import classNames from "classnames";
import { IPusher } from "matrix-js-sdk/src/@types/PushRules";
import { PUSHER_ENABLED } from "matrix-js-sdk/src/@types/event";
import { LocalNotificationSettings } from "matrix-js-sdk/src/@types/local_notifications";

import { formatDate } from "../../../../DateUtils";
import { _t } from "../../../../languageHandler";
import AccessibleButton from "../../elements/AccessibleButton";
import Spinner from "../../elements/Spinner";
import ToggleSwitch from "../../elements/ToggleSwitch";
import { DeviceDetailHeading } from "./DeviceDetailHeading";
import { DeviceVerificationStatusCard } from "./DeviceVerificationStatusCard";
import { ExtendedDevice } from "./types";

interface Props {
    device: ExtendedDevice;
    pusher?: IPusher;
    localNotificationSettings?: LocalNotificationSettings;
    isSigningOut: boolean;
    onVerifyDevice?: () => void;
    onSignOutDevice: () => void;
    saveDeviceName: (deviceName: string) => Promise<void>;
    setPushNotifications?: (deviceId: string, enabled: boolean) => Promise<void>;
    supportsMSC3881?: boolean;
    className?: string;
    isCurrentDevice?: boolean;
}

interface MetadataTable {
    id: string;
    heading?: string;
    values: { label: string; value?: string | React.ReactNode }[];
}

const DeviceDetails: React.FC<Props> = ({
    device,
    pusher,
    localNotificationSettings,
    isSigningOut,
    onVerifyDevice,
    onSignOutDevice,
    saveDeviceName,
    setPushNotifications,
    supportsMSC3881,
    className,
    isCurrentDevice,
}) => {
    const metadata: MetadataTable[] = [
        {
            id: "session",
            values: [
                { label: _t("Session ID"), value: device.device_id },
                {
                    label: _t("Last activity"),
                    value: device.last_seen_ts && formatDate(new Date(device.last_seen_ts)),
                },
            ],
        },
        {
            id: "application",
            heading: _t("Application"),
            values: [
                { label: _t("Name"), value: device.appName },
                { label: _t("Version"), value: device.appVersion },
                { label: _t("URL"), value: device.url },
            ],
        },
        {
            id: "device",
            heading: _t("Device"),
            values: [
                { label: _t("Model"), value: device.deviceModel },
                { label: _t("Operating system"), value: device.deviceOperatingSystem },
                { label: _t("Browser"), value: device.client },
                { label: _t("IP address"), value: device.last_seen_ip },
            ],
        },
    ]
        .map((section) =>
            // filter out falsy values
            ({ ...section, values: section.values.filter((row) => !!row.value) }),
        )
        .filter(
            (section) =>
                // then filter out sections with no values
                section.values.length,
        );

    const showPushNotificationSection = !!pusher || !!localNotificationSettings;

    function isPushNotificationsEnabled(pusher?: IPusher, notificationSettings?: LocalNotificationSettings): boolean {
        if (pusher) return !!pusher[PUSHER_ENABLED.name];
        if (localNotificationSettings) return !localNotificationSettings.is_silenced;
        return true;
    }

    function isCheckboxDisabled(pusher?: IPusher, notificationSettings?: LocalNotificationSettings): boolean {
        if (localNotificationSettings) return false;
        if (pusher && !supportsMSC3881) return true;
        return false;
    }

    return (
        <div className={classNames("mx_DeviceDetails", className)} data-testid={`device-detail-${device.device_id}`}>
            <section className="mx_DeviceDetails_section">
                <DeviceDetailHeading device={device} saveDeviceName={saveDeviceName} />
                <DeviceVerificationStatusCard device={device} onVerifyDevice={onVerifyDevice} isCurrentDevice />
            </section>
            <section className="mx_DeviceDetails_section">
                <p className="mx_DeviceDetails_sectionHeading">{_t("Session details")}</p>
                {metadata.map(({ heading, values, id }, index) => (
                    <table
                        className="mx_DeviceDetails_metadataTable"
                        key={index}
                        data-testid={`device-detail-metadata-${id}`}
                    >
                        {heading && (
                            <thead>
                                <tr>
                                    <th>{heading}</th>
                                </tr>
                            </thead>
                        )}
                        <tbody>
                            {values.map(({ label, value }) => (
                                <tr key={label}>
                                    <td className="mxDeviceDetails_metadataLabel">{label}</td>
                                    <td className="mxDeviceDetails_metadataValue">{value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ))}
            </section>
            {showPushNotificationSection && (
                <section
                    className="mx_DeviceDetails_section mx_DeviceDetails_pushNotifications"
                    data-testid="device-detail-push-notification"
                >
                    <ToggleSwitch
                        // For backwards compatibility, if `enabled` is missing
                        // default to `true`
                        checked={isPushNotificationsEnabled(pusher, localNotificationSettings)}
                        disabled={isCheckboxDisabled(pusher, localNotificationSettings)}
                        onChange={(checked) => setPushNotifications?.(device.device_id, checked)}
                        title={_t("Toggle push notifications on this session.")}
                        data-testid="device-detail-push-notification-checkbox"
                    />
                    <p className="mx_DeviceDetails_sectionHeading">
                        {_t("Push notifications")}
                        <small className="mx_DeviceDetails_sectionSubheading">
                            {_t("Receive push notifications on this session.")}
                        </small>
                    </p>
                </section>
            )}
            <section className="mx_DeviceDetails_section">
                <AccessibleButton
                    onClick={onSignOutDevice}
                    kind="danger_inline"
                    disabled={isSigningOut}
                    data-testid="device-detail-sign-out-cta"
                >
                    <span className="mx_DeviceDetails_signOutButtonContent">
                        {_t("Sign out of this session")}
                        {isSigningOut && <Spinner w={16} h={16} />}
                    </span>
                </AccessibleButton>
            </section>
        </div>
    );
};

export default DeviceDetails;
