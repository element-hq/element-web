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

import { useCallback, useContext, useEffect, useState } from "react";
import {
    ClientEvent,
    IMyDevice,
    IPusher,
    LOCAL_NOTIFICATION_SETTINGS_PREFIX,
    MatrixClient,
    MatrixEvent,
    PUSHER_DEVICE_ID,
    PUSHER_ENABLED,
    UNSTABLE_MSC3852_LAST_SEEN_UA,
} from "matrix-js-sdk/src/matrix";
import { CrossSigningInfo } from "matrix-js-sdk/src/crypto/CrossSigning";
import { VerificationRequest } from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import { MatrixError } from "matrix-js-sdk/src/http-api";
import { logger } from "matrix-js-sdk/src/logger";
import { LocalNotificationSettings } from "matrix-js-sdk/src/@types/local_notifications";
import { CryptoEvent } from "matrix-js-sdk/src/crypto";

import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { _t } from "../../../../languageHandler";
import { getDeviceClientInformation } from "../../../../utils/device/clientInformation";
import { DevicesDictionary, ExtendedDevice, ExtendedDeviceAppInfo } from "./types";
import { useEventEmitter } from "../../../../hooks/useEventEmitter";
import { parseUserAgent } from "../../../../utils/device/parseUserAgent";

const isDeviceVerified = (
    matrixClient: MatrixClient,
    crossSigningInfo: CrossSigningInfo,
    device: IMyDevice,
): boolean | null => {
    try {
        const userId = matrixClient.getUserId();
        if (!userId) {
            throw new Error("No user id");
        }
        const deviceInfo = matrixClient.getStoredDevice(userId, device.device_id);
        if (!deviceInfo) {
            throw new Error("No device info available");
        }
        return crossSigningInfo.checkDeviceTrust(crossSigningInfo, deviceInfo, false, true).isCrossSigningVerified();
    } catch (error) {
        logger.error("Error getting device cross-signing info", error);
        return null;
    }
};

const parseDeviceExtendedInformation = (matrixClient: MatrixClient, device: IMyDevice): ExtendedDeviceAppInfo => {
    const { name, version, url } = getDeviceClientInformation(matrixClient, device.device_id);

    return {
        appName: name,
        appVersion: version,
        url,
    };
};

const fetchDevicesWithVerification = async (
    matrixClient: MatrixClient,
    userId: string,
): Promise<DevicesState["devices"]> => {
    const { devices } = await matrixClient.getDevices();

    const crossSigningInfo = matrixClient.getStoredCrossSigningForUser(userId);

    const devicesDict = devices.reduce(
        (acc, device: IMyDevice) => ({
            ...acc,
            [device.device_id]: {
                ...device,
                isVerified: isDeviceVerified(matrixClient, crossSigningInfo, device),
                ...parseDeviceExtendedInformation(matrixClient, device),
                ...parseUserAgent(device[UNSTABLE_MSC3852_LAST_SEEN_UA.name]),
            },
        }),
        {},
    );

    return devicesDict;
};

