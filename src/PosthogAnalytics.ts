import posthog, { PostHog } from 'posthog-js';
import PlatformPeg from './PlatformPeg';
import SdkConfig from './SdkConfig';
import SettingsStore from './settings/SettingsStore';

/* Posthog analytics tracking.
 *
 * Anonymity behaviour is as follows:
 *
 * - If Posthog isn't configured in `config.json`, events are not sent.
 * - If [Do Not Track](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/doNotTrack) is
 *   enabled, events are not sent (this detection is built into posthog and turned on via the
 *   `respect_dnt` flag being passed to `posthog.init`).
 * - If the `feature_pseudonymousAnalyticsOptIn` labs flag is `true`, track pseudonomously, i.e.
 *   hash all matrix identifiers in tracking events (user IDs, room IDs etc) using SHA-256.
 * - Otherwise, if the existing `analyticsOptIn` flag is `true`, or not present (i.e. prior to
 *   logging in), track anonymously, i.e. redact all matrix identifiers in tracking events.
 * - If both flags are false, events are not sent.
*/

interface IEvent {
    // The event name that will be used by PostHog.
    // TODO: standard format (camel case? snake? UpperCase?)
    eventName: string;

    // The properties of the event that will be stored in PostHog.
    properties: {}
}

export enum Anonymity {
    Disabled,
    Anonymous,
    Pseudonymous
}

// If an event extends IPseudonymousEvent, the event contains pseudonymous data
// that won't be sent unless the user has explicitly consented to pseudonymous tracking.
// For example, it might contain hashed user IDs or room IDs.
// Such events will be automatically dropped if PosthogAnalytics.anonymity isn't set to Pseudonymous.
export interface IPseudonymousEvent extends IEvent {}

// If an event extends IAnonymousEvent, the event strictly contains *only* anonymous data;
// i.e. no identifiers that can be associated with the user.
export interface IAnonymousEvent extends IEvent {}

export interface IRoomEvent extends IPseudonymousEvent {
    hashedRoomId: string
}

interface IPageView extends IAnonymousEvent {
    eventName: "$pageview",
    properties: {
        durationMs?: number
        screen?: string
    }
}

export interface IWelcomeScreenLoad extends IAnonymousEvent {
    eventName: "welcome_screen_load",
}

const hashHex = async (input: string): Promise<string> => {
    // on os x (e.g. if you want to know the sha-256 of your own matrix ID so you can look it up):
    // echo -n <input> | shasum -a 256
    const buf = new TextEncoder().encode(input);
    const digestBuf = await window.crypto.subtle.digest("sha-256", buf);
    return [...new Uint8Array(digestBuf)].map((b: number) => b.toString(16).padStart(2, "0")).join("");
};

const knownScreens = new Set([
    "register", "login", "forgot_password", "soft_logout", "new", "settings", "welcome", "home", "start", "directory",
    "start_sso", "start_cas", "groups", "complete_security", "post_registration", "room", "user", "group",
]);

export async function getRedactedCurrentLocation(origin: string, hash: string, pathname: string, anonymity: Anonymity) {
    // Redact PII from the current location.
    // If anonymous is true, redact entirely, if false, substitute it with a hash.
    // For known screens, assumes a URL structure of /<screen name>/might/be/pii
    if (origin.startsWith('file://')) {
        pathname = "/<redacted_file_scheme_url>/";
    }

    let hashStr;
    if (hash == "") {
        hashStr = "";
    } else {
        let [_, screen, ...parts] = hash.split("/");

        if (!knownScreens.has(screen)) {
            screen = "<redacted_screen_name>";
        }

        for (let i = 0; i < parts.length; i++) {
            parts[i] = anonymity === Anonymity.Anonymous ? `<redacted>` : await hashHex(parts[i]);
        }

        hashStr = `${_}/${screen}/${parts.join("/")}`;
    }
    return origin + pathname + hashStr;
}

