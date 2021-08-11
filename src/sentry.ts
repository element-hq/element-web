import * as Sentry from "@sentry/browser";
import PlatformPeg from "./PlatformPeg";
import SdkConfig from "./SdkConfig";
import { MatrixClientPeg } from "./MatrixClientPeg";
import SettingsStore from "./settings/SettingsStore";
import { MatrixClient } from "../../matrix-js-sdk";

async function getStorageOptions(): Record<string, string> {
    const result = {};

    // add storage persistence/quota information
    if (navigator.storage && navigator.storage.persisted) {
        try {
            result["storageManager_persisted"] = String(await navigator.storage.persisted());
        } catch (e) {}
    } else if (document.hasStorageAccess) { // Safari
        try {
            result["storageManager_persisted"] = String(await document.hasStorageAccess());
        } catch (e) {}
    }
    if (navigator.storage && navigator.storage.estimate) {
        try {
            const estimate = await navigator.storage.estimate();
            result["storageManager_quota"] = String(estimate.quota);
            result["storageManager_usage"] = String(estimate.usage);
            if (estimate.usageDetails) {
                Object.keys(estimate.usageDetails).forEach(k => {
                    result[`storageManager_usage_${k}`] = String(estimate.usageDetails[k]);
                });
            }
        } catch (e) {}
    }

    return result;
}

function getUserContext(client: MatrixClient): Record<string, string> {
    return {
        "username": client.credentials.userId,
        "enabled_labs": getEnabledLabs(),
        "low_bandwidth": SettingsStore.getValue("lowBandwidth") ? "enabled" : "disabled",
    };
}

function getEnabledLabs(): string {
    const enabledLabs = SettingsStore.getFeatureSettingNames().filter(f => SettingsStore.getValue(f));
    if (enabledLabs.length) {
        return enabledLabs.join(", ");
    }
}

async function getCryptoContext(client: MatrixClient): Record<String, String> {
    if (!client.isCryptoEnabled()) {
        return {};
    }
    const keys = [`ed25519:${client.getDeviceEd25519Key()}`];
    if (client.getDeviceCurve25519Key) {
        keys.push(`curve25519:${client.getDeviceCurve25519Key()}`);
    }
    const crossSigning = client.crypto.crossSigningInfo;
    const secretStorage = client.crypto.secretStorage;
    const pkCache = client.getCrossSigningCacheCallbacks();
    const sessionBackupKeyFromCache = await client.crypto.getSessionBackupPrivateKey();

    return {
        "device_keys": keys.join(', '),
        "cross_signing_ready": String(await client.isCrossSigningReady()),
        "cross_signing_supported_by_hs":
            String(await client.doesServerSupportUnstableFeature("org.matrix.e2e_cross_signing")),
        "cross_signing_key": crossSigning.getId(),
        "cross_signing_privkey_in_secret_storage": String(
            !!(await crossSigning.isStoredInSecretStorage(secretStorage))),
        "cross_signing_master_privkey_cached": String(
            !!(pkCache && await pkCache.getCrossSigningKeyCache("master"))),
        "cross_signing_user_signing_privkey_cached": String(
            !!(pkCache && await pkCache.getCrossSigningKeyCache("user_signing"))),
        "secret_storage_ready": String(await client.isSecretStorageReady()),
        "secret_storage_key_in_account": String(!!(await secretStorage.hasKey())),
        "session_backup_key_in_secret_storage": String(!!(await client.isKeyBackupKeyStored())),
        "session_backup_key_cached": String(!!sessionBackupKeyFromCache),
        "session_backup_key_well_formed": String(sessionBackupKeyFromCache instanceof Uint8Array),
    };
}

function getDeviceContext(client: MatrixClient): Record<String, String> {
    const result = {
        "device_id": client?.deviceId,
        "mx_local_settings": localStorage.getItem('mx_local_settings'),
    };

    if (window.Modernizr) {
        const missingFeatures = Object.keys(window.Modernizr).filter(key => window.Modernizr[key] === false);
        if (missingFeatures.length > 0) {
            result["modernizr_missing_features"] = missingFeatures.join(", ");
        }
    }

    return result;
}

async function getContext() {
    const client = MatrixClientPeg.get();
    return {
        "contexts": {
            "user": getUserContext(client),
            "crypto": await getCryptoContext(client),
            "device": getDeviceContext(client),
            "storage": await getStorageOptions(),
        },
        "extra": {

        },
    };
}

export async function sendSentryReport(userText: string, label: string, error: Error): void {
    if (!SdkConfig.get()["sentry"]) return;

    // Ignore reports without errors, as they're not useful in sentry and can't easily be aggregated
    if (error) {
        Sentry.captureException(error, await getContext());
    }

    // TODO: use https://docs.sentry.io/api/projects/submit-user-feedback/ to submit userText
}

interface ISentryConfig {
    dsn: string;
    environment?: string;
}

export async function initSentry(sentryConfig: ISentryConfig): Promise<void> {
    if (!sentryConfig) return;
    const platform = PlatformPeg.get();
    let appVersion = "unknown";
    try {
        appVersion = await platform.getAppVersion();
    } catch (e) {}

    Sentry.init({
        dsn: sentryConfig.dsn,
        release: `${platform.getHumanReadableName()}@${appVersion}`,
        environment: sentryConfig.environment,
        defaultIntegrations: false,
        autoSessionTracking: false,
        debug: true,
        integrations: [
            // specifically disable Integrations.GlobalHandlers, which hooks uncaught exceptions - we don't
            // want to capture those at this stage, just explicit rageshakes
            new Sentry.Integrations.InboundFilters(),
            new Sentry.Integrations.FunctionToString(),
            new Sentry.Integrations.Breadcrumbs(),
            new Sentry.Integrations.UserAgent(),
            new Sentry.Integrations.Dedupe(),
        ],
        // Set to 1.0 which is reasonable if we're only submitting Rageshakes; will need to be set < 1.0
        // if we collect more frequently.
        tracesSampleRate: 1.0,
    });
}
