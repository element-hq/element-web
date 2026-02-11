/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import posthog, { type CaptureOptions, type PostHog, type Properties } from "posthog-js";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { type UserProperties } from "@matrix-org/analytics-events/types/typescript/UserProperties";
import { type Signup } from "@matrix-org/analytics-events/types/typescript/Signup";

import PlatformPeg from "./PlatformPeg";
import SdkConfig from "./SdkConfig";
import { MatrixClientPeg } from "./MatrixClientPeg";
import SettingsStore from "./settings/SettingsStore";
import { type ScreenName } from "./PosthogTrackers";
import { type ActionPayload } from "./dispatcher/payloads";
import { Action } from "./dispatcher/actions";
import { type SettingUpdatedPayload } from "./dispatcher/payloads/SettingUpdatedPayload";
import dis from "./dispatcher/dispatcher";
import { Layout } from "./settings/enums/Layout";

/* Posthog analytics tracking.
 *
 * Anonymity behaviour is as follows:
 *
 * - If Posthog isn't configured in `config.json`, events are not sent.
 * - If [Do Not Track](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/doNotTrack) is
 *   enabled, events are not sent (this detection is built into posthog and turned on via the
 *   `respect_dnt` flag being passed to `posthog.init`).
 * - If the `feature_pseudonymous_analytics_opt_in` labs flag is `true`, track pseudonomously by maintaining
 *   a randomised analytics ID in account_data for that user (shared between devices) and sending it to posthog to
     identify the user.
 * - Otherwise, if the existing `analyticsOptIn` flag is `true`, track anonymously, i.e. do not identify the user
     using any identifier that would be consistent across devices.
 * - If both flags are false or not set, events are not sent.
 */

export interface IPosthogEvent {
    // The event name that will be used by PostHog. Event names should use camelCase.
    eventName: string;

    // do not allow these to be sent manually, we enqueue them all for caching purposes
    $set?: void;
    $set_once?: void;
}

export enum Anonymity {
    Disabled,
    Anonymous,
    Pseudonymous,
}

const whitelistedScreens = new Set([
    "register",
    "login",
    "forgot_password",
    "soft_logout",
    "new",
    "settings",
    "welcome",
    "home",
    "start",
    "directory",
    "start_sso",
    "start_cas",
    "complete_security",
    "post_registration",
    "room",
    "user",
]);

export function getRedactedCurrentLocation(origin: string, hash: string, pathname: string): string {
    // Redact PII from the current location.
    // For known screens, assumes a URL structure of /<screen name>/might/be/pii
    if (origin.startsWith("file://")) {
        pathname = "/<redacted_file_scheme_url>/";
    }

    let hashStr;
    if (hash == "") {
        hashStr = "";
    } else {
        let [beforeFirstSlash, screen] = hash.split("/");

        if (!whitelistedScreens.has(screen)) {
            screen = "<redacted_screen_name>";
        }

        hashStr = `${beforeFirstSlash}/${screen}/<redacted>`;
    }
    return origin + pathname + hashStr;
}

interface PlatformProperties {
    appVersion: string;
    appPlatform: string;
}

export class PosthogAnalytics {
    /* Wrapper for Posthog analytics.
     * 3 modes of anonymity are supported, governed by this.anonymity
     * - Anonymity.Disabled means *no data* is passed to posthog
     * - Anonymity.Anonymous means no identifier is passed to posthog
     * - Anonymity.Pseudonymous means an analytics ID stored in account_data and shared between devices
     *   is passed to posthog.
     *
     * To update anonymity, call updateAnonymityFromSettings() or you can set it directly via setAnonymity().
     *
     * To pass an event to Posthog:
     *
     * 1. Declare a type for the event, extending IAnonymousEvent or IPseudonymousEvent.
     * 2. Call the appropriate track*() method. Pseudonymous events will be dropped when anonymity is
     *    Anonymous or Disabled; Anonymous events will be dropped when anonymity is Disabled.
     */

