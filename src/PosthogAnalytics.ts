import posthog, { PostHog } from 'posthog-js';
import SdkConfig from './SdkConfig';

interface IEvent {
    // The event name that will be used by PostHog.
    // TODO: standard format (camel case? snake? UpperCase?)
    eventName: string;

    // The properties of the event that will be stored in PostHog.
    properties: {}
}

export enum Anonymity {
    Anonymous,
    Pseudonymous
}

// If an event extends IPseudonymousEvent, the event contains pseudonymous data
// that won't be sent unless the user has explicitly consented to pseudonymous tracking.
// For example, hashed user IDs or room IDs.
export interface IPseudonymousEvent extends IEvent {}

// If an event extends IAnonymousEvent, the event strictly contains *only* anonymous data which
// may be sent without explicit user consent.
export interface IAnonymousEvent extends IEvent {}

export interface IRoomEvent extends IPseudonymousEvent {
    hashedRoomId: string
}

export interface IOnboardingLoginBegin extends IAnonymousEvent {
    key: "onboarding_login_begin",
}

const hashHex = async (input: string): Promise<string> => {
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

    let [_, screen, ...parts] = hash.split("/");

    if (!knownScreens.has(screen)) {
        screen = "<redacted_screen_name>";
    }

    for (let i = 0; i < parts.length; i++) {
        parts[i] = anonymity === Anonymity.Anonymous ? `<redacted>` : await hashHex(parts[i]);
    }

    const hashStr = `${_}/${screen}/${parts.join("/")}`;
    return origin + pathname + hashStr;
}

export class PosthogAnalytics {
    private anonymity = Anonymity.Anonymous;
    private initialised = false;
    private posthog?: PostHog = null;
    private enabled = false;

    private static _instance = null;

    public static instance(): PosthogAnalytics {
        if (!this._instance) {
            this._instance = new PosthogAnalytics(posthog);
        }
        return this._instance;
    }

    constructor(posthog: PostHog) {
        this.posthog = posthog;
    }

    public init(anonymity: Anonymity) {
        const posthogConfig = SdkConfig.get()["posthog"];
        if (posthogConfig) {
            this.posthog.init(posthogConfig.projectApiKey, {
                api_host: posthogConfig.apiHost,
                autocapture: false,
                mask_all_text: true,
                mask_all_element_attributes: true,
                // this is disabled for now as its tricky to sanitize properties of the pageview
                // event because sanitization requires async crypto calls and the sanitize_properties
                // callback is synchronous.
                capture_pageview: false,
                sanitize_properties: this.sanitizeProperties.bind(this),
                respect_dnt: true,
            });
            this.initialised = true;
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

    public async identifyUser(userId: string) {
        if (this.anonymity == Anonymity.Anonymous) return;
        this.posthog.identify(await hashHex(userId));
    }

    public isInitialised() {
        return this.initialised;
    }

    public isEnabled() {
        return this.enabled;
    }

    public setAnonymity(anonymity: Anonymity) {
        this.anonymity = anonymity;
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

    private async capture(eventName: string, properties: posthog.Properties) {
        if (!this.enabled) {
            return;
        }
        if (!this.initialised) {
            throw Error("Tried to track event before PoshogAnalytics.init has completed");
        }
        const { origin, hash, pathname } = window.location;
        properties['$redacted_current_url'] = await getRedactedCurrentLocation(
            origin, hash, pathname, this.anonymity);
        this.posthog.capture(eventName, properties);
    }

    public async trackPseudonymousEvent<E extends IPseudonymousEvent>(
        eventName: E["eventName"],
        properties: E["properties"],
    ) {
        if (this.anonymity == Anonymity.Anonymous) return;
        await this.capture(eventName, properties);
    }

    public async trackAnonymousEvent<E extends IAnonymousEvent>(
        eventName: E["eventName"],
        properties: E["properties"],
    ) {
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
}

export function getAnalytics(): PosthogAnalytics {
    return PosthogAnalytics.instance();
}
