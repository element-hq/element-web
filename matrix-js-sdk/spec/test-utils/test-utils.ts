// eslint-disable-next-line no-restricted-imports
import EventEmitter from "events";

// load olm before the sdk if possible
import "../olm-loader";

import { logger } from "../../src/logger";
import { IContent, IEvent, IEventRelation, IUnsigned, MatrixEvent, MatrixEventEvent } from "../../src/models/event";
import { ClientEvent, EventType, IPusher, MatrixClient, MsgType, RelationType } from "../../src";
import { SyncState } from "../../src/sync";
import { eventMapperFor } from "../../src/event-mapper";

/**
 * Return a promise that is resolved when the client next emits a
 * SYNCING event.
 * @param client - The client
 * @param count - Number of syncs to wait for (default 1)
 * @returns Promise which resolves once the client has emitted a SYNCING event
 */
export function syncPromise(client: MatrixClient, count = 1): Promise<void> {
    if (count <= 0) {
        return Promise.resolve();
    }

    const p = new Promise<void>((resolve) => {
        const cb = (state: SyncState) => {
            logger.log(`${Date.now()} syncPromise(${count}): ${state}`);
            if (state === SyncState.Syncing) {
                resolve();
            } else {
                client.once(ClientEvent.Sync, cb);
            }
        };
        client.once(ClientEvent.Sync, cb);
    });

    return p.then(() => {
        return syncPromise(client, count - 1);
    });
}

/**
 * Create a spy for an object and automatically spy its methods.
 * @param constr - The class constructor (used with 'new')
 * @param name - The name of the class
 * @returns An instantiated object with spied methods/properties.
 */
export function mock<T>(constr: { new (...args: any[]): T }, name: string): T {
    // Based on http://eclipsesource.com/blogs/2014/03/27/mocks-in-jasmine-tests/
    const HelperConstr = new Function(); // jshint ignore:line
    HelperConstr.prototype = constr.prototype;
    // @ts-ignore
    const result = new HelperConstr();
    result.toString = function () {
        return "mock" + (name ? " of " + name : "");
    };
    for (const key of Object.getOwnPropertyNames(constr.prototype)) {
        // eslint-disable-line guard-for-in
        try {
            if (constr.prototype[key] instanceof Function) {
                result[key] = jest.fn();
            }
        } catch (ex) {
            // Direct access to some non-function fields of DOM prototypes may
            // cause exceptions.
            // Overwriting will not work either in that case.
        }
    }
    return result;
}

interface IEventOpts {
    type: EventType | string;
    room?: string;
    sender?: string;
    skey?: string;
    content: IContent;
    prev_content?: IContent;
    user?: string;
    unsigned?: IUnsigned;
    redacts?: string;
    ts?: number;
}

let testEventIndex = 1; // counter for events, easier for comparison of randomly generated events
/**
 * Create an Event.
 * @param opts - Values for the event.
 * @param opts.type - The event.type
 * @param opts.room - The event.room_id
 * @param opts.sender - The event.sender
 * @param opts.skey - Optional. The state key (auto inserts empty string)
 * @param opts.content - The event.content
 * @param opts.event - True to make a MatrixEvent.
 * @param client - If passed along with opts.event=true will be used to set up re-emitters.
 * @returns a JSON object representing this event.
 */
export function mkEvent(opts: IEventOpts & { event: true }, client?: MatrixClient): MatrixEvent;
export function mkEvent(opts: IEventOpts & { event?: false }, client?: MatrixClient): Partial<IEvent>;
export function mkEvent(opts: IEventOpts & { event?: boolean }, client?: MatrixClient): Partial<IEvent> | MatrixEvent {
    if (!opts.type || !opts.content) {
        throw new Error("Missing .type or .content =>" + JSON.stringify(opts));
    }
    const event: Partial<IEvent> = {
        type: opts.type as string,
        room_id: opts.room,
        sender: opts.sender || opts.user, // opts.user for backwards-compat
        content: opts.content,
        prev_content: opts.prev_content,
        unsigned: opts.unsigned || {},
        event_id: "$" + testEventIndex++ + "-" + Math.random() + "-" + Math.random(),
        txn_id: "~" + Math.random(),
        redacts: opts.redacts,
        origin_server_ts: opts.ts ?? 0,
    };
    if (opts.skey !== undefined) {
        event.state_key = opts.skey;
    } else if (
        [
            EventType.RoomName,
            EventType.RoomTopic,
            EventType.RoomCreate,
            EventType.RoomJoinRules,
            EventType.RoomPowerLevels,
            EventType.RoomTopic,
            "com.example.state",
        ].includes(opts.type)
    ) {
        event.state_key = "";
    }

    if (opts.event && client) {
        return eventMapperFor(client, {})(event);
    }

    return opts.event ? new MatrixEvent(event) : event;
}

type GeneratedMetadata = {
    event_id: string;
    txn_id: string;
    origin_server_ts: number;
};

