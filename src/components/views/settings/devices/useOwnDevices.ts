/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useContext, useEffect, useState } from "react";
import {
    ClientEvent,
    type IMyDevice,
    type IPusher,
    LOCAL_NOTIFICATION_SETTINGS_PREFIX,
    type MatrixClient,
    type MatrixEvent,
    PUSHER_DEVICE_ID,
    PUSHER_ENABLED,
    UNSTABLE_MSC3852_LAST_SEEN_UA,
    type MatrixError,
    type LocalNotificationSettings,
} from "matrix-js-sdk/src/matrix";
import { type VerificationRequest, CryptoEvent } from "matrix-js-sdk/src/crypto-api";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../languageHandler";
import { getDeviceClientInformation, pruneClientInformation } from "../../../../utils/device/clientInformation";
import { type DevicesDictionary, type ExtendedDevice, type ExtendedDeviceAppInfo } from "./types";
import { useEventEmitter } from "../../../../hooks/useEventEmitter";
import { parseUserAgent } from "../../../../utils/device/parseUserAgent";
import { isDeviceVerified } from "../../../../utils/device/isDeviceVerified";
import { SDKContext } from "../../../../contexts/SDKContext";

const parseDeviceExtendedInformation = (matrixClient: MatrixClient, device: IMyDevice): ExtendedDeviceAppInfo => {
    const { name, version, url } = getDeviceClientInformation(matrixClient, device.device_id);

    return {
        appName: name,
        appVersion: version,
        url,
    };
};

/**
 * Fetch extended details of the user's own devices
 *
 * @param matrixClient - Matrix Client
 * @returns A dictionary mapping from device ID to ExtendedDevice
 */
export async function fetchExtendedDeviceInformation(matrixClient: MatrixClient): Promise<DevicesDictionary> {
    const { devices } = await matrixClient.getDevices();

    const devicesDict: DevicesDictionary = {};
    for (const device of devices) {
        devicesDict[device.device_id] = {
            ...device,
            isVerified: await isDeviceVerified(matrixClient, device.device_id),
            ...parseDeviceExtendedInformation(matrixClient, device),
            ...parseUserAgent(device[UNSTABLE_MSC3852_LAST_SEEN_UA.name]),
        };
    }
    return devicesDict;
}

export enum OwnDevicesError {
    Unsupported = "Unsupported",
    Default = "Default",
}
export type DevicesState = {
    devices: DevicesDictionary;
    dehydratedDeviceId?: string;
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
    const sdkContext = useContext(SDKContext);
    const matrixClient = sdkContext.client!;

    const currentDeviceId = matrixClient.getDeviceId()!;
    const userId = matrixClient.getSafeUserId();

    const [devices, setDevices] = useState<DevicesState["devices"]>({});
    const [dehydratedDeviceId, setDehydratedDeviceId] = useState<DevicesState["dehydratedDeviceId"]>(undefined);
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

    const refreshDevices = useCallback(async (): Promise<void> => {
        setIsLoadingDeviceList(true);
        try {
            const devices = await fetchExtendedDeviceInformation(matrixClient);
            setDevices(devices);

            const { pushers } = await matrixClient.getPushers();
            setPushers(pushers);

            const notificationSettings = new Map<string, LocalNotificationSettings>();
            Object.keys(devices).forEach((deviceId) => {
                const eventType = `${LOCAL_NOTIFICATION_SETTINGS_PREFIX.name}.${deviceId}` as const;
                const event = matrixClient.getAccountData(eventType);
                if (event) {
                    notificationSettings.set(deviceId, event.getContent());
                }
            });
            setLocalNotificationSettings(notificationSettings);

            const ownUserId = matrixClient.getUserId()!;
            const userDevices = (await matrixClient.getCrypto()?.getUserDeviceInfo([ownUserId]))?.get(ownUserId);
            const dehydratedDeviceIds: string[] = [];
            for (const device of userDevices?.values() ?? []) {
                if (device.dehydrated) {
                    dehydratedDeviceIds.push(device.deviceId);
                }
            }
            // If the user has exactly one device marked as dehydrated, we consider
            // that as the dehydrated device, and hide it as a normal device (but
            // indicate that the user is using a dehydrated device).  If the user has
            // more than one, that is anomalous, and we show all the devices so that
            // nothing is hidden.
            setDehydratedDeviceId(dehydratedDeviceIds.length == 1 ? dehydratedDeviceIds[0] : undefined);

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
    }, [matrixClient]);

    useEffect(() => {
        refreshDevices();
    }, [refreshDevices]);

    useEffect(() => {
        const deviceIds = Object.keys(devices);
        // empty devices means devices have not been fetched yet
        // as there is always at least the current device
        if (deviceIds.length) {
            pruneClientInformation(deviceIds, matrixClient);
        }
    }, [devices, matrixClient]);

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
            ? async (deviceId: ExtendedDevice["device_id"]): Promise<VerificationRequest> => {
                  return await matrixClient.getCrypto()!.requestDeviceVerification(userId, deviceId);
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
                logger.error("Error setting device name", error);
                throw new Error(_t("settings|sessions|error_set_name"));
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
                throw new Error(_t("settings|sessions|error_pusher_state"));
            } finally {
                await refreshDevices();
            }
        },
        [matrixClient, pushers, localNotificationSettings, refreshDevices],
    );

    return {
        devices,
        dehydratedDeviceId,
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
