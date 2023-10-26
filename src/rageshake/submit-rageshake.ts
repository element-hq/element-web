/*
Copyright 2017 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import { logger } from "matrix-js-sdk/src/logger";
import { Method } from "matrix-js-sdk/src/matrix";

import type * as Pako from "pako";
import { MatrixClientPeg } from "../MatrixClientPeg";
import PlatformPeg from "../PlatformPeg";
import { _t } from "../languageHandler";
import * as rageshake from "./rageshake";
import SettingsStore from "../settings/SettingsStore";
import SdkConfig from "../SdkConfig";
import { getServerVersionFromFederationApi } from "../components/views/dialogs/devtools/ServerInfo";

interface IOpts {
    labels?: string[];
    userText?: string;
    sendLogs?: boolean;
    progressCallback?: (s: string) => void;
    customApp?: string;
    customFields?: Record<string, string>;
}

async function collectBugReport(opts: IOpts = {}, gzipLogs = true): Promise<FormData> {
    const progressCallback = opts.progressCallback || ((): void => {});

    progressCallback(_t("bug_reporting|collecting_information"));
    let version: string | undefined;
    try {
        version = await PlatformPeg.get()?.getAppVersion();
    } catch (err) {} // PlatformPeg already logs this.

    const userAgent = window.navigator?.userAgent ?? "UNKNOWN";

    let installedPWA = "UNKNOWN";
    try {
        // Known to work at least for desktop Chrome
        installedPWA = String(window.matchMedia("(display-mode: standalone)").matches);
    } catch (e) {}

    let touchInput = "UNKNOWN";
    try {
        // MDN claims broad support across browsers
        touchInput = String(window.matchMedia("(pointer: coarse)").matches);
    } catch (e) {}

    const client = MatrixClientPeg.get();

    logger.log("Sending bug report.");

    const body = new FormData();
    body.append("text", opts.userText || "User did not supply any additional text.");
    body.append("app", opts.customApp || "element-web");
    body.append("version", version ?? "UNKNOWN");
    body.append("user_agent", userAgent);
    body.append("installed_pwa", installedPWA);
    body.append("touch_input", touchInput);

    if (opts.customFields) {
        for (const key in opts.customFields) {
            body.append(key, opts.customFields[key]);
        }
    }

    if (client) {
        body.append("user_id", client.credentials.userId!);
        body.append("device_id", client.deviceId!);

        const cryptoApi = client.getCrypto();

        if (cryptoApi) {
            body.append("crypto_version", cryptoApi.getVersion());

            const keys = [`ed25519:${client.getDeviceEd25519Key()}`];
            if (client.getDeviceCurve25519Key) {
                keys.push(`curve25519:${client.getDeviceCurve25519Key()}`);
            }
            body.append("device_keys", keys.join(", "));

            // add cross-signing status information
            const crossSigningStatus = await cryptoApi.getCrossSigningStatus();
            const secretStorage = client.secretStorage;

            body.append("cross_signing_ready", String(await cryptoApi.isCrossSigningReady()));
            body.append("cross_signing_key", (await cryptoApi.getCrossSigningKeyId()) ?? "n/a");
            body.append(
                "cross_signing_privkey_in_secret_storage",
                String(crossSigningStatus.privateKeysInSecretStorage),
            );

            body.append(
                "cross_signing_master_privkey_cached",
                String(crossSigningStatus.privateKeysCachedLocally.masterKey),
            );
            body.append(
                "cross_signing_self_signing_privkey_cached",
                String(crossSigningStatus.privateKeysCachedLocally.selfSigningKey),
            );
            body.append(
                "cross_signing_user_signing_privkey_cached",
                String(crossSigningStatus.privateKeysCachedLocally.userSigningKey),
            );

            body.append("secret_storage_ready", String(await cryptoApi.isSecretStorageReady()));
            body.append("secret_storage_key_in_account", String(await secretStorage.hasKey()));

            body.append("session_backup_key_in_secret_storage", String(!!(await client.isKeyBackupKeyStored())));
            const sessionBackupKeyFromCache = await cryptoApi.getSessionBackupPrivateKey();
            body.append("session_backup_key_cached", String(!!sessionBackupKeyFromCache));
            body.append("session_backup_key_well_formed", String(sessionBackupKeyFromCache instanceof Uint8Array));
        }

        try {
            // XXX: This is synapse-specific but better than nothing until MSC support for a server version endpoint
            const data = await client.http.request<Record<string, any>>(
                Method.Get,
                "/server_version",
                undefined,
                undefined,
                {
                    prefix: "/_synapse/admin/v1",
                },
            );
            Object.keys(data).forEach((key) => {
                body.append(`matrix_hs_${key}`, data[key]);
            });
        } catch {
            try {
                // XXX: This relies on the federation listener being delegated via well-known
                // or at the same place as the client server endpoint
                const data = await getServerVersionFromFederationApi(client);
                body.append("matrix_hs_name", data.server.name);
                body.append("matrix_hs_version", data.server.version);
            } catch {
                try {
                    // If that fails we'll hit any endpoint and look at the server response header
                    const res = await window.fetch(client.http.getUrl("/login"), {
                        method: "GET",
                        mode: "cors",
                    });
                    if (res.headers.has("server")) {
                        body.append("matrix_hs_server", res.headers.get("server")!);
                    }
                } catch {
                    // Could not determine server version
                }
            }
        }
    }

    if (opts.labels) {
        for (const label of opts.labels) {
            body.append("label", label);
        }
    }

    // add labs options
    const enabledLabs = SettingsStore.getFeatureSettingNames().filter((f) => SettingsStore.getValue(f));
    if (enabledLabs.length) {
        body.append("enabled_labs", enabledLabs.join(", "));
    }
    // if low bandwidth mode is enabled, say so over rageshake, it causes many issues
    if (SettingsStore.getValue("lowBandwidth")) {
        body.append("lowBandwidth", "enabled");
    }

    // add storage persistence/quota information
    if (navigator.storage && navigator.storage.persisted) {
        try {
            body.append("storageManager_persisted", String(await navigator.storage.persisted()));
        } catch (e) {}
    } else if (document.hasStorageAccess) {
        // Safari
        try {
            body.append("storageManager_persisted", String(await document.hasStorageAccess()));
        } catch (e) {}
    }
    if (navigator.storage && navigator.storage.estimate) {
        try {
            const estimate = await navigator.storage.estimate();
            body.append("storageManager_quota", String(estimate.quota));
            body.append("storageManager_usage", String(estimate.usage));
            if (estimate.usageDetails) {
                Object.keys(estimate.usageDetails).forEach((k) => {
                    body.append(`storageManager_usage_${k}`, String(estimate.usageDetails![k]));
                });
            }
        } catch (e) {}
    }

    if (window.Modernizr) {
        const missingFeatures = (Object.keys(window.Modernizr) as [keyof ModernizrStatic]).filter(
            (key: keyof ModernizrStatic) => window.Modernizr[key] === false,
        );
        if (missingFeatures.length > 0) {
            body.append("modernizr_missing_features", missingFeatures.join(", "));
        }
    }

    body.append("mx_local_settings", localStorage.getItem("mx_local_settings")!);

    if (opts.sendLogs) {
        let pako: typeof Pako | undefined;
        if (gzipLogs) {
            pako = await import("pako");
        }

        progressCallback(_t("bug_reporting|collecting_logs"));
        const logs = await rageshake.getLogsForReport();
        for (const entry of logs) {
            // encode as UTF-8
            let buf = new TextEncoder().encode(entry.lines);

            // compress
            if (gzipLogs) {
                buf = pako!.gzip(buf);
            }

            body.append("compressed-log", new Blob([buf]), entry.id);
        }
    }

    return body;
}

/**
 * Send a bug report.
 *
 * @param {string} bugReportEndpoint HTTP url to send the report to
 *
 * @param {object} opts optional dictionary of options
 *
 * @param {string} opts.userText Any additional user input.
 *
 * @param {boolean} opts.sendLogs True to send logs
 *
 * @param {function(string)} opts.progressCallback Callback to call with progress updates
 *
 * @return {Promise<string>} URL returned by the rageshake server
 */