    private anonymity = Anonymity.Disabled;
    // set true during the constructor if posthog config is present, otherwise false
    private readonly enabled: boolean = false;
    private static _instance: PosthogAnalytics | null = null;
    private platformSuperProperties: Properties = {};
    public static readonly ANALYTICS_EVENT_TYPE = "im.vector.analytics";
    private propertiesForNextEvent: Partial<Record<"$set" | "$set_once", UserProperties>> = {};
    private userPropertyCache: UserProperties = {};
    private authenticationType: Signup["authenticationType"] = "Other";
    private watchSettingRef?: string;

    // Will be set when the matrixClient is passed to the analytics object (e.g. on login).
    private currentCryptoBackend?: "Rust" | "Legacy" = undefined;

    public static get instance(): PosthogAnalytics {
        if (!this._instance) {
            this._instance = new PosthogAnalytics(posthog);
        }
        return this._instance;
    }

    public constructor(private readonly posthog: PostHog) {
        const posthogConfig = SdkConfig.getObject("posthog");
        if (posthogConfig) {
            this.posthog.init(posthogConfig.get("project_api_key"), {
                api_host: posthogConfig.get("api_host"),
                autocapture: false,
                mask_all_text: true,
                mask_all_element_attributes: true,
                // This only triggers on page load, which for our SPA isn't particularly useful.
                // Plus, the .capture call originating from somewhere in posthog makes it hard
                // to redact URLs, which requires async code.
                //
                // To raise this manually, just call .capture("$pageview") or posthog.capture_pageview.
                capture_pageview: false,
                sanitize_properties: this.sanitizeProperties,
                respect_dnt: true,
                advanced_disable_decide: true,
            });
            this.enabled = true;
        } else {
            this.enabled = false;
        }

        dis.register(this.onAction);
        SettingsStore.monitorSetting("layout", null);
        SettingsStore.monitorSetting("useCompactLayout", null);
        this.onLayoutUpdated();
        this.updateCryptoSuperProperty();
    }

    private onLayoutUpdated = (): void => {
        let layout: UserProperties["WebLayout"];

        switch (SettingsStore.getValue("layout")) {
            case Layout.IRC:
                layout = "IRC";
                break;
            case Layout.Bubble:
                layout = "Bubble";
                break;
            case Layout.Group:
                layout = SettingsStore.getValue("useCompactLayout") ? "Compact" : "Group";
                break;
        }

        // This is known to clobber other devices but is a good enough solution
        // to get an idea of how much use each layout gets.
        this.setProperty("WebLayout", layout);
    };

    private onAction = (payload: ActionPayload): void => {
        if (payload.action !== Action.SettingUpdated) return;
        const settingsPayload = payload as SettingUpdatedPayload;
        if (["layout", "useCompactLayout"].includes(settingsPayload.settingName)) {
            this.onLayoutUpdated();
        }
    };

    // we persist the last `$screen_name` and send it for all events until it is replaced
    private lastScreen: ScreenName = "Loading";

    private sanitizeProperties = (properties: Properties, eventName: string): Properties => {
        // Callback from posthog to sanitize properties before sending them to the server.
        //
        // Here we sanitize posthog's built in properties which leak PII e.g. url reporting.
        // See utils.js _.info.properties in posthog-js.

        if (eventName === "$pageview") {
            this.lastScreen = properties["$current_url"];
        }
        // We inject a screen identifier in $current_url as per https://posthog.com/tutorials/spa
        properties["$current_url"] = this.lastScreen;

        if (this.anonymity == Anonymity.Anonymous) {
            // drop referrer information for anonymous users
            properties["$referrer"] = null;
            properties["$referring_domain"] = null;
            properties["$initial_referrer"] = null;
            properties["$initial_referring_domain"] = null;

            // drop device ID, which is a UUID persisted in local storage
            properties["$device_id"] = null;
        }

        return properties;
    };

    private registerSuperProperties(properties: Properties): void {
        if (this.enabled) {
            this.posthog.register(properties);
        }
    }

    private static async getPlatformProperties(): Promise<Partial<PlatformProperties>> {
        const platform = PlatformPeg.get();
        let appVersion: string | undefined;
        try {
            appVersion = await platform?.getAppVersion();
        } catch {
            // this happens if no version is set i.e. in dev
            appVersion = "unknown";
        }

        return {
            appVersion,
            appPlatform: platform?.getHumanReadableName(),
        };
    }