export function mkEventCustom<T>(base: T): T & GeneratedMetadata {
    return {
        event_id: "$" + testEventIndex++ + "-" + Math.random() + "-" + Math.random(),
        txn_id: "~" + Math.random(),
        origin_server_ts: Date.now(),
        ...base,
    };
}

interface IPresenceOpts {
    user?: string;
    sender?: string;
    url?: string;
    name?: string;
    ago?: number;
    presence?: string;
    event?: boolean;
}

/**
 * Create an m.presence event.
 * @param opts - Values for the presence.
 * @returns The event
 */
export function mkPresence(opts: IPresenceOpts & { event: true }): MatrixEvent;
export function mkPresence(opts: IPresenceOpts & { event?: false }): Partial<IEvent>;
export function mkPresence(opts: IPresenceOpts & { event?: boolean }): Partial<IEvent> | MatrixEvent {
    const event = {
        event_id: "$" + Math.random() + "-" + Math.random(),
        type: "m.presence",
        sender: opts.sender || opts.user, // opts.user for backwards-compat
        content: {
            avatar_url: opts.url,
            displayname: opts.name,
            last_active_ago: opts.ago,
            presence: opts.presence || "offline",
        },
    };
    return opts.event ? new MatrixEvent(event) : event;
}

interface IMembershipOpts {
    room?: string;
    mship: string;
    sender?: string;
    user?: string;
    skey?: string;
    name?: string;
    url?: string;
    event?: boolean;
}

/**
 * Create an m.room.member event.
 * @param opts - Values for the membership.
 * @param opts.room - The room ID for the event.
 * @param opts.mship - The content.membership for the event.
 * @param opts.sender - The sender user ID for the event.
 * @param opts.skey - The target user ID for the event if applicable
 * e.g. for invites/bans.
 * @param opts.name - The content.displayname for the event.
 * @param opts.url - The content.avatar_url for the event.
 * @param opts.event - True to make a MatrixEvent.
 * @returns The event
 */
export function mkMembership(opts: IMembershipOpts & { event: true }): MatrixEvent;
export function mkMembership(opts: IMembershipOpts & { event?: false }): Partial<IEvent>;
export function mkMembership(opts: IMembershipOpts & { event?: boolean }): Partial<IEvent> | MatrixEvent {
    const eventOpts: IEventOpts = {
        ...opts,
        type: EventType.RoomMember,
        content: {
            membership: opts.mship,
        },
    };

    if (!opts.skey) {
        eventOpts.skey = opts.sender || opts.user;
    }
    if (opts.name) {
        eventOpts.content.displayname = opts.name;
    }
    if (opts.url) {
        eventOpts.content.avatar_url = opts.url;
    }
    return mkEvent(eventOpts);
}

export function mkMembershipCustom<T>(
    base: T & { membership: string; sender: string; content?: IContent },
): T & { type: EventType; sender: string; state_key: string; content: IContent } & GeneratedMetadata {
    const content = base.content || {};
    return mkEventCustom({
        ...base,
        content: { ...content, membership: base.membership },
        type: EventType.RoomMember,
        state_key: base.sender,
    });
}

export interface IMessageOpts {
    room?: string;
    user: string;
    msg?: string;
    event?: boolean;
    relatesTo?: IEventRelation;
    ts?: number;
}

/**
 * Create an m.room.message event.
 * @param opts - Values for the message
 * @param opts.room - The room ID for the event.
 * @param opts.user - The user ID for the event.
 * @param opts.msg - Optional. The content.body for the event.
 * @param opts.event - True to make a MatrixEvent.
 * @param opts.relatesTo - An IEventRelation relating this to another event.
 * @param opts.ts - The timestamp of the event.
 * @param opts.event - True to make a MatrixEvent.
 * @param client - If passed along with opts.event=true will be used to set up re-emitters.
 * @returns The event
 */
export function mkMessage(opts: IMessageOpts & { event: true }, client?: MatrixClient): MatrixEvent;
export function mkMessage(opts: IMessageOpts & { event?: false }, client?: MatrixClient): Partial<IEvent>;
export function mkMessage(
    opts: IMessageOpts & { event?: boolean },
    client?: MatrixClient,
): Partial<IEvent> | MatrixEvent {
    const eventOpts: IEventOpts = {
        ...opts,
        type: EventType.RoomMessage,
        content: {
            msgtype: MsgType.Text,
            body: opts.msg,
        },
    };

    if (opts.relatesTo) {
        eventOpts.content["m.relates_to"] = opts.relatesTo;
    }

    if (!eventOpts.content.body) {
        eventOpts.content.body = "Random->" + Math.random();
    }
    return mkEvent(eventOpts, client);
}

interface IReplyMessageOpts extends IMessageOpts {
    replyToMessage: MatrixEvent;
}

/**
 * Create a reply message.
 *
 * @param opts - Values for the message
 * @param opts.room - The room ID for the event.
 * @param opts.user - The user ID for the event.
 * @param opts.msg - Optional. The content.body for the event.
 * @param opts.ts - The timestamp of the event.
 * @param opts.replyToMessage - The replied message
 * @param opts.event - True to make a MatrixEvent.
 * @param client - If passed along with opts.event=true will be used to set up re-emitters.
 * @returns The event
 */
