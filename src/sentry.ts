/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import * as Sentry from "@sentry/browser";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import SdkConfig from "./SdkConfig";
import { MatrixClientPeg } from "./MatrixClientPeg";
import SettingsStore from "./settings/SettingsStore";
import { type IConfigOptions } from "./IConfigOptions";

/* eslint-disable camelcase */

type StorageContext = {
    storageManager_persisted?: string;
    storageManager_quota?: string;
    storageManager_usage?: string;
    storageManager_usageDetails?: string;
};

type UserContext = {
    username: string;
    enabled_labs: string;
    low_bandwidth: string;
};

type CryptoContext = {
    crypto_version?: string;
    device_keys?: string;
    cross_signing_ready?: string;
    cross_signing_supported_by_hs?: string;
    cross_signing_key?: string;
    cross_signing_privkey_in_secret_storage?: string;
    cross_signing_master_privkey_cached?: string;
    cross_signing_user_signing_privkey_cached?: string;
    secret_storage_ready?: string;
    secret_storage_key_in_account?: string;
    session_backup_key_in_secret_storage?: string;
    session_backup_key_cached?: string;
    session_backup_key_well_formed?: string;
};

type DeviceContext = {
    device_id?: string;
    mx_local_settings: string | null;
    modernizr_missing_features?: string;
};

type Contexts = {
    user: UserContext;
    crypto: CryptoContext;
    device: DeviceContext;
    storage: StorageContext;
};

/* eslint-enable camelcase */

async function getStorageContext(): Promise<StorageContext> {
    const result: StorageContext = {};

    // add storage persistence/quota information
    if (navigator.storage && navigator.storage.persisted) {
        try {
            result["storageManager_persisted"] = String(await navigator.storage.persisted());
        } catch {}
    } else if (document.hasStorageAccess) {
        // Safari
        try {
            result["storageManager_persisted"] = String(await document.hasStorageAccess());
        } catch {}
    }
    if (navigator.storage && navigator.storage.estimate) {
        try {
            const estimate = await navigator.storage.estimate();
            result["storageManager_quota"] = String(estimate.quota);
            result["storageManager_usage"] = String(estimate.usage);
            if (estimate.usageDetails) {
                const usageDetails: string[] = [];
                Object.keys(estimate.usageDetails).forEach((k) => {
                    usageDetails.push(`${k}: ${String(estimate.usageDetails![k])}`);
                });
                result[`storageManager_usage`] = usageDetails.join(", ");
            }
        } catch {}
    }

    return result;
}

function getUserContext(client: MatrixClient): UserContext {
    return {
        username: client.credentials.userId!,
        enabled_labs: getEnabledLabs(),
        low_bandwidth: SettingsStore.getValue("lowBandwidth") ? "enabled" : "disabled",
    };
}

function getEnabledLabs(): string {
    const enabledLabs = SettingsStore.getFeatureSettingNames().filter((f) => SettingsStore.getValue(f));
    if (enabledLabs.length) {
        return enabledLabs.join(", ");
    }
    return "";
}

async function getCryptoContext(client: MatrixClient): Promise<CryptoContext> {
    const cryptoApi = client.getCrypto();
    if (!cryptoApi) {
        return {};
    }

    const ownDeviceKeys = await cryptoApi.getOwnDeviceKeys();

    const keys = [`curve25519:${ownDeviceKeys.curve25519}`, `ed25519:${ownDeviceKeys.ed25519}`];

    const crossSigningStatus = await cryptoApi.getCrossSigningStatus();
    const secretStorage = client.secretStorage;
    const sessionBackupKeyFromCache = await cryptoApi.getSessionBackupPrivateKey();

    return {
        crypto_version: cryptoApi.getVersion(),
        device_keys: keys.join(", "),
        cross_signing_ready: String(await cryptoApi.isCrossSigningReady()),
        cross_signing_key: (await cryptoApi.getCrossSigningKeyId()) ?? undefined,
        cross_signing_privkey_in_secret_storage: String(crossSigningStatus.privateKeysInSecretStorage),
        cross_signing_master_privkey_cached: String(crossSigningStatus.privateKeysCachedLocally.masterKey),
        cross_signing_user_signing_privkey_cached: String(crossSigningStatus.privateKeysCachedLocally.userSigningKey),
        secret_storage_ready: String(await cryptoApi.isSecretStorageReady()),
        secret_storage_key_in_account: String(await secretStorage.hasKey()),
        session_backup_key_in_secret_storage: String(!!(await client.isKeyBackupKeyStored())),
        session_backup_key_cached: String(!!sessionBackupKeyFromCache),
        session_backup_key_well_formed: String(sessionBackupKeyFromCache instanceof Uint8Array),
    };
}

function getDeviceContext(client: MatrixClient): DeviceContext {
    const result: DeviceContext = {
        device_id: client?.deviceId ?? undefined,
        mx_local_settings: localStorage.getItem("mx_local_settings"),
    };

    if (window.Modernizr) {
        const missingFeatures = Object.keys(window.Modernizr).filter(
            (key) => window.Modernizr[key as keyof ModernizrStatic] === false,
        );
        if (missingFeatures.length > 0) {
            result["modernizr_missing_features"] = missingFeatures.join(", ");
        }
    }

    return result;
}

async function getContexts(): Promise<Contexts> {
    const client = MatrixClientPeg.safeGet();
    return {
        user: getUserContext(client),
        crypto: await getCryptoContext(client),
        device: getDeviceContext(client),
        storage: await getStorageContext(),
    };
}

export async function sendSentryReport(userText: string, issueUrl: string, error?: unknown): Promise<void> {
    const sentryConfig = SdkConfig.getObject("sentry");
    if (!sentryConfig) return;

    const captureContext = {
        contexts: await getContexts(),
        extra: {
            user_text: userText,
            issue_url: issueUrl,
        },
    };

    // If there's no error and no issueUrl, the report will just produce non-grouped noise in Sentry, so don't
    // upload it
    if (error) {
        Sentry.captureException(error, captureContext);
    } else if (issueUrl) {
        Sentry.captureMessage(`Issue: ${issueUrl}`, captureContext);
    }
}

export function setSentryUser(mxid: string): void {
    if (!SdkConfig.get().sentry || !SettingsStore.getValue("automaticErrorReporting")) return;
    Sentry.setUser({ username: mxid });
}

export async function initSentry(sentryConfig: IConfigOptions["sentry"]): Promise<void> {
    if (!sentryConfig) return;
    // Only enable Integrations.GlobalHandlers, which hooks uncaught exceptions, if automaticErrorReporting is true
    const integrations = [
        Sentry.inboundFiltersIntegration(),
        Sentry.functionToStringIntegration(),
        Sentry.breadcrumbsIntegration(),
        Sentry.httpContextIntegration(),
        Sentry.dedupeIntegration(),
    ];

    if (SettingsStore.getValue("automaticErrorReporting")) {
        integrations.push(Sentry.globalHandlersIntegration({ onerror: false, onunhandledrejection: true }));
        integrations.push(Sentry.browserApiErrorsIntegration());
    }

    Sentry.init({
        dsn: sentryConfig.dsn,
        release: process.env.VERSION,
        environment: sentryConfig.environment,
        defaultIntegrations: false,
        integrations,
        // Set to 1.0 which is reasonable if we're only submitting Rageshakes; will need to be set < 1.0
        // if we collect more frequently.
        tracesSampleRate: 1.0,
    });
}

window.mxSendSentryReport = sendSentryReport;