export class PosthogAnalytics {
    /* Wrapper for Posthog analytics.
     * 3 modes of anonymity are supported, governed by this.anonymity
     * - Anonymity.Disabled means *no data* is passed to posthog
     * - Anonymity.Anonymous means all identifers will be redacted before being passed to posthog
     * - Anonymity.Pseudonymous means all identifiers will be hashed via SHA-256 before being passed
     *   to Posthog
     *
     * To update anonymity, call updateAnonymityFromSettings() or you can set it directly via setAnonymity().
     *
     * To pass an event to Posthog:
     *
     * 1. Declare a type for the event, extending IAnonymousEvent, IPseudonymousEvent or IRoomEvent.
     * 2. Call the appropriate track*() method. Pseudonymous events will be dropped when anonymity is
     *    Anonymous or Disabled; Anonymous events will be dropped when anonymity is Disabled.
     */

    private anonymity = Anonymity.Anonymous;
    private posthog?: PostHog = null;
    // set true during the constructor if posthog config is present, otherwise false
    private enabled = false;
    private static _instance = null;
    private platformSuperProperties = {};

    public static instance(): PosthogAnalytics {
        if (!this._instance) {
            this._instance = new PosthogAnalytics(posthog);
        }
        return this._instance;
    }

    constructor(posthog: PostHog) {
        this.posthog = posthog;
        const posthogConfig = SdkConfig.get()["posthog"];
        if (posthogConfig) {
            this.posthog.init(posthogConfig.projectApiKey, {
                api_host: posthogConfig.apiHost,
                autocapture: false,
                mask_all_text: true,
                mask_all_element_attributes: true,
                // This only triggers on page load, which for our SPA isn't particularly useful.
                // Plus, the .capture call originating from somewhere in posthog makes it hard
                // to redact URLs, which requires async code.
                //
                // To raise this manually, just call .capture("$pageview") or posthog.capture_pageview.
                capture_pageview: false,
                sanitize_properties: this.sanitizeProperties.bind(this),
                respect_dnt: true,
            });
            this.enabled = true;
        } else {
            this.enabled = false;
        }
    }

    private sanitizeProperties(properties: posthog.Properties, _: string): posthog.Properties {
        // Callback from posthog to sanitize properties before sending them to the server.
        //
        // Here we sanitize posthog's built in properties which leak PII e.g. url reporting.
        // See utils.js _.info.properties in posthog-js.

        // Replace the $current_url with a redacted version.
        // $redacted_current_url is injected by this class earlier in capture(), as its generation
        // is async and can't be done in this non-async callback.
        if (!properties['$redacted_current_url']) {
            console.log("$redacted_current_url not set in sanitizeProperties, will drop $current_url entirely");
        }
        properties['$current_url'] = properties['$redacted_current_url'];
        delete properties['$redacted_current_url'];

        if (this.anonymity == Anonymity.Anonymous) {
            // drop referrer information for anonymous users
            properties['$referrer'] = null;
            properties['$referring_domain'] = null;
            properties['$initial_referrer'] = null;
            properties['$initial_referring_domain'] = null;

            // drop device ID, which is a UUID persisted in local storage
            properties['$device_id'] = null;
        }

        return properties;
    }

    private static getAnonymityFromSettings(): Anonymity {
        // determine the current anonymity level based on curernt user settings

        // "Send anonymous usage data which helps us improve Element. This will use a cookie."
        const analyticsOptIn = SettingsStore.getValue("analyticsOptIn", null, true);

        // (proposed wording) "Send pseudonymous usage data which helps us improve Element. This will use a cookie."
        //
        // TODO: Currently, this is only a labs flag, for testing purposes.
        const pseudonumousOptIn = SettingsStore.getValue("feature_pseudonymousAnalyticsOptIn", null, true);

        let anonymity;
        if (pseudonumousOptIn) {
            anonymity = Anonymity.Pseudonymous;
        } else if (analyticsOptIn || analyticsOptIn === null) {
            // If no analyticsOptIn has been set (i.e. before the user has logged in, or if they haven't answered the
            // opt-in question, assume Anonymous)
            anonymity = Anonymity.Anonymous;
        } else {
            anonymity = Anonymity.Disabled;
        }

        return anonymity;
    }