export default async function sendBugReport(bugReportEndpoint?: string, opts: IOpts = {}): Promise<string> {
    if (!bugReportEndpoint) {
        throw new Error("No bug report endpoint has been set.");
    }

    const progressCallback = opts.progressCallback || ((): void => {});
    const body = await collectBugReport(opts);

    progressCallback(_t("bug_reporting|uploading_logs"));
    return submitReport(bugReportEndpoint, body, progressCallback);
}

/**
 * Downloads the files from a bug report. This is the same as sendBugReport,
 * but instead causes the browser to download the files locally.
 *
 * @param {object} opts optional dictionary of options
 *
 * @param {string} opts.userText Any additional user input.
 *
 * @param {boolean} opts.sendLogs True to send logs
 *
 * @param {function(string)} opts.progressCallback Callback to call with progress updates
 *
 * @return {Promise} Resolved when the bug report is downloaded (or started).
 */
export async function downloadBugReport(opts: IOpts = {}): Promise<void> {
    const Tar = (await import("tar-js")).default;
    const progressCallback = opts.progressCallback || ((): void => {});
    const body = await collectBugReport(opts, false);

    progressCallback(_t("bug_reporting|downloading_logs"));
    let metadata = "";
    const tape = new Tar();
    let i = 0;
    for (const [key, value] of body.entries()) {
        if (key === "compressed-log") {
            await new Promise<void>((resolve) => {
                const reader = new FileReader();
                reader.addEventListener("loadend", (ev) => {
                    tape.append(`log-${i++}.log`, new TextDecoder().decode(reader.result as ArrayBuffer));
                    resolve();
                });
                reader.readAsArrayBuffer(value as Blob);
            });
        } else {
            metadata += `${key} = ${value as string}\n`;
        }
    }
    tape.append("issue.txt", metadata);

    // We have to create a new anchor to download if we want a filename. Otherwise we could
    // just use window.open.
    const dl = document.createElement("a");
    dl.href = `data:application/octet-stream;base64,${btoa(uint8ToString(tape.out))}`;
    dl.download = "rageshake.tar";
    document.body.appendChild(dl);
    dl.click();
    document.body.removeChild(dl);
}

