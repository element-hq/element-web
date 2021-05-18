/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import {randomString} from "matrix-js-sdk/src/randomstring";

import {getCurrentLanguage} from './languageHandler';
import PlatformPeg from './PlatformPeg';
import SdkConfig from './SdkConfig';
import {MatrixClientPeg} from "./MatrixClientPeg";
import {sleep} from "./utils/promise";
import RoomViewStore from "./stores/RoomViewStore";

// polyfill textencoder if necessary
import * as TextEncodingUtf8 from 'text-encoding-utf-8';
let TextEncoder = window.TextEncoder;
if (!TextEncoder) {
    TextEncoder = TextEncodingUtf8.TextEncoder;
}

const INACTIVITY_TIME = 20; // seconds
const HEARTBEAT_INTERVAL = 5_000; // ms
const SESSION_UPDATE_INTERVAL = 60; // seconds
const MAX_PENDING_EVENTS = 1000;

enum Orientation {
    Landscape = "landscape",
    Portrait = "portrait",
}

/* eslint-disable camelcase */
interface IMetrics {
    _resolution?: string;
    _app_version?: string;
    _density?: number;
    _ua?: string;
    _locale?: string;
}

interface IEvent {
    key: string;
    count: number;
    sum?: number;
    dur?: number;
    segmentation?: Record<string, unknown>;
    timestamp?: number; // TODO should we use the timestamp when we start or end for the event timestamp
    hour?: unknown;
    dow?: unknown;
}

interface IViewEvent extends IEvent {
    key: "[CLY]_view";
}

interface IOrientationEvent extends IEvent {
    key: "[CLY]_orientation";
    segmentation: {
        mode: Orientation;
    };
}

interface IStarRatingEvent extends IEvent {
    key: "[CLY]_star_rating";
    segmentation: {
        // we just care about collecting feedback, no need to associate with a feedback widget
        widget_id?: string;
        contactMe?: boolean;
        email?: string;
        rating: 1 | 2 | 3 | 4 | 5;
        comment: string;
    };
}

type Value = string | number | boolean;

interface IOperationInc {
    "$inc": number;
}
interface IOperationMul {
    "$mul": number;
}
interface IOperationMax {
    "$max": number;
}
interface IOperationMin {
    "$min": number;
}
interface IOperationSetOnce {
    "$setOnce": Value;
}
interface IOperationPush {
    "$push": Value | Value[];
}
interface IOperationAddToSet {
    "$addToSet": Value | Value[];
}
interface IOperationPull {
    "$pull": Value | Value[];
}

type Operation =
    IOperationInc |
    IOperationMul |
    IOperationMax |
    IOperationMin |
    IOperationSetOnce |
    IOperationPush |
    IOperationAddToSet |
    IOperationPull;

interface IUserDetails {
    name?: string;
    username?: string;
    email?: string;
    organization?: string;
    phone?: string;
    picture?: string;
    gender?: string;
    byear?: number;
    custom?: Record<string, Value | Operation>; // `.` and `$` will be stripped out
}

interface ICrash {
    _resolution?: string;
    _app_version: string;

    _ram_current?: number;
    _ram_total?: number;
    _disk_current?: number;
    _disk_total?: number;
    _orientation?: Orientation;

    _online?: boolean;
    _muted?: boolean;
    _background?: boolean;
    _view?: string;

    _name?: string;
    _error: string;
    _nonfatal?: boolean;
    _logs?: string;
    _run?: number;

    _custom?: Record<string, string>;
}

interface IParams {
    // APP_KEY of an app for which to report
    app_key: string;
    // User identifier
    device_id: string;

    // Should provide value 1 to indicate session start
    begin_session?: number;
    // JSON object as string to provide metrics to track with the user
    metrics?: string;
    // Provides session duration in seconds, can be used as heartbeat to update current sessions duration, recommended time every 60 seconds
    session_duration?: number;
    // Should provide value 1 to indicate session end
    end_session?: number;

