import posthog from 'posthog-js';
import SdkConfig from './SdkConfig';

interface IEvent {
    // The event name that will be used by PostHog.
    // TODO: standard format (camel case? snake? UpperCase?)
    eventName: string;

    // The properties of the event that will be stored in PostHog.
    properties: {}
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

export interface IOnboardingLoginBegin extends IEvent {
    key: "onboarding_login_begin",
}

const hashHex = async (input: string): Promise<string> => {
    const buf = new TextEncoder().encode(input);
    const digestBuf = await window.crypto.subtle.digest("sha-256", buf);
    return [...new Uint8Array(digestBuf)].map((b: number) => b.toString(16).padStart(2, "0")).join("");
};

export class PosthogAnalytics {
    private onlyTrackAnonymousEvents = false;
    private initialised = false;
    private posthog = null;

    private static _instance = null;

    public static instance(): PosthogAnalytics {
        if (!this.instance) {
            this._instance = new PosthogAnalytics(posthog);
        }
        return this._instance;
    }

    constructor(posthog) {
        this.posthog = posthog;
    }

    public init(onlyTrackAnonymousEvents: boolean) {
        if (Boolean(navigator.doNotTrack === "1")) {
            this.initialised = false;
            return;
        }
        this.onlyTrackAnonymousEvents = onlyTrackAnonymousEvents;
        const posthogConfig = SdkConfig.get()["posthog"];
        if (posthogConfig) {
            this.posthog.init(posthogConfig.projectApiKey, { api_host: posthogConfig.apiHost });
            this.initialised = true;
        }
    }

    public async identifyUser(userId: string) {
        if (this.onlyTrackAnonymousEvents) return;
        this.posthog.identify(await hashHex(userId));
    }

    public isInitialised(): boolean {
        return this.initialised;
    }

    public setOnlyTrackAnonymousEvents(enabled: boolean) {
        this.onlyTrackAnonymousEvents = enabled;
    }

    public trackPseudonymousEvent<E extends IPseudonymousEvent>(
        eventName: E["eventName"],
        properties: E["properties"],
    ) {
        if (!this.initialised) return;
        if (this.onlyTrackAnonymousEvents) return;
        this.posthog.capture(eventName, properties);
    }

    public trackAnonymousEvent<E extends IAnonymousEvent>(
        eventName: E["eventName"],
        properties: E["properties"],
    ) {
        if (!this.initialised) return;
        this.posthog.capture(eventName, properties);
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
        this.trackPseudonymousEvent(eventName, updatedProperties);
    }
}

export default function getAnalytics() {
    return PosthogAnalytics.instance();
}
