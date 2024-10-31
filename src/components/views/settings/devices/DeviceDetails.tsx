/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";
import { IPusher, PUSHER_ENABLED, LocalNotificationSettings } from "matrix-js-sdk/src/matrix";

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
                { label: _t("settings|sessions|session_id"), value: device.device_id },
                {
                    label: _t("settings|sessions|last_activity"),
                    value: device.last_seen_ts && formatDate(new Date(device.last_seen_ts)),
                },
            ],
        },
        {
            id: "application",
            heading: _t("common|application"),
            values: [
                { label: _t("common|name"), value: device.appName },
                { label: _t("common|version"), value: device.appVersion },
                { label: _t("settings|sessions|url"), value: device.url },
            ],
        },
        {
            id: "device",
            heading: _t("common|device"),
            values: [
                { label: _t("common|model"), value: device.deviceModel },
                { label: _t("settings|sessions|os"), value: device.deviceOperatingSystem },
                { label: _t("settings|sessions|browser"), value: device.client },
                { label: _t("settings|sessions|ip"), value: device.last_seen_ip },
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
                <DeviceVerificationStatusCard
                    device={device}
                    onVerifyDevice={onVerifyDevice}
                    isCurrentDevice={isCurrentDevice}
                />
            </section>
            <section className="mx_DeviceDetails_section">
                <p className="mx_DeviceDetails_sectionHeading">{_t("settings|sessions|details_heading")}</p>
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
                        title={_t("settings|sessions|push_toggle")}
                        data-testid="device-detail-push-notification-checkbox"
                    />
                    <p className="mx_DeviceDetails_sectionHeading">
                        {_t("settings|sessions|push_heading")}
                        <small className="mx_DeviceDetails_sectionSubheading">
                            {_t("settings|sessions|push_subheading")}
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
                        {_t("settings|sessions|sign_out")}
                        {isSigningOut && <Spinner w={16} h={16} />}
                    </span>
                </AccessibleButton>
            </section>
        </div>
    );
};

export default DeviceDetails;
