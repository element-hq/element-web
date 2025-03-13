/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import UAParser from "ua-parser-js";

export enum DeviceType {
    Desktop = "Desktop",
    Mobile = "Mobile",
    Web = "Web",
    Unknown = "Unknown",
}
export type ExtendedDeviceInformation = {
    deviceType: DeviceType;
    // eg Google Pixel 6
    deviceModel?: string;
    // eg Android 11
    deviceOperatingSystem?: string;
    // eg Firefox 1.1.0
    client?: string;
};

// Element/1.8.21 (iPhone XS Max; iOS 15.2; Scale/3.00)
const IOS_KEYWORD = "; iOS ";
const BROWSER_KEYWORD = "Mozilla/";

const getDeviceType = (
    userAgent: string,
    device: UAParser.IDevice,
    browser: UAParser.IBrowser,
    operatingSystem: UAParser.IOS,
): DeviceType => {
    if (device.type === "mobile" || operatingSystem.name?.includes("Android") || userAgent.indexOf(IOS_KEYWORD) > -1) {
        return DeviceType.Mobile;
    }
    if (browser.name === "Electron") {
        return DeviceType.Desktop;
    }
    if (!!browser.name) {
        return DeviceType.Web;
    }
    return DeviceType.Unknown;
};

interface CustomValues {
    customDeviceModel?: string;
    customDeviceOS?: string;
}
/**
 * Some mobile model and OS strings are not recognised
 * by the UA parsing library
 * check they exist by hand
 */
const checkForCustomValues = (userAgent: string): CustomValues => {
    if (userAgent.includes(BROWSER_KEYWORD)) {
        return {};
    }

    const mightHaveDevice = userAgent.includes("(");
    if (!mightHaveDevice) {
        return {};
    }
    const deviceInfoSegments = userAgent.substring(userAgent.indexOf("(") + 1).split("; ");
    const customDeviceModel = deviceInfoSegments[0] || undefined;
    const customDeviceOS = deviceInfoSegments[1] || undefined;
    return { customDeviceModel, customDeviceOS };
};

const concatenateNameAndVersion = (name?: string, version?: string): string | undefined =>
    name && [name, version].filter(Boolean).join(" ");

export const parseUserAgent = (userAgent?: string): ExtendedDeviceInformation => {
    if (!userAgent) {
        return {
            deviceType: DeviceType.Unknown,
        };
    }

    const parser = new UAParser(userAgent);

    const browser = parser.getBrowser();
    const device = parser.getDevice();
    const operatingSystem = parser.getOS();

    const deviceType = getDeviceType(userAgent, device, browser, operatingSystem);

    // OSX versions are frozen at 10.15.17 in UA strings https://chromestatus.com/feature/5452592194781184
    // ignore OS version in browser based sessions
    const shouldIgnoreOSVersion = deviceType === DeviceType.Web || deviceType === DeviceType.Desktop;
    const deviceOperatingSystem = concatenateNameAndVersion(
        operatingSystem.name,
        shouldIgnoreOSVersion ? undefined : operatingSystem.version,
    );
    const deviceModel = concatenateNameAndVersion(device.vendor, device.model);
    const client = concatenateNameAndVersion(browser.name, browser.version);

    // only try to parse custom model and OS when device type is known
    const { customDeviceModel, customDeviceOS } =
        deviceType !== DeviceType.Unknown ? checkForCustomValues(userAgent) : ({} as CustomValues);

    return {
        deviceType,
        deviceModel: deviceModel || customDeviceModel,
        deviceOperatingSystem: deviceOperatingSystem || customDeviceOS,
        client,
    };
};