    // eslint-disable-nextline no-unused-vars
    private capture(eventName: string, properties: Properties, options?: CaptureOptions): void {
        if (!this.enabled) {
            return;
        }
        const { origin, hash, pathname } = window.location;
        properties["redactedCurrentUrl"] = getRedactedCurrentLocation(origin, hash, pathname);
        this.posthog.capture(eventName, { ...this.propertiesForNextEvent, ...properties }, options);
        this.propertiesForNextEvent = {};
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public setAnonymity(anonymity: Anonymity): void {
        // Update this.anonymity.
        // This is public for testing purposes, typically you want to call updateAnonymityFromSettings
        // to ensure this value is in step with the user's settings.
        if (this.enabled && (anonymity == Anonymity.Disabled || anonymity == Anonymity.Anonymous)) {
            // when transitioning to Disabled or Anonymous ensure we clear out any prior state
            // set in posthog e.g. distinct ID
            this.posthog.reset();
            // Restore any previously set platform super properties
            this.registerSuperProperties(this.platformSuperProperties);
        }
        this.anonymity = anonymity;
        // update anyhow, no-op if not enabled or Disabled.
        this.updateCryptoSuperProperty();
    }

    private static getRandomAnalyticsId(): string {
        return [...crypto.getRandomValues(new Uint8Array(16))].map((c) => c.toString(16)).join("");
    }

    public async identifyUser(client: MatrixClient, analyticsIdGenerator: () => string): Promise<void> {
        if (this.anonymity == Anonymity.Pseudonymous) {
            // Check the user's account_data for an analytics ID to use. Storing the ID in account_data allows
            // different devices to send the same ID.
            try {
                const accountData = await client.getAccountDataFromServer(PosthogAnalytics.ANALYTICS_EVENT_TYPE);
                let analyticsID = accountData?.id;
                if (!analyticsID) {
                    // Couldn't retrieve an analytics ID from user settings, so create one and set it on the server.
                    // Note there's a race condition here - if two devices do these steps at the same time, last write
                    // wins, and the first writer will send tracking with an ID that doesn't match the one on the server
                    // until the next time account data is refreshed and this function is called (most likely on next
                    // page load). This will happen pretty infrequently, so we can tolerate the possibility.
                    analyticsID = analyticsIdGenerator();
                    await client.setAccountData(PosthogAnalytics.ANALYTICS_EVENT_TYPE, {
                        id: analyticsID,
                        ...accountData,
                    });
                }
                if (this.posthog.get_distinct_id() === analyticsID) {
                    // No point identifying again
                    return;
                }
                if (this.posthog.persistence?.get_property("$user_state") === "identified") {
                    // Analytics ID has changed, reset as Posthog will refuse to merge in this case
                    this.posthog.reset();
                }
                this.posthog.identify(analyticsID);
            } catch (e) {
                // The above could fail due to network requests, but not essential to starting the application,
                // so swallow it.
                logger.log("Unable to identify user for tracking", e);
            }
        }
    }

    public getAnonymity(): Anonymity {
        return this.anonymity;
    }

    public logout(): void {
        if (this.enabled) {
            this.posthog.reset();
        }
        SettingsStore.unwatchSetting(this.watchSettingRef);
        this.setAnonymity(Anonymity.Disabled);
    }

    public trackEvent<E extends IPosthogEvent>({ eventName, ...properties }: E, options?: CaptureOptions): void {
        if (this.anonymity == Anonymity.Disabled || this.anonymity == Anonymity.Anonymous) return;
        this.capture(eventName, properties, options);
    }

    public setProperty<K extends keyof UserProperties>(key: K, value: UserProperties[K]): void {
        if (this.userPropertyCache[key] === value) return; // nothing to do
        this.userPropertyCache[key] = value;

        if (!this.propertiesForNextEvent["$set"]) {
            this.propertiesForNextEvent["$set"] = {};
        }
        this.propertiesForNextEvent["$set"][key] = value;
    }

    public setPropertyOnce<K extends keyof UserProperties>(key: K, value: UserProperties[K]): void {
        if (this.userPropertyCache[key]) return; // nothing to do
        this.userPropertyCache[key] = value;

        if (!this.propertiesForNextEvent["$set_once"]) {
            this.propertiesForNextEvent["$set_once"] = {};
        }
        this.propertiesForNextEvent["$set_once"][key] = value;
    }

    public async updatePlatformSuperProperties(): Promise<void> {
        // Update super properties in posthog with our platform (app version, platform).
        // These properties will be subsequently passed in every event.
        //
        // This only needs to be done once per page lifetime. Note that getPlatformProperties
        // is async and can involve a network request if we are running in a browser.
        this.platformSuperProperties = await PosthogAnalytics.getPlatformProperties();
        this.registerSuperProperties(this.platformSuperProperties);
    }

    private updateCryptoSuperProperty(): void {
        if (!this.enabled || this.anonymity === Anonymity.Disabled) return;
        // Update super property for cryptoSDK in posthog.
        // This property will be subsequently passed in every event.
        if (this.currentCryptoBackend) {
            this.registerSuperProperties({ cryptoSDK: this.currentCryptoBackend });
        }
    }

    public async updateAnonymityFromSettings(client: MatrixClient, pseudonymousOptIn: boolean): Promise<void> {
        // Temporary until we have migration code to switch crypto sdk.
        if (client.getCrypto()) {
            const cryptoVersion = client.getCrypto()!.getVersion();
            // version for rust is something like "Rust SDK 0.6.0 (9c6b550), Vodozemac 0.5.0"
            // for legacy it will be 'Olm x.x.x"
            if (cryptoVersion.includes("Rust SDK")) {
                this.currentCryptoBackend = "Rust";
            } else {
                this.currentCryptoBackend = "Legacy";
            }
        }

        // Update this.anonymity based on the user's analytics opt-in settings
        const anonymity = pseudonymousOptIn ? Anonymity.Pseudonymous : Anonymity.Disabled;
        this.setAnonymity(anonymity);
        if (anonymity === Anonymity.Pseudonymous) {
            await this.identifyUser(client, PosthogAnalytics.getRandomAnalyticsId);
            if (MatrixClientPeg.currentUserIsJustRegistered()) {
                this.trackNewUserEvent();
            }
        }

        if (anonymity !== Anonymity.Disabled) {
            await this.updatePlatformSuperProperties();
            this.updateCryptoSuperProperty();
        }
    }

    public startListeningToSettingsChanges(client: MatrixClient): void {
        // Listen to account data changes from sync so we can observe changes to relevant flags and update.
        // This is called -
        //  * On page load, when the account data is first received by sync
        //  * On login
        //  * When another device changes account data
        //  * When the user changes their preferences on this device
        // Note that for new accounts, pseudonymousAnalyticsOptIn won't be set, so updateAnonymityFromSettings
        // won't be called (i.e. this.anonymity will be left as the default, until the setting changes)
        this.watchSettingRef = SettingsStore.watchSetting(
            "pseudonymousAnalyticsOptIn",
            null,
            (originalSettingName, changedInRoomId, atLevel, newValueAtLevel, newValue) => {
                this.updateAnonymityFromSettings(client, !!newValue);
            },
        );
    }

    public setAuthenticationType(authenticationType: Signup["authenticationType"]): void {
        this.authenticationType = authenticationType;
    }

    private trackNewUserEvent(): void {
        // This is the only event that could have occured before analytics opt-in
        // that we want to accumulate before the user has given consent
        // All other scenarios should not track a user before they have given
        // explicit consent that they are ok with their analytics data being collected
        const options: CaptureOptions = {};
        const registrationTime = parseInt(window.localStorage.getItem("mx_registration_time")!, 10);
        if (!isNaN(registrationTime)) {
            options.timestamp = new Date(registrationTime);
        }

        return this.trackEvent<Signup>(
            {
                eventName: "Signup",
                authenticationType: this.authenticationType,
            },
            options,
        );
    }
}