    // 10 digit UTC timestamp for recording past data.
    timestamp?: number;
    // current user local hour (0 - 23)
    hour?: number;
    // day of the week (0-sunday, 1 - monday, ... 6 - saturday)
    dow?: number;

    // JSON array as string containing event objects
    events?: string; // IEvent[]
    // JSON object as string containing information about users
    user_details?: string;

    // provide when changing device ID, so server would merge the data
    old_device_id?: string;

    // See ICrash
    crash?: string;
}

interface IRoomSegments extends Record<string, Value> {
    room_id: string; // hashed
    num_users: number;
    is_encrypted: boolean;
    is_public: boolean;
}

interface ISendMessageEvent extends IEvent {
    key: "send_message";
    dur: number; // how long it to send (until remote echo)
    segmentation: IRoomSegments & {
        is_edit: boolean;
        is_reply: boolean;
        msgtype: string;
        format?: string;
    };
}

interface IRoomDirectoryEvent extends IEvent {
    key: "room_directory";
}

interface IRoomDirectoryDoneEvent extends IEvent {
    key: "room_directory_done";
    dur: number; // time spent in the room directory modal
}

interface IRoomDirectorySearchEvent extends IEvent {
    key: "room_directory_search";
    sum: number; // number of search results
    segmentation: {
        query_length: number;
        query_num_words: number;
    };
}

interface IStartCallEvent extends IEvent {
    key: "start_call";
    segmentation: IRoomSegments & {
        is_video: boolean;
        is_jitsi: boolean;
    };
}

interface IJoinCallEvent extends IEvent {
    key: "join_call";
    segmentation: IRoomSegments & {
        is_video: boolean;
        is_jitsi: boolean;
    };
}

interface IBeginInviteEvent extends IEvent {
    key: "begin_invite";
    segmentation: IRoomSegments;
}

interface ISendInviteEvent extends IEvent {
    key: "send_invite";
    sum: number; // quantity that was invited
    segmentation: IRoomSegments;
}

interface ICreateRoomEvent extends IEvent {
    key: "create_room";
    dur: number; // how long it took to create (until remote echo)
    segmentation: {
        room_id: string; // hashed
        num_users: number;
        is_encrypted: boolean;
        is_public: boolean;
    }
}

interface IJoinRoomEvent extends IEvent {
    key: "join_room";
    dur: number; // how long it took to join (until remote echo)
    segmentation: {
        room_id: string; // hashed
        num_users: number;
        is_encrypted: boolean;
        is_public: boolean;
        type: "room_directory" | "slash_command" | "link" | "invite";
    };
}
/* eslint-enable camelcase */

const hashHex = async (input: string): Promise<string> => {
    const buf = new TextEncoder().encode(input);
    const digestBuf = await window.crypto.subtle.digest("sha-256", buf);
    return [...new Uint8Array(digestBuf)].map((b: number) => b.toString(16).padStart(2, "0")).join("");
};

const knownScreens = new Set([
    "register", "login", "forgot_password", "soft_logout", "new", "settings", "welcome", "home", "start", "directory",
    "start_sso", "start_cas", "groups", "complete_security", "post_registration", "room", "user", "group",
]);

interface IViewData {
    name: string;
    url: string;
    meta: Record<string, string>;
}

