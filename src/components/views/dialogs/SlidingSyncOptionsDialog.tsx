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
import { MatrixClient, Method } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import TextInputDialog from "./TextInputDialog";
import withValidation from "../elements/Validation";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";
import { SettingLevel } from "../../../settings/SettingLevel";

/**
 * Check that the server natively supports sliding sync.
 * @param cli The MatrixClient of the logged in user.
 * @throws if the proxy server is unreachable or not configured to the given homeserver
 */
async function syncHealthCheck(cli: MatrixClient): Promise<void> {
    await cli.http.authedRequest(Method.Post, "/sync", undefined, undefined, {
        localTimeoutMs: 10 * 1000, // 10s
        prefix: "/_matrix/client/unstable/org.matrix.msc3575",
    });
    logger.info("server natively support sliding sync OK");
}

/**
 * Check that the proxy url is in fact a sliding sync proxy endpoint and it is up.
 * @param endpoint The proxy endpoint url
 * @param hsUrl The homeserver url of the logged in user.
 * @throws if the proxy server is unreachable or not configured to the given homeserver
 */
async function proxyHealthCheck(endpoint: string, hsUrl?: string): Promise<void> {
    const controller = new AbortController();
    const id = window.setTimeout(() => controller.abort(), 10 * 1000); // 10s
    const res = await fetch(endpoint + "/client/server.json", {
        signal: controller.signal,
    });
    clearTimeout(id);
    if (res.status != 200) {
        throw new Error(`proxyHealthCheck: proxy server returned HTTP ${res.status}`);
    }
    const body = await res.json();
    if (body.server !== hsUrl) {
        throw new Error(`proxyHealthCheck: client using ${hsUrl} but server is as ${body.server}`);
    }
    logger.info("sliding sync proxy is OK");
}

export const SlidingSyncOptionsDialog: React.FC<{ onFinished(enabled: boolean): void }> = ({ onFinished }) => {
    const cli = MatrixClientPeg.get();
    const currentProxy = SettingsStore.getValue("feature_sliding_sync_proxy_url");
    const hasNativeSupport = useAsyncMemo(
        () =>
            syncHealthCheck(cli).then(
                () => true,
                () => false,
            ),
        [],
        null,
    );

    let nativeSupport: string;
    if (hasNativeSupport === null) {
        nativeSupport = _t("Checking…");
    } else {
        nativeSupport = hasNativeSupport
            ? _t("Your server has native support")
            : _t("Your server lacks native support");
    }

    const validProxy = withValidation<undefined, { error?: Error }>({
        async deriveData({ value }): Promise<{ error?: Error }> {
            try {
                await proxyHealthCheck(value!, MatrixClientPeg.get().baseUrl);
                return {};
            } catch (error) {
                return { error };
            }
        },
        rules: [
            {
                key: "required",
                test: async ({ value }) => !!value || !!hasNativeSupport,
                invalid: () => _t("Your server lacks native support, you must specify a proxy"),
            },
            {
                key: "working",
                final: true,
                test: async (_, { error }) => !error,
                valid: () => _t("Looks good"),
                invalid: ({ error }) => error?.message ?? null,
            },
        ],
    });

    return (
        <TextInputDialog
            title={_t("Sliding Sync configuration")}
            description={
                <div>
                    <div>
                        <b>{_t("To disable you will need to log out and back in, use with caution!")}</b>
                    </div>
                    {nativeSupport}
                </div>
            }
            placeholder={hasNativeSupport ? _t("Proxy URL (optional)") : _t("Proxy URL")}
            value={currentProxy}
            button={_t("Enable")}
            validator={validProxy}
            onFinished={(enable, proxyUrl) => {
                if (enable) {
                    SettingsStore.setValue("feature_sliding_sync_proxy_url", null, SettingLevel.DEVICE, proxyUrl);
                    onFinished(true);
                } else {
                    onFinished(false);
                }
            }}
        />
    );
};