    private registerSuperProperties(properties) {
        if (this.enabled) {
            this.posthog.register(properties);
        }
    }

    private static async getPlatformProperties() {
        const platform = PlatformPeg.get();
        let appVersion;
        try {
            appVersion = await platform.getAppVersion();
        } catch (e) {
            // this happens if no version is set i.e. in dev
            appVersion = "unknown";
        }

        return {
            appVersion,
            appPlatform: platform.getHumanReadableName(),
        };
    }

    private async capture(eventName: string, properties: posthog.Properties) {
        if (!this.enabled) {
            return;
        }
        const { origin, hash, pathname } = window.location;
        properties['$redacted_current_url'] = await getRedactedCurrentLocation(
            origin, hash, pathname, this.anonymity);
        this.posthog.capture(eventName, properties);
    }

    public isEnabled() {
        return this.enabled;
    }

    public setAnonymity(anonymity: Anonymity) {
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
    }

    public async identifyUser(userId: string) {
        if (this.anonymity == Anonymity.Pseudonymous) {
            this.posthog.identify(await hashHex(userId));
        }
    }

    public getAnonymity() {
        return this.anonymity;
    }

    public logout() {
        if (this.enabled) {
            this.posthog.reset();
        }
        this.setAnonymity(Anonymity.Anonymous);
    }

    public async trackPseudonymousEvent<E extends IPseudonymousEvent>(
        eventName: E["eventName"],
        properties: E["properties"],
    ) {
        if (this.anonymity == Anonymity.Anonymous || this.anonymity == Anonymity.Disabled) return;
        await this.capture(eventName, properties);
    }

    public async trackAnonymousEvent<E extends IAnonymousEvent>(
        eventName: E["eventName"],
        properties: E["properties"],
    ) {
        if (this.anonymity == Anonymity.Disabled) return;
        await this.capture(eventName, properties);
    }

    public async trackRoomEvent<E extends IRoomEvent>(
        eventName: E["eventName"],
        roomId: string,
        properties: Omit<E["properties"], "roomId">,
    ) {
        const updatedProperties = {
            ...properties,
            hashedRoomId: roomId ? await hashHex(roomId) : null,
        };
        await this.trackPseudonymousEvent(eventName, updatedProperties);
    }

    public async trackPageView(durationMs: number) {
        const hash = window.location.hash;

        let screen = null;
        const split = hash.split("/");
        if (split.length >= 2) {
            screen = split[1];
        }

        await this.trackAnonymousEvent<IPageView>("$pageview", {
            durationMs,
            screen,
        });
    }

    public async updatePlatformSuperProperties() {
        // Update super properties in posthog with our platform (app version, platform).
        // These properties will be subsequently passed in every event.
        //
        // This only needs to be done once per page lifetime. Note that getPlatformProperties
        // is async and can involve a network request if we are running in a browser.
        this.platformSuperProperties = await PosthogAnalytics.getPlatformProperties();
        this.registerSuperProperties(this.platformSuperProperties);
    }

    public async updateAnonymityFromSettings(userId?: string) {
        // Update this.anonymity based on the user's analytics opt-in settings
        // Identify the user (via hashed user ID) to posthog if anonymity is pseudonmyous
        this.setAnonymity(PosthogAnalytics.getAnonymityFromSettings());
        if (userId && this.getAnonymity() == Anonymity.Pseudonymous) {
            await this.identifyUser(userId);
        }
    }
}

export function getAnalytics(): PosthogAnalytics {
    return PosthogAnalytics.instance();
}