// Apply fn to all hash path parts after the 1st one
async function getViewData(anonymous = true): Promise<IViewData> {
    const rand = randomString(8);
    const { origin, hash } = window.location;
    let { pathname } = window.location;

    // Redact paths which could contain unexpected PII
    if (origin.startsWith('file://')) {
        pathname = `/<redacted_${rand}>/`; // XXX: inject rand because Count.ly doesn't like X->X transitions
    }

    let [_, screen, ...parts] = hash.split("/");

    if (!knownScreens.has(screen)) {
        screen = `<redacted_${rand}>`;
    }

    for (let i = 0; i < parts.length; i++) {
        parts[i] = anonymous ? `<redacted_${rand}>` : await hashHex(parts[i]);
    }

    const hashStr = `${_}/${screen}/${parts.join("/")}`;
    const url = origin + pathname + hashStr;

    const meta = {};

    let name = "$/" + hash;
    switch (screen) {
        case "room": {
            name = "view_room";
            const roomId = RoomViewStore.getRoomId();
            name += " " + parts[0]; // XXX: workaround Count.ly missing X->X transitions
            meta["room_id"] = parts[0];
            Object.assign(meta, getRoomStats(roomId));
            break;
        }
    }

    return { name, url, meta };
}

const getRoomStats = (roomId: string) => {
    const cli = MatrixClientPeg.get();
    const room = cli?.getRoom(roomId);

    return {
        "num_users": room?.getJoinedMemberCount(),
        "is_encrypted": cli?.isRoomEncrypted(roomId),
        // eslint-disable-next-line camelcase
        "is_public": room?.currentState.getStateEvents("m.room.join_rules", "")?.getContent()?.join_rule === "public",
    }
}

// async wrapper for regex-powered String.prototype.replace
const strReplaceAsync = async (str: string, regex: RegExp, fn: (...args: string[]) => Promise<string>) => {
    const promises: Promise<string>[] = [];
    // dry-run to calculate the replace values
    str.replace(regex, (...args: string[]) => {
        promises.push(fn(...args));
        return "";
    });
    const values = await Promise.all(promises);
    return str.replace(regex, () => values.shift());
};

export default class CountlyAnalytics {
    private baseUrl: URL = null;
    private appKey: string = null;
    private userKey: string = null;
    private anonymous: boolean;
    private appPlatform: string;
    private appVersion = "unknown";

    private initTime = CountlyAnalytics.getTimestamp();
    private firstPage = true;
    private heartbeatIntervalId: NodeJS.Timeout;
    private activityIntervalId: NodeJS.Timeout;
    private trackTime = true;
    private lastBeat: number;
    private storedDuration = 0;
    private lastView: string;
    private lastViewTime = 0;
    private lastViewStoredDuration = 0;
    private sessionStarted = false;
    private heartbeatEnabled = false;
    private inactivityCounter = 0;
    private pendingEvents: IEvent[] = [];

    private static internalInstance = new CountlyAnalytics();

    public static get instance(): CountlyAnalytics {
        return CountlyAnalytics.internalInstance;
    }

    public get disabled() {
        return !this.baseUrl;
    }

    public canEnable() {
        const config = SdkConfig.get();
        return Boolean(navigator.doNotTrack !== "1" && config?.countly?.url && config?.countly?.appKey);
    }

    private async changeUserKey(userKey: string, merge = false) {
        const oldUserKey = this.userKey;
        this.userKey = userKey;
        if (oldUserKey && merge) {
            await this.request({ old_device_id: oldUserKey });
        }
    }

    public async enable(anonymous = true) {
        if (!this.disabled && this.anonymous === anonymous) return;
        if (!this.canEnable()) return;

        if (!this.disabled) {
            // flush request queue as our userKey is going to change, no need to await it
            this.request();
        }

        const config = SdkConfig.get();
        this.baseUrl = new URL("/i", config.countly.url);
        this.appKey = config.countly.appKey;

        this.anonymous = anonymous;
        if (anonymous) {
            await this.changeUserKey(randomString(64))
        } else {
            await this.changeUserKey(await hashHex(MatrixClientPeg.get().getUserId()), true);
        }

        const platform = PlatformPeg.get();
        this.appPlatform = platform.getHumanReadableName();
        try {
            this.appVersion = await platform.getAppVersion();
        } catch (e) {
            console.warn("Failed to get app version, using 'unknown'");
        }

        // start heartbeat
        this.heartbeatIntervalId = setInterval(this.heartbeat.bind(this), HEARTBEAT_INTERVAL);
        this.trackSessions();
        this.trackErrors();
    }