export enum OwnDevicesError {
    Unsupported = "Unsupported",
    Default = "Default",
}
export type DevicesState = {
    devices: DevicesDictionary;
    pushers: IPusher[];
    localNotificationSettings: Map<string, LocalNotificationSettings>;
    currentDeviceId: string;
    isLoadingDeviceList: boolean;
    // not provided when current session cannot request verification
    requestDeviceVerification?: (deviceId: ExtendedDevice["device_id"]) => Promise<VerificationRequest>;
    refreshDevices: () => Promise<void>;
    saveDeviceName: (deviceId: ExtendedDevice["device_id"], deviceName: string) => Promise<void>;
    setPushNotifications: (deviceId: ExtendedDevice["device_id"], enabled: boolean) => Promise<void>;
    error?: OwnDevicesError;
    supportsMSC3881?: boolean | undefined;
};
export const useOwnDevices = (): DevicesState => {
    const matrixClient = useContext(MatrixClientContext);

    const currentDeviceId = matrixClient.getDeviceId();
    const userId = matrixClient.getUserId();

    const [devices, setDevices] = useState<DevicesState["devices"]>({});
    const [pushers, setPushers] = useState<DevicesState["pushers"]>([]);
    const [localNotificationSettings, setLocalNotificationSettings] = useState<
        DevicesState["localNotificationSettings"]
    >(new Map<string, LocalNotificationSettings>());
    const [isLoadingDeviceList, setIsLoadingDeviceList] = useState(true);
    const [supportsMSC3881, setSupportsMSC3881] = useState(true); // optimisticly saying yes!

    const [error, setError] = useState<OwnDevicesError>();

    useEffect(() => {
        matrixClient.doesServerSupportUnstableFeature("org.matrix.msc3881").then((hasSupport) => {
            setSupportsMSC3881(hasSupport);
        });
    }, [matrixClient]);

    const refreshDevices = useCallback(async () => {
        setIsLoadingDeviceList(true);
        try {
            // realistically we should never hit this
            // but it satisfies types
            if (!userId) {
                throw new Error("Cannot fetch devices without user id");
            }
            const devices = await fetchDevicesWithVerification(matrixClient, userId);
            setDevices(devices);

            const { pushers } = await matrixClient.getPushers();
            setPushers(pushers);

            const notificationSettings = new Map<string, LocalNotificationSettings>();
            Object.keys(devices).forEach((deviceId) => {
                const eventType = `${LOCAL_NOTIFICATION_SETTINGS_PREFIX.name}.${deviceId}`;
                const event = matrixClient.getAccountData(eventType);
                if (event) {
                    notificationSettings.set(deviceId, event.getContent());
                }
            });
            setLocalNotificationSettings(notificationSettings);

            setIsLoadingDeviceList(false);
        } catch (error) {
            if ((error as MatrixError).httpStatus == 404) {
                // 404 probably means the HS doesn't yet support the API.
                setError(OwnDevicesError.Unsupported);
            } else {
                logger.error("Error loading sessions:", error);
                setError(OwnDevicesError.Default);
            }
            setIsLoadingDeviceList(false);
        }
    }, [matrixClient, userId]);

    useEffect(() => {
        refreshDevices();
    }, [refreshDevices]);

    useEventEmitter(matrixClient, CryptoEvent.DevicesUpdated, (users: string[]): void => {
        if (users.includes(userId)) {
            refreshDevices();
        }
    });

    useEventEmitter(matrixClient, ClientEvent.AccountData, (event: MatrixEvent): void => {
        const type = event.getType();
        if (type.startsWith(LOCAL_NOTIFICATION_SETTINGS_PREFIX.name)) {
            const newSettings = new Map(localNotificationSettings);
            const deviceId = type.slice(type.lastIndexOf(".") + 1);
            newSettings.set(deviceId, event.getContent<LocalNotificationSettings>());
            setLocalNotificationSettings(newSettings);
        }
    });

    const isCurrentDeviceVerified = !!devices[currentDeviceId]?.isVerified;

    const requestDeviceVerification =
        isCurrentDeviceVerified && userId
            ? async (deviceId: ExtendedDevice["device_id"]) => {
                  return await matrixClient.requestVerification(userId, [deviceId]);
              }
            : undefined;

    const saveDeviceName = useCallback(
        async (deviceId: ExtendedDevice["device_id"], deviceName: string): Promise<void> => {
            const device = devices[deviceId];

            // no change
            if (deviceName === device?.display_name) {
                return;
            }

            try {
                await matrixClient.setDeviceDetails(deviceId, { display_name: deviceName });
                await refreshDevices();
            } catch (error) {
                logger.error("Error setting session display name", error);
                throw new Error(_t("Failed to set display name"));
            }
        },
        [matrixClient, devices, refreshDevices],
    );

    const setPushNotifications = useCallback(
        async (deviceId: ExtendedDevice["device_id"], enabled: boolean): Promise<void> => {
            try {
                const pusher = pushers.find((pusher) => pusher[PUSHER_DEVICE_ID.name] === deviceId);
                if (pusher) {
                    await matrixClient.setPusher({
                        ...pusher,
                        [PUSHER_ENABLED.name]: enabled,
                    });
                } else if (localNotificationSettings.has(deviceId)) {
                    await matrixClient.setLocalNotificationSettings(deviceId, {
                        is_silenced: !enabled,
                    });
                }
            } catch (error) {
                logger.error("Error setting pusher state", error);
                throw new Error(_t("Failed to set pusher state"));
            } finally {
                await refreshDevices();
            }
        },
        [matrixClient, pushers, localNotificationSettings, refreshDevices],
    );

    return {
        devices,
        pushers,
        localNotificationSettings,
        currentDeviceId,
        isLoadingDeviceList,
        error,
        requestDeviceVerification,
        refreshDevices,
        saveDeviceName,
        setPushNotifications,
        supportsMSC3881,
    };
};
