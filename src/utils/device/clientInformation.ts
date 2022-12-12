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

import { MatrixClient } from "matrix-js-sdk/src/client";

import BasePlatform from "../../BasePlatform";
import { IConfigOptions } from "../../IConfigOptions";

export type DeviceClientInformation = {
    name?: string;
    version?: string;
    url?: string;
};

const formatUrl = (): string | undefined => {
    // don't record url for electron clients
    if (window.electron) {
        return undefined;
    }

    // strip query-string and fragment from uri
    const url = new URL(window.location.href);

    return [
        url.host,
        url.pathname.replace(/\/$/, ""), // Remove trailing slash if present
    ].join("");
};

export const getClientInformationEventType = (deviceId: string): string =>
    `io.element.matrix_client_information.${deviceId}`;

/**
 * Record extra client information for the current device
 * https://github.com/vector-im/element-meta/blob/develop/spec/matrix_client_information.md
 */
export const recordClientInformation = async (
    matrixClient: MatrixClient,
    sdkConfig: IConfigOptions,
    platform: BasePlatform,
): Promise<void> => {
    const deviceId = matrixClient.getDeviceId();
    const { brand } = sdkConfig;
    const version = await platform.getAppVersion();
    const type = getClientInformationEventType(deviceId);
    const url = formatUrl();

    await matrixClient.setAccountData(type, {
        name: brand,
        version,
        url,
    });
};

/**
 * Remove extra client information
 * @todo(kerrya) revisit after MSC3391: account data deletion is done
 * (PSBE-12)
 */
export const removeClientInformation = async (matrixClient: MatrixClient): Promise<void> => {
    const deviceId = matrixClient.getDeviceId();
    const type = getClientInformationEventType(deviceId);
    const clientInformation = getDeviceClientInformation(matrixClient, deviceId);

    // if a non-empty client info event exists, overwrite to remove the content
    if (clientInformation.name || clientInformation.version || clientInformation.url) {
        await matrixClient.setAccountData(type, {});
    }
};

const sanitizeContentString = (value: unknown): string | undefined =>
    value && typeof value === "string" ? value : undefined;

export const getDeviceClientInformation = (matrixClient: MatrixClient, deviceId: string): DeviceClientInformation => {
    const event = matrixClient.getAccountData(getClientInformationEventType(deviceId));

    if (!event) {
        return {};
    }

    const { name, version, url } = event.getContent();

    return {
        name: sanitizeContentString(name),
        version: sanitizeContentString(version),
        url: sanitizeContentString(url),
    };
};