    public async disable() {
        if (this.disabled) return;
        await this.track("Opt-Out" );
        this.endSession();
        window.clearInterval(this.heartbeatIntervalId);
        window.clearTimeout(this.activityIntervalId)
        this.baseUrl = null;
        // remove listeners bound in trackSessions()
        window.removeEventListener("beforeunload", this.endSession);
        window.removeEventListener("unload", this.endSession);
        window.removeEventListener("visibilitychange", this.onVisibilityChange);
        window.removeEventListener("mousemove", this.onUserActivity);
        window.removeEventListener("click", this.onUserActivity);
        window.removeEventListener("keydown", this.onUserActivity);
        window.removeEventListener("scroll", this.onUserActivity);
    }

    public reportFeedback(rating: 1 | 2 | 3 | 4 | 5, comment: string) {
        this.track<IStarRatingEvent>("[CLY]_star_rating", { rating, comment }, null, {}, true);
    }

    public trackPageChange(generationTimeMs?: number) {
        if (this.disabled) return;
        // TODO use generationTimeMs
        this.trackPageView();
    }

    private async trackPageView() {
        this.reportViewDuration();

        await sleep(0); // XXX: we sleep here because otherwise we get the old hash and not the new one
        const viewData = await getViewData(this.anonymous);

        const page = viewData.name;
        this.lastView = page;
        this.lastViewTime = CountlyAnalytics.getTimestamp();
        const segments = {
            ...viewData.meta,
            name: page,
            visit: 1,
            domain: window.location.hostname,
            view: viewData.url,
            segment: this.appPlatform,
            start: this.firstPage,
        };

        if (this.firstPage) {
            this.firstPage = false;
        }

        this.track<IViewEvent>("[CLY]_view", segments);
    }

    public static getTimestamp() {
        return Math.floor(new Date().getTime() / 1000);
    }

    // store the last ms timestamp returned
    // we do this to prevent the ts from ever decreasing in the case of system time changing
    private lastMsTs = 0;

    private getMsTimestamp() {
        const ts = new Date().getTime();
        if (this.lastMsTs >= ts) {
            // increment ts as to keep our data points well-ordered
            this.lastMsTs++;
        } else {
            this.lastMsTs = ts;
        }
        return this.lastMsTs;
    }