// Source: https://github.com/beatgammit/tar-js/blob/master/examples/main.js
function uint8ToString(buf: Uint8Array): string {
    let out = "";
    for (let i = 0; i < buf.length; i += 1) {
        out += String.fromCharCode(buf[i]);
    }
    return out;
}

export async function submitFeedback(
    label: string | undefined,
    comment: string,
    canContact = false,
    extraData: Record<string, any> = {},
): Promise<void> {
    let version: string | undefined;
    try {
        version = await PlatformPeg.get()?.getAppVersion();
    } catch (err) {} // PlatformPeg already logs this.

    const body = new FormData();
    if (label) body.append("label", label);
    body.append("text", comment);
    body.append("can_contact", canContact ? "yes" : "no");

    body.append("app", "element-web");
    body.append("version", version || "UNKNOWN");
    body.append("platform", PlatformPeg.get()?.getHumanReadableName() ?? "n/a");
    body.append("user_id", MatrixClientPeg.get()?.getUserId() ?? "n/a");

    for (const k in extraData) {
        body.append(k, JSON.stringify(extraData[k]));
    }

    const bugReportEndpointUrl = SdkConfig.get().bug_report_endpoint_url;

    if (bugReportEndpointUrl) {
        await submitReport(bugReportEndpointUrl, body, () => {});
    }
}

function submitReport(endpoint: string, body: FormData, progressCallback: (str: string) => void): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const req = new XMLHttpRequest();
        req.open("POST", endpoint);
        req.responseType = "json";
        req.timeout = 5 * 60 * 1000;
        req.onreadystatechange = function (): void {
            if (req.readyState === XMLHttpRequest.LOADING) {
                progressCallback(_t("bug_reporting|waiting_for_server"));
            } else if (req.readyState === XMLHttpRequest.DONE) {
                // on done
                if (req.status < 200 || req.status >= 400) {
                    reject(new Error(`HTTP ${req.status}`));
                    return;
                }
                resolve(req.response.report_url || "");
            }
        };
        req.send(body);
    });
}
