import posthog from 'posthog-js';
import SdkConfig from './SdkConfig';

export interface IEvent {
    key: string;
    properties: {}
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

    public isInitialised(): boolean {
        return this.initialised;
    }

    public setOnlyTrackAnonymousEvents(enabled: boolean) {
        this.onlyTrackAnonymousEvents = enabled;
    }

    public track<E extends IEvent>(
        key: E["key"],
        properties: E["properties"],
        anonymous = false,
    ) {
        if (!this.initialised) return;
        if (this.onlyTrackAnonymousEvents && !anonymous) return;

        this.posthog.capture(key, properties);
    }

    public async trackRoomEvent<E extends IEvent>(
        key: E["key"],
        roomId: string,
        properties: E["properties"],
        ...args
    ) {
        const updatedProperties = {
            ...properties,
            hashedRoomId: roomId ? await hashHex(roomId) : null,
        };
        this.track(key, updatedProperties, ...args);
    }
}