    public async recordError(err: Error | string, fatal = false) {
        if (this.disabled || this.anonymous) return;

        let error = "";
        if (typeof err === "object") {
            if (typeof err.stack !== "undefined") {
                error = err.stack;
            } else {
                if (typeof err.name !== "undefined") {
                    error += err.name + ":";
                }
                if (typeof err.message !== "undefined") {
                    error += err.message + "\n";
                }
                if (typeof err.fileName !== "undefined") {
                    error += "in " + err.fileName + "\n";
                }
                if (typeof err.lineNumber !== "undefined") {
                    error += "on " + err.lineNumber;
                }
                if (typeof err.columnNumber !== "undefined") {
                    error += ":" + err.columnNumber;
                }
            }
        } else {
            error = err + "";
        }

        // sanitize the error from identifiers
        error = await strReplaceAsync(error, /([!@+#]).+?:[\w:.]+/g, async (substring: string, glyph: string) => {
            return glyph + await hashHex(substring.substring(1));
        });

        const metrics = this.getMetrics();
        const ob: ICrash = {
            _resolution: metrics?._resolution,
            _error: error,
            _app_version: this.appVersion,
            _run: CountlyAnalytics.getTimestamp() - this.initTime,
            _nonfatal: !fatal,
            _view: this.lastView,
        };

        if (typeof navigator.onLine !== "undefined") {
            ob._online = navigator.onLine;
        }

        ob._background = document.hasFocus();

        this.request({ crash: JSON.stringify(ob) });
    }

    private trackErrors() {
        //override global uncaught error handler
        window.onerror = (msg, url, line, col, err) => {
            if (typeof err !== "undefined") {
                this.recordError(err, false);
            } else {
                let error = "";
                if (typeof msg !== "undefined") {
                    error += msg + "\n";
                }
                if (typeof url !== "undefined") {
                    error += "at " + url;
                }
                if (typeof line !== "undefined") {
                    error += ":" + line;
                }
                if (typeof col !== "undefined") {
                    error += ":" + col;
                }
                error += "\n";

                try {
                    const stack = [];
                    // eslint-disable-next-line no-caller
                    let f = arguments.callee.caller;
                    while (f) {
                        stack.push(f.name);
                        f = f.caller;
                    }
                    error += stack.join("\n");
                } catch (ex) {
                    //silent error
                }
                this.recordError(error, false);
            }
        };

        window.addEventListener('unhandledrejection', (event) => {
            this.recordError(new Error(`Unhandled rejection (reason: ${event.reason?.stack || event.reason}).`), true);
        });
    }

    private heartbeat() {
        const args: Pick<IParams, "session_duration"> = {};

        // extend session if needed
        if (this.sessionStarted && this.trackTime) {
            const last = CountlyAnalytics.getTimestamp();
            if (last - this.lastBeat >= SESSION_UPDATE_INTERVAL) {
                args.session_duration = last - this.lastBeat;
                this.lastBeat = last;
            }
        }

        // process event queue
        if (this.pendingEvents.length > 0 || args.session_duration) {
            this.request(args);
        }
    }

    private async request(
        args: Omit<IParams, "app_key" | "device_id" | "timestamp" | "hour" | "dow">
            & Partial<Pick<IParams, "device_id">> = {},
    ) {
        const request: IParams = {
            app_key: this.appKey,
            device_id: this.userKey,
            ...this.getTimeParams(),
            ...args,
        };

        if (this.pendingEvents.length > 0) {
            const EVENT_BATCH_SIZE = 10;
            const events = this.pendingEvents.splice(0, EVENT_BATCH_SIZE);
            request.events = JSON.stringify(events);
        }

        const params = new URLSearchParams(request as {});

        try {
            await window.fetch(this.baseUrl.toString(), {
                method: "POST",
                mode: "no-cors",
                cache: "no-cache",
                redirect: "follow",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: params,
            });
        } catch (e) {
            console.error("Analytics error: ", e);
        }
    }

    private getTimeParams(): Pick<IParams, "timestamp" | "hour" | "dow"> {
        const date = new Date();
        return {
            timestamp: this.getMsTimestamp(),
            hour: date.getHours(),
            dow: date.getDay(),
        };
    }

    private queue(args: Omit<IEvent, "timestamp" | "hour" | "dow" | "count"> & Partial<Pick<IEvent, "count">>) {
        const {count = 1, ...rest} = args;
        const ev = {
            ...this.getTimeParams(),
            ...rest,
            count,
            platform: this.appPlatform,
            app_version: this.appVersion,
        }

        this.pendingEvents.push(ev);
        if (this.pendingEvents.length > MAX_PENDING_EVENTS) {
            this.pendingEvents.shift();
        }
    }

    private getOrientation = (): Orientation => {
        return window.innerWidth > window.innerHeight ? Orientation.Landscape : Orientation.Portrait;
    };

    private reportOrientation = () => {
        this.track<IOrientationEvent>("[CLY]_orientation", {
            mode: this.getOrientation(),
        });
    };

    private startTime() {
        if (!this.trackTime) {
            this.trackTime = true;
            this.lastBeat = CountlyAnalytics.getTimestamp() - this.storedDuration;
            this.lastViewTime = CountlyAnalytics.getTimestamp() - this.lastViewStoredDuration;
            this.lastViewStoredDuration = 0;
        }
    }

    private stopTime() {
        if (this.trackTime) {
            this.trackTime = false;
            this.storedDuration = CountlyAnalytics.getTimestamp() - this.lastBeat;
            this.lastViewStoredDuration = CountlyAnalytics.getTimestamp() - this.lastViewTime;
        }
    }

    private getMetrics(): IMetrics {
        if (this.anonymous) return undefined;
        const metrics: IMetrics = {};

        // getting app version
        metrics._app_version = this.appVersion;
        metrics._ua = navigator.userAgent;

        // getting resolution
        if (screen.width && screen.height) {
            metrics._resolution = `${screen.width}x${screen.height}`;
        }

        // getting density ratio
        if (window.devicePixelRatio) {
            metrics._density = window.devicePixelRatio;
        }

        // getting locale
        metrics._locale = getCurrentLanguage();

        return metrics;
    }

    private async beginSession(heartbeat = true) {
        if (!this.sessionStarted) {
            this.reportOrientation();
            window.addEventListener("resize", this.reportOrientation);

            this.lastBeat = CountlyAnalytics.getTimestamp();
            this.sessionStarted = true;
            this.heartbeatEnabled = heartbeat;

            const userDetails: IUserDetails = {
                custom: {
                    "home_server": MatrixClientPeg.get() && MatrixClientPeg.getHomeserverName(), // TODO hash?
                    "anonymous": this.anonymous,
                },
            };

            const request: Parameters<typeof CountlyAnalytics.prototype.request>[0] = {
                begin_session: 1,
                user_details: JSON.stringify(userDetails),
            }

            const metrics = this.getMetrics();
            if (metrics) {
                request.metrics = JSON.stringify(metrics);
            }

            await this.request(request);
        }
    }

    private reportViewDuration() {
        if (this.lastView) {
            this.track<IViewEvent>("[CLY]_view", {
                name: this.lastView,
            }, null, {
                dur: this.trackTime ? CountlyAnalytics.getTimestamp() - this.lastViewTime : this.lastViewStoredDuration,
            });
            this.lastView = null;
        }
    }

    private endSession = () => {
        if (this.sessionStarted) {
            window.removeEventListener("resize", this.reportOrientation)

            this.reportViewDuration();
            this.request({
                end_session: 1,
                session_duration: CountlyAnalytics.getTimestamp() - this.lastBeat,
            });
        }
        this.sessionStarted = false;
    };

    private onVisibilityChange = () => {
        if (document.hidden) {
            this.stopTime();
        } else {
            this.startTime();
        }
    };

    private onUserActivity = () => {
        if (this.inactivityCounter >= INACTIVITY_TIME) {
            this.startTime();
        }
        this.inactivityCounter = 0;
    };

    private trackSessions() {
        this.beginSession();
        this.startTime();

        window.addEventListener("beforeunload", this.endSession);
        window.addEventListener("unload", this.endSession);
        window.addEventListener("visibilitychange", this.onVisibilityChange);
        window.addEventListener("mousemove", this.onUserActivity);
        window.addEventListener("click", this.onUserActivity);
        window.addEventListener("keydown", this.onUserActivity);
        window.addEventListener("scroll", this.onUserActivity);

        this.activityIntervalId = setInterval(() => {
            this.inactivityCounter++;
            if (this.inactivityCounter >= INACTIVITY_TIME) {
                this.stopTime();
            }
        }, 60_000);
    }

    public trackBeginInvite(roomId: string) {
        this.track<IBeginInviteEvent>("begin_invite", {}, roomId);
    }

    public trackSendInvite(startTime: number, roomId: string, qty: number) {
        this.track<ISendInviteEvent>("send_invite", {}, roomId, {
            dur: CountlyAnalytics.getTimestamp() - startTime,
            sum: qty,
        });
    }

    public async trackRoomCreate(startTime: number, roomId: string) {
        if (this.disabled) return;

        let endTime = CountlyAnalytics.getTimestamp();
        const cli = MatrixClientPeg.get();
        if (!cli.getRoom(roomId)) {
            await new Promise<void>(resolve => {
                const handler = (room) => {
                    if (room.roomId === roomId) {
                        cli.off("Room", handler);
                        resolve();
                    }
                };
                cli.on("Room", handler);
            });
            endTime = CountlyAnalytics.getTimestamp();
        }

        this.track<ICreateRoomEvent>("create_room", {}, roomId, {
            dur: endTime - startTime,
        });
    }

    public trackRoomJoin(startTime: number, roomId: string, type: IJoinRoomEvent["segmentation"]["type"]) {
        this.track<IJoinRoomEvent>("join_room", { type }, roomId, {
            dur: CountlyAnalytics.getTimestamp() - startTime,
        });
    }

    public async trackSendMessage(
        startTime: number,
        // eslint-disable-next-line camelcase
        sendPromise: Promise<{event_id: string}>,
        roomId: string,
        isEdit: boolean,
        isReply: boolean,
        content: {format?: string, msgtype: string},
    ) {
        if (this.disabled) return;
        const cli = MatrixClientPeg.get();
        const room = cli.getRoom(roomId);

        const eventId = (await sendPromise).event_id;
        let endTime = CountlyAnalytics.getTimestamp();

        if (!room.findEventById(eventId)) {
            await new Promise<void>(resolve => {
                const handler = (ev) => {
                    if (ev.getId() === eventId) {
                        room.off("Room.localEchoUpdated", handler);
                        resolve();
                    }
                };

                room.on("Room.localEchoUpdated", handler);
            });
            endTime = CountlyAnalytics.getTimestamp();
        }

        this.track<ISendMessageEvent>("send_message", {
            is_edit: isEdit,
            is_reply: isReply,
            msgtype: content.msgtype,
            format: content.format,
        }, roomId, {
            dur: endTime - startTime,
        });
    }

    public trackStartCall(roomId: string, isVideo = false, isJitsi = false) {
        this.track<IStartCallEvent>("start_call", {
            is_video: isVideo,
            is_jitsi: isJitsi,
        }, roomId);
    }

    public trackJoinCall(roomId: string, isVideo = false, isJitsi = false) {
        this.track<IJoinCallEvent>("join_call", {
            is_video: isVideo,
            is_jitsi: isJitsi,
        }, roomId);
    }

    public trackRoomDirectoryBegin() {
        this.track<IRoomDirectoryEvent>("room_directory");
    }

    public trackRoomDirectory(startTime: number) {
        this.track<IRoomDirectoryDoneEvent>("room_directory_done", {}, null, {
            dur: CountlyAnalytics.getTimestamp() - startTime,
        });
    }

    public trackRoomDirectorySearch(numResults: number, query: string) {
        this.track<IRoomDirectorySearchEvent>("room_directory_search", {
            query_length: query.length,
            query_num_words: query.split(" ").length,
        }, null, {
            sum: numResults,
        });
    }

    public async track<E extends IEvent>(
        key: E["key"],
        segments?: Omit<E["segmentation"], "room_id" | "num_users" | "is_encrypted" | "is_public">,
        roomId?: string,
        args?: Partial<Pick<E, "dur" | "sum" | "timestamp">>,
        anonymous = false,
    ) {
        if (this.disabled && !anonymous) return;

        let segmentation = segments || {};

        if (roomId) {
            segmentation = {
                room_id: await hashHex(roomId),
                ...getRoomStats(roomId),
                ...segments,
            };
        }

        this.queue({
            key,
            count: 1,
            segmentation,
            ...args,
        });

        // if this event can be sent anonymously and we are disabled then dispatch it right away
        if (this.disabled && anonymous) {
            await this.request({ device_id: randomString(64) });
        }
    }
}

// expose on window for easy access from the console
window.mxCountlyAnalytics = CountlyAnalytics;
