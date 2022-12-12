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
    if (browser.name === "Electron") {
        return DeviceType.Desktop;
    }
    if (!!browser.name) {
        return DeviceType.Web;
    }
    if (device.type === "mobile" || operatingSystem.name?.includes("Android") || userAgent.indexOf(IOS_KEYWORD) > -1) {
        return DeviceType.Mobile;
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