export function mkReplyMessage(opts: IReplyMessageOpts & { event: true }, client?: MatrixClient): MatrixEvent;
export function mkReplyMessage(opts: IReplyMessageOpts & { event?: false }, client?: MatrixClient): Partial<IEvent>;
export function mkReplyMessage(
    opts: IReplyMessageOpts & { event?: boolean },
    client?: MatrixClient,
): Partial<IEvent> | MatrixEvent {
    const eventOpts: IEventOpts = {
        ...opts,
        type: EventType.RoomMessage,
        content: {
            "msgtype": MsgType.Text,
            "body": opts.msg,
            "m.relates_to": {
                "rel_type": "m.in_reply_to",
                "event_id": opts.replyToMessage.getId(),
                "m.in_reply_to": {
                    event_id: opts.replyToMessage.getId()!,
                },
            },
        },
    };

    if (!eventOpts.content.body) {
        eventOpts.content.body = "Random->" + Math.random();
    }
    return mkEvent(eventOpts, client);
}

/**
 * Create a reaction event.
 *
 * @param target - the event we are reacting to.
 * @param client - the MatrixClient
 * @param userId - the userId of the sender
 * @param roomId - the id of the room we are in
 * @param ts - The timestamp of the event.
 * @returns The event
 */
export function mkReaction(
    target: MatrixEvent,
    client: MatrixClient,
    userId: string,
    roomId: string,
    ts?: number,
): MatrixEvent {
    return mkEvent(
        {
            event: true,
            type: EventType.Reaction,
            user: userId,
            room: roomId,
            content: {
                "m.relates_to": {
                    rel_type: RelationType.Annotation,
                    event_id: target.getId()!,
                    key: Math.random().toString(),
                },
            },
            ts,
        },
        client,
    );
}

export function mkEdit(
    target: MatrixEvent,
    client: MatrixClient,
    userId: string,
    roomId: string,
    msg?: string,
    ts?: number,
) {
    msg = msg ?? `Edit of ${target.getId()}`;
    return mkEvent(
        {
            event: true,
            type: EventType.RoomMessage,
            user: userId,
            room: roomId,
            content: {
                "body": `* ${msg}`,
                "m.new_content": {
                    body: msg,
                },
                "m.relates_to": {
                    rel_type: RelationType.Replace,
                    event_id: target.getId()!,
                },
            },
            ts,
        },
        client,
    );
}

/**
 * A mock implementation of webstorage
 */
export class MockStorageApi implements Storage {
    private data: Record<string, any> = {};

    public get length() {
        return Object.keys(this.data).length;
    }

    public key(i: number): any {
        return Object.keys(this.data)[i];
    }

    public setItem(k: string, v: any): void {
        this.data[k] = v;
    }

    public getItem(k: string): any {
        return this.data[k] || null;
    }

    public removeItem(k: string): void {
        delete this.data[k];
    }

    public clear(): void {
        this.data = {};
    }
}

/**
 * If an event is being decrypted, wait for it to finish being decrypted.
 *
 * @returns promise which resolves (to `event`) when the event has been decrypted
 */
export async function awaitDecryption(
    event: MatrixEvent,
    { waitOnDecryptionFailure = false } = {},
): Promise<MatrixEvent> {
    // An event is not always decrypted ahead of time
    // getClearContent is a good signal to know whether an event has been decrypted
    // already
    if (event.getClearContent() !== null) {
        if (waitOnDecryptionFailure && event.isDecryptionFailure()) {
            logger.log(`${Date.now()}: event ${event.getId()} got decryption error; waiting`);
        } else {
            return event;
        }
    } else {
        logger.log(`${Date.now()}: event ${event.getId()} is not yet decrypted; waiting`);
    }

    return new Promise((resolve) => {
        event.once(MatrixEventEvent.Decrypted, (ev, err) => {
            logger.log(`${Date.now()}: MatrixEventEvent.Decrypted for event ${event.getId()}: ${err ?? "success"}`);
            resolve(ev);
        });
    });
}

export const emitPromise = (e: EventEmitter, k: string): Promise<any> => new Promise((r) => e.once(k, r));

export const mkPusher = (extra: Partial<IPusher> = {}): IPusher => ({
    app_display_name: "app",
    app_id: "123",
    data: {},
    device_display_name: "name",
    kind: "http",
    lang: "en",
    pushkey: "pushpush",
    ...extra,
});

/**
 * a list of the supported crypto implementations, each with a callback to initialise that implementation
 * for the given client
 */
export const CRYPTO_BACKENDS: Record<string, InitCrypto> = {};
export type InitCrypto = (_: MatrixClient) => Promise<void>;

CRYPTO_BACKENDS["rust-sdk"] = (client: MatrixClient) => client.initRustCrypto();
if (global.Olm) {
    CRYPTO_BACKENDS["libolm"] = (client: MatrixClient) => client.initCrypto();
}
