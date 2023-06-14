/*
Copyright 2015 - 2023 The Matrix.org Foundation C.I.C.

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

/**
 * This is an internal module. See {@link MatrixEvent} and {@link RoomEvent} for
 * the public classes.
 */

import { ExtensibleEvent, ExtensibleEvents, Optional } from "matrix-events-sdk";

import type { IEventDecryptionResult } from "../@types/crypto";
import { logger } from "../logger";
import { VerificationRequest } from "../crypto/verification/request/VerificationRequest";
import {
    EVENT_VISIBILITY_CHANGE_TYPE,
    EventType,
    MsgType,
    RelationType,
    UNSIGNED_THREAD_ID_FIELD,
} from "../@types/event";
import { Crypto } from "../crypto";
import { deepSortedObjectEntries, internaliseString } from "../utils";
import { RoomMember } from "./room-member";
import { Thread, ThreadEvent, ThreadEventHandlerMap, THREAD_RELATION_TYPE } from "./thread";
import { IActionsObject } from "../pushprocessor";
import { TypedReEmitter } from "../ReEmitter";
import { MatrixError } from "../http-api";
import { TypedEventEmitter } from "./typed-event-emitter";
import { EventStatus } from "./event-status";
import { DecryptionError } from "../crypto/algorithms";
import { CryptoBackend } from "../common-crypto/CryptoBackend";
import { WITHHELD_MESSAGES } from "../crypto/OlmDevice";
import { IAnnotatedPushRule } from "../@types/PushRules";

export { EventStatus } from "./event-status";

/* eslint-disable camelcase */
export interface IContent {
    [key: string]: any;
    "msgtype"?: MsgType | string;
    "membership"?: string;
    "avatar_url"?: string;
    "displayname"?: string;
    "m.relates_to"?: IEventRelation;

    "org.matrix.msc3952.mentions"?: IMentions;
}

type StrippedState = Required<Pick<IEvent, "content" | "state_key" | "type" | "sender">>;

export interface IUnsigned {
    "age"?: number;
    "prev_sender"?: string;
    "prev_content"?: IContent;
    "redacted_because"?: IEvent;
    "transaction_id"?: string;
    "invite_room_state"?: StrippedState[];
    "m.relations"?: Record<RelationType | string, any>; // No common pattern for aggregated relations
    [UNSIGNED_THREAD_ID_FIELD.name]?: string;
}

export interface IThreadBundledRelationship {
    latest_event: IEvent;
    count: number;
    current_user_participated?: boolean;
}

export interface IEvent {
    event_id: string;
    type: string;
    content: IContent;
    sender: string;
    room_id?: string;
    origin_server_ts: number;
    txn_id?: string;
    state_key?: string;
    membership?: string;
    unsigned: IUnsigned;
    redacts?: string;

    /**
     * @deprecated in favour of `sender`
     */
    user_id?: string;
    /**
     * @deprecated in favour of `unsigned.prev_content`
     */
    prev_content?: IContent;
    /**
     * @deprecated in favour of `origin_server_ts`
     */
    age?: number;
}

export interface IAggregatedRelation {
    origin_server_ts: number;
    event_id?: string;
    sender?: string;
    type?: string;
    count?: number;
    key?: string;
}

export interface IEventRelation {
    "rel_type"?: RelationType | string;
    "event_id"?: string;
    "is_falling_back"?: boolean;
    "m.in_reply_to"?: {
        event_id?: string;
    };
    "key"?: string;
}

export interface IMentions {
    user_ids?: string[];
    room?: boolean;
}

export interface PushDetails {
    rule?: IAnnotatedPushRule;
    actions?: IActionsObject;
}

/**
 * When an event is a visibility change event, as per MSC3531,
 * the visibility change implied by the event.
 */
export interface IVisibilityChange {
    /**
     * If `true`, the target event should be made visible.
     * Otherwise, it should be hidden.
     */
    visible: boolean;

    /**
     * The event id affected.
     */
    eventId: string;

    /**
     * Optionally, a human-readable reason explaining why
     * the event was hidden. Ignored if the event was made
     * visible.
     */
    reason: string | null;
}

export interface IClearEvent {
    room_id?: string;
    type: string;
    content: Omit<IContent, "membership" | "avatar_url" | "displayname" | "m.relates_to">;
    unsigned?: IUnsigned;
}
/* eslint-enable camelcase */

interface IKeyRequestRecipient {
    userId: string;
    deviceId: "*" | string;
}

export interface IDecryptOptions {
    // Emits "event.decrypted" if set to true
    emit?: boolean;
    // True if this is a retry (enables more logging)
    isRetry?: boolean;
    // whether the message should be re-decrypted if it was previously successfully decrypted with an untrusted key
    forceRedecryptIfUntrusted?: boolean;
}

/**
 * Message hiding, as specified by https://github.com/matrix-org/matrix-doc/pull/3531.
 */
export type MessageVisibility = IMessageVisibilityHidden | IMessageVisibilityVisible;
/**
 * Variant of `MessageVisibility` for the case in which the message should be displayed.
 */
export interface IMessageVisibilityVisible {
    readonly visible: true;
}
/**
 * Variant of `MessageVisibility` for the case in which the message should be hidden.
 */
export interface IMessageVisibilityHidden {
    readonly visible: false;
    /**
     * Optionally, a human-readable reason to show to the user indicating why the
     * message has been hidden (e.g. "Message Pending Moderation").
     */
    readonly reason: string | null;
}
// A singleton implementing `IMessageVisibilityVisible`.
const MESSAGE_VISIBLE: IMessageVisibilityVisible = Object.freeze({ visible: true });

export enum MatrixEventEvent {
    Decrypted = "Event.decrypted",
    BeforeRedaction = "Event.beforeRedaction",
    VisibilityChange = "Event.visibilityChange",
    LocalEventIdReplaced = "Event.localEventIdReplaced",
    Status = "Event.status",
    Replaced = "Event.replaced",
    RelationsCreated = "Event.relationsCreated",
}

export type MatrixEventEmittedEvents = MatrixEventEvent | ThreadEvent.Update;

export type MatrixEventHandlerMap = {
    /**
     * Fires when an event is decrypted
     *
     * @param event - The matrix event which has been decrypted
     * @param err - The error that occurred during decryption, or `undefined` if no error occurred.
     */
    [MatrixEventEvent.Decrypted]: (event: MatrixEvent, err?: Error) => void;
    [MatrixEventEvent.BeforeRedaction]: (event: MatrixEvent, redactionEvent: MatrixEvent) => void;
    [MatrixEventEvent.VisibilityChange]: (event: MatrixEvent, visible: boolean) => void;
    [MatrixEventEvent.LocalEventIdReplaced]: (event: MatrixEvent) => void;
    [MatrixEventEvent.Status]: (event: MatrixEvent, status: EventStatus | null) => void;
    [MatrixEventEvent.Replaced]: (event: MatrixEvent) => void;
    [MatrixEventEvent.RelationsCreated]: (relationType: string, eventType: string) => void;
} & Pick<ThreadEventHandlerMap, ThreadEvent.Update>;

export class MatrixEvent extends TypedEventEmitter<MatrixEventEmittedEvents, MatrixEventHandlerMap> {
    // applied push rule and action for this event
    private pushDetails: PushDetails = {};
    private _replacingEvent: MatrixEvent | null = null;
    private _localRedactionEvent: MatrixEvent | null = null;
    private _isCancelled = false;
    private clearEvent?: IClearEvent;

    /* Message hiding, as specified by https://github.com/matrix-org/matrix-doc/pull/3531.

    Note: We're returning this object, so any value stored here MUST be frozen.
    */
    private visibility: MessageVisibility = MESSAGE_VISIBLE;

    // Not all events will be extensible-event compatible, so cache a flag in
    // addition to a falsy cached event value. We check the flag later on in
    // a public getter to decide if the cache is valid.
    private _hasCachedExtEv = false;
    private _cachedExtEv: Optional<ExtensibleEvent> = undefined;

    /* curve25519 key which we believe belongs to the sender of the event. See
     * getSenderKey()
     */
    private senderCurve25519Key: string | null = null;

    /* ed25519 key which the sender of this event (for olm) or the creator of
     * the megolm session (for megolm) claims to own. See getClaimedEd25519Key()
     */
    private claimedEd25519Key: string | null = null;

    /* curve25519 keys of devices involved in telling us about the
     * senderCurve25519Key and claimedEd25519Key.
     * See getForwardingCurve25519KeyChain().
     */
    private forwardingCurve25519KeyChain: string[] = [];

    /* where the decryption key is untrusted
     */
    private untrusted: boolean | null = null;

    /* if we have a process decrypting this event, a Promise which resolves
     * when it is finished. Normally null.
     */
    private decryptionPromise: Promise<void> | null = null;

    /* flag to indicate if we should retry decrypting this event after the
     * first attempt (eg, we have received new data which means that a second
     * attempt may succeed)
     */
    private retryDecryption = false;

    /* The txnId with which this event was sent if it was during this session,
     * allows for a unique ID which does not change when the event comes back down sync.
     */
    private txnId?: string;

    /**
     * A reference to the thread this event belongs to
     */
    private thread?: Thread;
    private threadId?: string;

    /*
     * True if this event is an encrypted event which we failed to decrypt, the receiver's device is unverified and
     * the sender has disabled encrypting to unverified devices.
     */
    private encryptedDisabledForUnverifiedDevices = false;

    /* Set an approximate timestamp for the event relative the local clock.
     * This will inherently be approximate because it doesn't take into account
     * the time between the server putting the 'age' field on the event as it sent
     * it to us and the time we're now constructing this event, but that's better
     * than assuming the local clock is in sync with the origin HS's clock.
     */
    public localTimestamp: number;

    /**
     * The room member who sent this event, or null e.g.
     * this is a presence event. This is only guaranteed to be set for events that
     * appear in a timeline, ie. do not guarantee that it will be set on state
     * events.
     * @privateRemarks
     * Should be read-only
     */
    public sender: RoomMember | null = null;
    /**
     * The room member who is the target of this event, e.g.
     * the invitee, the person being banned, etc.
     * @privateRemarks
     * Should be read-only
     */
    public target: RoomMember | null = null;
    /**
     * The sending status of the event.
     * @privateRemarks
     * Should be read-only
     */
    public status: EventStatus | null = null;
    /**
     * most recent error associated with sending the event, if any
     * @privateRemarks
     * Should be read-only
     */
    public error: MatrixError | null = null;
    /**
     * True if this event is 'forward looking', meaning
     * that getDirectionalContent() will return event.content and not event.prev_content.
     * Only state events may be backwards looking
     * Default: true. <strong>This property is experimental and may change.</strong>
     * @privateRemarks
     * Should be read-only
     */
    public forwardLooking = true;

    /* If the event is a `m.key.verification.request` (or to_device `m.key.verification.start`) event,
     * `Crypto` will set this the `VerificationRequest` for the event
     * so it can be easily accessed from the timeline.
     */
    public verificationRequest?: VerificationRequest;

    private readonly reEmitter: TypedReEmitter<MatrixEventEmittedEvents, MatrixEventHandlerMap>;

    /**
     * Construct a Matrix Event object
     *
     * @param event - The raw (possibly encrypted) event. <b>Do not access
     * this property</b> directly unless you absolutely have to. Prefer the getter
     * methods defined on this class. Using the getter methods shields your app
     * from changes to event JSON between Matrix versions.
     */
    public constructor(public event: Partial<IEvent> = {}) {
        super();

        // intern the values of matrix events to force share strings and reduce the
        // amount of needless string duplication. This can save moderate amounts of
        // memory (~10% on a 350MB heap).
        // 'membership' at the event level (rather than the content level) is a legacy
        // field that Element never otherwise looks at, but it will still take up a lot
        // of space if we don't intern it.
        (["state_key", "type", "sender", "room_id", "membership"] as const).forEach((prop) => {
            if (typeof event[prop] !== "string") return;
            event[prop] = internaliseString(event[prop]!);
        });

        (["membership", "avatar_url", "displayname"] as const).forEach((prop) => {
            if (typeof event.content?.[prop] !== "string") return;
            event.content[prop] = internaliseString(event.content[prop]!);
        });

        (["rel_type"] as const).forEach((prop) => {
            if (typeof event.content?.["m.relates_to"]?.[prop] !== "string") return;
            event.content["m.relates_to"][prop] = internaliseString(event.content["m.relates_to"][prop]!);
        });

        this.txnId = event.txn_id;
        this.localTimestamp = Date.now() - (this.getAge() ?? 0);
        this.reEmitter = new TypedReEmitter(this);
    }

    /**
     * Unstable getter to try and get an extensible event. Note that this might
     * return a falsy value if the event could not be parsed as an extensible
     * event.
     *
     * @deprecated Use stable functions where possible.
     */
    public get unstableExtensibleEvent(): Optional<ExtensibleEvent> {
        if (!this._hasCachedExtEv) {
            this._cachedExtEv = ExtensibleEvents.parse(this.getEffectiveEvent());
        }
        return this._cachedExtEv;
    }

    private invalidateExtensibleEvent(): void {
        // just reset the flag - that'll trick the getter into parsing a new event
        this._hasCachedExtEv = false;
    }

    /**
     * Gets the event as though it would appear unencrypted. If the event is already not
     * encrypted, it is simply returned as-is.
     * @returns The event in wire format.
     */
    public getEffectiveEvent(): IEvent {
        const content = Object.assign({}, this.getContent()); // clone for mutation

        if (this.getWireType() === EventType.RoomMessageEncrypted) {
            // Encrypted events sometimes aren't symmetrical on the `content` so we'll copy
            // that over too, but only for missing properties. We don't copy over mismatches
            // between the plain and decrypted copies of `content` because we assume that the
            // app is relying on the decrypted version, so we want to expose that as a source
            // of truth here too.
            for (const [key, value] of Object.entries(this.getWireContent())) {
                // Skip fields from the encrypted event schema though - we don't want to leak
                // these.
                if (["algorithm", "ciphertext", "device_id", "sender_key", "session_id"].includes(key)) {
                    continue;
                }

                if (content[key] === undefined) content[key] = value;
            }
        }

        // clearEvent doesn't have all the fields, so we'll copy what we can from this.event.
        // We also copy over our "fixed" content key.
        return Object.assign({}, this.event, this.clearEvent, { content }) as IEvent;
    }

    /**
     * Get the event_id for this event.
     * @returns The event ID, e.g. <code>$143350589368169JsLZx:localhost
     * </code>
     */
    public getId(): string | undefined {
        return this.event.event_id;
    }

    /**
     * Get the user_id for this event.
     * @returns The user ID, e.g. `@alice:matrix.org`
     */
    public getSender(): string | undefined {
        return this.event.sender || this.event.user_id; // v2 / v1
    }

    /**
     * Get the (decrypted, if necessary) type of event.
     *
     * @returns The event type, e.g. `m.room.message`
     */
    public getType(): EventType | string {
        if (this.clearEvent) {
            return this.clearEvent.type;
        }
        return this.event.type!;
    }

    /**
     * Get the (possibly encrypted) type of the event that will be sent to the
     * homeserver.
     *
     * @returns The event type.
     */
    public getWireType(): EventType | string {
        return this.event.type!;
    }

    /**
     * Get the room_id for this event. This will return `undefined`
     * for `m.presence` events.
     * @returns The room ID, e.g. <code>!cURbafjkfsMDVwdRDQ:matrix.org
     * </code>
     */
    public getRoomId(): string | undefined {
        return this.event.room_id;
    }

    /**
     * Get the timestamp of this event.
     * @returns The event timestamp, e.g. `1433502692297`
     */
    public getTs(): number {
        return this.event.origin_server_ts!;
    }

    /**
     * Get the timestamp of this event, as a Date object.
     * @returns The event date, e.g. `new Date(1433502692297)`
     */
    public getDate(): Date | null {
        return this.event.origin_server_ts ? new Date(this.event.origin_server_ts) : null;
    }

    /**
     * Get a string containing details of this event
     *
     * This is intended for logging, to help trace errors. Example output:
     *
     * @example
     * ```
     * id=$HjnOHV646n0SjLDAqFrgIjim7RCpB7cdMXFrekWYAn type=m.room.encrypted
     * sender=@user:example.com room=!room:example.com ts=2022-10-25T17:30:28.404Z
     * ```
     */
    public getDetails(): string {
        let details = `id=${this.getId()} type=${this.getWireType()} sender=${this.getSender()}`;
        const room = this.getRoomId();
        if (room) {
            details += ` room=${room}`;
        }
        const date = this.getDate();
        if (date) {
            details += ` ts=${date.toISOString()}`;
        }
        return details;
    }

    /**
     * Get the (decrypted, if necessary) event content JSON, even if the event
     * was replaced by another event.
     *
     * @returns The event content JSON, or an empty object.
     */
    public getOriginalContent<T = IContent>(): T {
        if (this._localRedactionEvent) {
            return {} as T;
        }
        if (this.clearEvent) {
            return (this.clearEvent.content || {}) as T;
        }
        return (this.event.content || {}) as T;
    }

    /**
     * Get the (decrypted, if necessary) event content JSON,
     * or the content from the replacing event, if any.
     * See `makeReplaced`.
     *
     * @returns The event content JSON, or an empty object.
     */
    public getContent<T extends IContent = IContent>(): T {
        if (this._localRedactionEvent) {
            return {} as T;
        } else if (this._replacingEvent) {
            return this._replacingEvent.getContent()["m.new_content"] || {};
        } else {
            return this.getOriginalContent();
        }
    }

    /**
     * Get the (possibly encrypted) event content JSON that will be sent to the
     * homeserver.
     *
     * @returns The event content JSON, or an empty object.
     */
    public getWireContent(): IContent {
        return this.event.content || {};
    }

    /**
     * Get the event ID of the thread head
     */
    public get threadRootId(): string | undefined {
        const relatesTo = this.getWireContent()?.["m.relates_to"];
        if (relatesTo?.rel_type === THREAD_RELATION_TYPE.name) {
            return relatesTo.event_id;
        }
        if (this.thread) {
            return this.thread.id;
        }
        if (this.threadId !== undefined) {
            return this.threadId;
        }
        const unsigned = this.getUnsigned();
        if (typeof unsigned[UNSIGNED_THREAD_ID_FIELD.name] === "string") {
            return unsigned[UNSIGNED_THREAD_ID_FIELD.name];
        }
        return undefined;
    }

    /**
     * A helper to check if an event is a thread's head or not
     */
    public get isThreadRoot(): boolean {
        const threadDetails = this.getServerAggregatedRelation<IThreadBundledRelationship>(THREAD_RELATION_TYPE.name);

        // Bundled relationships only returned when the sync response is limited
        // hence us having to check both bundled relation and inspect the thread
        // model
        return !!threadDetails || this.threadRootId === this.getId();
    }

    public get replyEventId(): string | undefined {
        return this.getWireContent()["m.relates_to"]?.["m.in_reply_to"]?.event_id;
    }

    public get relationEventId(): string | undefined {
        return this.getWireContent()?.["m.relates_to"]?.event_id;
    }

    /**
     * Get the previous event content JSON. This will only return something for
     * state events which exist in the timeline.
     * @returns The previous event content JSON, or an empty object.
     */
    public getPrevContent(): IContent {
        // v2 then v1 then default
        return this.getUnsigned().prev_content || this.event.prev_content || {};
    }

    /**
     * Get either 'content' or 'prev_content' depending on if this event is
     * 'forward-looking' or not. This can be modified via event.forwardLooking.
     * In practice, this means we get the chronologically earlier content value
     * for this event (this method should surely be called getEarlierContent)
     * <strong>This method is experimental and may change.</strong>
     * @returns event.content if this event is forward-looking, else
     * event.prev_content.
     */
    public getDirectionalContent(): IContent {
        return this.forwardLooking ? this.getContent() : this.getPrevContent();
    }

    /**
     * Get the age of this event. This represents the age of the event when the
     * event arrived at the device, and not the age of the event when this
     * function was called.
     * Can only be returned once the server has echo'ed back
     * @returns The age of this event in milliseconds.
     */
    public getAge(): number | undefined {
        return this.getUnsigned().age || this.event.age; // v2 / v1
    }

    /**
     * Get the age of the event when this function was called.
     * This is the 'age' field adjusted according to how long this client has
     * had the event.
     * @returns The age of this event in milliseconds.
     */
    public getLocalAge(): number {
        return Date.now() - this.localTimestamp;
    }

    /**
     * Get the event state_key if it has one. This will return <code>undefined
     * </code> for message events.
     * @returns The event's `state_key`.
     */
    public getStateKey(): string | undefined {
        return this.event.state_key;
    }

    /**
     * Check if this event is a state event.
     * @returns True if this is a state event.
     */
    public isState(): boolean {
        return this.event.state_key !== undefined;
    }

    /**
     * Replace the content of this event with encrypted versions.
     * (This is used when sending an event; it should not be used by applications).
     *
     * @internal
     *
     * @param cryptoType - type of the encrypted event - typically
     * <tt>"m.room.encrypted"</tt>
     *
     * @param cryptoContent - raw 'content' for the encrypted event.
     *
     * @param senderCurve25519Key - curve25519 key to record for the
     *   sender of this event.
     *   See {@link MatrixEvent#getSenderKey}.
     *
     * @param claimedEd25519Key - claimed ed25519 key to record for the
     *   sender if this event.
     *   See {@link MatrixEvent#getClaimedEd25519Key}
     */
    public makeEncrypted(
        cryptoType: string,
        cryptoContent: object,
        senderCurve25519Key: string,
        claimedEd25519Key: string,
    ): void {
        // keep the plain-text data for 'view source'
        this.clearEvent = {
            type: this.event.type!,
            content: this.event.content!,
        };
        this.event.type = cryptoType;
        this.event.content = cryptoContent;
        this.senderCurve25519Key = senderCurve25519Key;
        this.claimedEd25519Key = claimedEd25519Key;
    }

    /**
     * Check if this event is currently being decrypted.
     *
     * @returns True if this event is currently being decrypted, else false.
     */
    public isBeingDecrypted(): boolean {
        return this.decryptionPromise != null;
    }

    public getDecryptionPromise(): Promise<void> | null {
        return this.decryptionPromise;
    }

    /**
     * Check if this event is an encrypted event which we failed to decrypt
     *
     * (This implies that we might retry decryption at some point in the future)
     *
     * @returns True if this event is an encrypted event which we
     *     couldn't decrypt.
     */
    public isDecryptionFailure(): boolean {
        return this.clearEvent?.content?.msgtype === "m.bad.encrypted";
    }

    /*
     * True if this event is an encrypted event which we failed to decrypt, the receiver's device is unverified and
     * the sender has disabled encrypting to unverified devices.
     */
    public get isEncryptedDisabledForUnverifiedDevices(): boolean {
        return this.isDecryptionFailure() && this.encryptedDisabledForUnverifiedDevices;
    }

    public shouldAttemptDecryption(): boolean {
        if (this.isRedacted()) return false;
        if (this.isBeingDecrypted()) return false;
        if (this.clearEvent) return false;
        if (!this.isEncrypted()) return false;

        return true;
    }

    /**
     * Start the process of trying to decrypt this event.
     *
     * (This is used within the SDK: it isn't intended for use by applications)
     *
     * @internal
     *
     * @param crypto - crypto module
     *
     * @returns promise which resolves (to undefined) when the decryption
     * attempt is completed.
     */
    public async attemptDecryption(crypto: CryptoBackend, options: IDecryptOptions = {}): Promise<void> {
        // start with a couple of sanity checks.
        if (!this.isEncrypted()) {
            throw new Error("Attempt to decrypt event which isn't encrypted");
        }

        const alreadyDecrypted = this.clearEvent && !this.isDecryptionFailure();
        const forceRedecrypt = options.forceRedecryptIfUntrusted && this.isKeySourceUntrusted();
        if (alreadyDecrypted && !forceRedecrypt) {
            // we may want to just ignore this? let's start with rejecting it.
            throw new Error("Attempt to decrypt event which has already been decrypted");
        }

        // if we already have a decryption attempt in progress, then it may
        // fail because it was using outdated info. We now have reason to
        // succeed where it failed before, but we don't want to have multiple
        // attempts going at the same time, so just set a flag that says we have
        // new info.
        //
        if (this.decryptionPromise) {
            logger.log(`Event ${this.getId()} already being decrypted; queueing a retry`);
            this.retryDecryption = true;
            return this.decryptionPromise;
        }

        this.decryptionPromise = this.decryptionLoop(crypto, options);
        return this.decryptionPromise;
    }

    /**
     * Cancel any room key request for this event and resend another.
     *
     * @param crypto - crypto module
     * @param userId - the user who received this event
     *
     * @returns a promise that resolves when the request is queued
     */
    public cancelAndResendKeyRequest(crypto: Crypto, userId: string): Promise<void> {
        const wireContent = this.getWireContent();
        return crypto.requestRoomKey(
            {
                algorithm: wireContent.algorithm,
                room_id: this.getRoomId()!,
                session_id: wireContent.session_id,
                sender_key: wireContent.sender_key,
            },
            this.getKeyRequestRecipients(userId),
            true,
        );
    }

    /**
     * Calculate the recipients for keyshare requests.
     *
     * @param userId - the user who received this event.
     *
     * @returns array of recipients
     */
    public getKeyRequestRecipients(userId: string): IKeyRequestRecipient[] {
        // send the request to all of our own devices
        const recipients = [
            {
                userId,
                deviceId: "*",
            },
        ];

        return recipients;
    }

    private async decryptionLoop(crypto: CryptoBackend, options: IDecryptOptions = {}): Promise<void> {
        // make sure that this method never runs completely synchronously.
        // (doing so would mean that we would clear decryptionPromise *before*
        // it is set in attemptDecryption - and hence end up with a stuck
        // `decryptionPromise`).
        await Promise.resolve();

        // eslint-disable-next-line no-constant-condition
        while (true) {
            this.retryDecryption = false;

            let res: IEventDecryptionResult;
            let err: Error | undefined = undefined;
            try {
                if (!crypto) {
                    res = this.badEncryptedMessage("Encryption not enabled");
                } else {
                    res = await crypto.decryptEvent(this);
                    if (options.isRetry === true) {
                        logger.info(`Decrypted event on retry (${this.getDetails()})`);
                    }
                }
            } catch (e) {
                const detailedError = e instanceof DecryptionError ? (<DecryptionError>e).detailedString : String(e);

                err = e as Error;

                // see if we have a retry queued.
                //
                // NB: make sure to keep this check in the same tick of the
                //   event loop as `decryptionPromise = null` below - otherwise we
                //   risk a race:
                //
                //   * A: we check retryDecryption here and see that it is
                //        false
                //   * B: we get a second call to attemptDecryption, which sees
                //        that decryptionPromise is set so sets
                //        retryDecryption
                //   * A: we continue below, clear decryptionPromise, and
                //        never do the retry.
                //
                if (this.retryDecryption) {
                    // decryption error, but we have a retry queued.
                    logger.log(`Error decrypting event (${this.getDetails()}), but retrying: ${detailedError}`);
                    continue;
                }

                // decryption error, no retries queued. Warn about the error and
                // set it to m.bad.encrypted.
                //
                // the detailedString already includes the name and message of the error, and the stack isn't much use,
                // so we don't bother to log `e` separately.
                logger.warn(`Error decrypting event (${this.getDetails()}): ${detailedError}`);

                res = this.badEncryptedMessage(String(e));
            }

            // at this point, we've either successfully decrypted the event, or have given up
            // (and set res to a 'badEncryptedMessage'). Either way, we can now set the
            // cleartext of the event and raise Event.decrypted.
            //
            // make sure we clear 'decryptionPromise' before sending the 'Event.decrypted' event,
            // otherwise the app will be confused to see `isBeingDecrypted` still set when
            // there isn't an `Event.decrypted` on the way.
            //
            // see also notes on retryDecryption above.
            //
            this.decryptionPromise = null;
            this.retryDecryption = false;
            this.setClearData(res);

            // Before we emit the event, clear the push actions so that they can be recalculated
            // by relevant code. We do this because the clear event has now changed, making it
            // so that existing rules can be re-run over the applicable properties. Stuff like
            // highlighting when the user's name is mentioned rely on this happening. We also want
            // to set the push actions before emitting so that any notification listeners don't
            // pick up the wrong contents.
            this.setPushDetails();

            if (options.emit !== false) {
                this.emit(MatrixEventEvent.Decrypted, this, err);
            }

            return;
        }
    }

    private badEncryptedMessage(reason: string): IEventDecryptionResult {
        return {
            clearEvent: {
                type: EventType.RoomMessage,
                content: {
                    msgtype: "m.bad.encrypted",
                    body: "** Unable to decrypt: " + reason + " **",
                },
            },
            encryptedDisabledForUnverifiedDevices: reason === `DecryptionError: ${WITHHELD_MESSAGES["m.unverified"]}`,
        };
    }

    /**
     * Update the cleartext data on this event.
     *
     * (This is used after decrypting an event; it should not be used by applications).
     *
     * @internal
     *
     * @param decryptionResult - the decryption result, including the plaintext and some key info
     *
     * @remarks
     * Fires {@link MatrixEventEvent.Decrypted}
     */
    private setClearData(decryptionResult: IEventDecryptionResult): void {
        this.clearEvent = decryptionResult.clearEvent;
        this.senderCurve25519Key = decryptionResult.senderCurve25519Key ?? null;
        this.claimedEd25519Key = decryptionResult.claimedEd25519Key ?? null;
        this.forwardingCurve25519KeyChain = decryptionResult.forwardingCurve25519KeyChain || [];
        this.untrusted = decryptionResult.untrusted || false;
        this.encryptedDisabledForUnverifiedDevices = decryptionResult.encryptedDisabledForUnverifiedDevices || false;
        this.invalidateExtensibleEvent();
    }

    /**
     * Gets the cleartext content for this event. If the event is not encrypted,
     * or encryption has not been completed, this will return null.
     *
     * @returns The cleartext (decrypted) content for the event
     */
    public getClearContent(): IContent | null {
        return this.clearEvent ? this.clearEvent.content : null;
    }

    /**
     * Check if the event is encrypted.
     * @returns True if this event is encrypted.
     */
    public isEncrypted(): boolean {
        return !this.isState() && this.event.type === EventType.RoomMessageEncrypted;
    }

    /**
     * The curve25519 key for the device that we think sent this event
     *
     * For an Olm-encrypted event, this is inferred directly from the DH
     * exchange at the start of the session: the curve25519 key is involved in
     * the DH exchange, so only a device which holds the private part of that
     * key can establish such a session.
     *
     * For a megolm-encrypted event, it is inferred from the Olm message which
     * established the megolm session
     */
    public getSenderKey(): string | null {
        return this.senderCurve25519Key;
    }

    /**
     * The additional keys the sender of this encrypted event claims to possess.
     *
     * Just a wrapper for #getClaimedEd25519Key (q.v.)
     */
    public getKeysClaimed(): Partial<Record<"ed25519", string>> {
        if (!this.claimedEd25519Key) return {};

        return {
            ed25519: this.claimedEd25519Key,
        };
    }

    /**
     * Get the ed25519 the sender of this event claims to own.
     *
     * For Olm messages, this claim is encoded directly in the plaintext of the
     * event itself. For megolm messages, it is implied by the m.room_key event
     * which established the megolm session.
     *
     * Until we download the device list of the sender, it's just a claim: the
     * device list gives a proof that the owner of the curve25519 key used for
     * this event (and returned by #getSenderKey) also owns the ed25519 key by
     * signing the public curve25519 key with the ed25519 key.
     *
     * In general, applications should not use this method directly, but should
     * instead use MatrixClient.getEventSenderDeviceInfo.
     */
    public getClaimedEd25519Key(): string | null {
        return this.claimedEd25519Key;
    }

    /**
     * Get the curve25519 keys of the devices which were involved in telling us
     * about the claimedEd25519Key and sender curve25519 key.
     *
     * Normally this will be empty, but in the case of a forwarded megolm
     * session, the sender keys are sent to us by another device (the forwarding
     * device), which we need to trust to do this. In that case, the result will
     * be a list consisting of one entry.
     *
     * If the device that sent us the key (A) got it from another device which
     * it wasn't prepared to vouch for (B), the result will be [A, B]. And so on.
     *
     * @returns base64-encoded curve25519 keys, from oldest to newest.
     */
    public getForwardingCurve25519KeyChain(): string[] {
        return this.forwardingCurve25519KeyChain;
    }

    /**
     * Whether the decryption key was obtained from an untrusted source. If so,
     * we cannot verify the authenticity of the message.
     */
    public isKeySourceUntrusted(): boolean | undefined {
        return !!this.untrusted;
    }

    public getUnsigned(): IUnsigned {
        return this.event.unsigned || {};
    }

    public setUnsigned(unsigned: IUnsigned): void {
        this.event.unsigned = unsigned;
    }

    public unmarkLocallyRedacted(): boolean {
        const value = this._localRedactionEvent;
        this._localRedactionEvent = null;
        if (this.event.unsigned) {
            this.event.unsigned.redacted_because = undefined;
        }
        return !!value;
    }

    public markLocallyRedacted(redactionEvent: MatrixEvent): void {
        if (this._localRedactionEvent) return;
        this.emit(MatrixEventEvent.BeforeRedaction, this, redactionEvent);
        this._localRedactionEvent = redactionEvent;
        if (!this.event.unsigned) {
            this.event.unsigned = {};
        }
        this.event.unsigned.redacted_because = redactionEvent.event as IEvent;
    }

    /**
     * Change the visibility of an event, as per https://github.com/matrix-org/matrix-doc/pull/3531 .
     *
     * @param visibilityChange - event holding a hide/unhide payload, or nothing
     *   if the event is being reset to its original visibility (presumably
     *   by a visibility event being redacted).
     *
     * @remarks
     * Fires {@link MatrixEventEvent.VisibilityChange} if `visibilityEvent`
     *   caused a change in the actual visibility of this event, either by making it
     *   visible (if it was hidden), by making it hidden (if it was visible) or by
     *   changing the reason (if it was hidden).
     */
    public applyVisibilityEvent(visibilityChange?: IVisibilityChange): void {
        const visible = visibilityChange?.visible ?? true;
        const reason = visibilityChange?.reason ?? null;
        let change = false;
        if (this.visibility.visible !== visible) {
            change = true;
        } else if (!this.visibility.visible && this.visibility["reason"] !== reason) {
            change = true;
        }
        if (change) {
            if (visible) {
                this.visibility = MESSAGE_VISIBLE;
            } else {
                this.visibility = Object.freeze({
                    visible: false,
                    reason,
                });
            }
            this.emit(MatrixEventEvent.VisibilityChange, this, visible);
        }
    }

    /**
     * Return instructions to display or hide the message.
     *
     * @returns Instructions determining whether the message
     * should be displayed.
     */
    public messageVisibility(): MessageVisibility {
        // Note: We may return `this.visibility` without fear, as
        // this is a shallow frozen object.
        return this.visibility;
    }

    /**
     * Update the content of an event in the same way it would be by the server
     * if it were redacted before it was sent to us
     *
     * @param redactionEvent - event causing the redaction
     */
    public makeRedacted(redactionEvent: MatrixEvent): void {
        // quick sanity-check
        if (!redactionEvent.event) {
            throw new Error("invalid redactionEvent in makeRedacted");
        }

        this._localRedactionEvent = null;

        this.emit(MatrixEventEvent.BeforeRedaction, this, redactionEvent);

        this._replacingEvent = null;
        // we attempt to replicate what we would see from the server if
        // the event had been redacted before we saw it.
        //
        // The server removes (most of) the content of the event, and adds a
        // "redacted_because" key to the unsigned section containing the
        // redacted event.
        if (!this.event.unsigned) {
            this.event.unsigned = {};
        }
        this.event.unsigned.redacted_because = redactionEvent.event as IEvent;

        for (const key in this.event) {
            if (this.event.hasOwnProperty(key) && !REDACT_KEEP_KEYS.has(key)) {
                delete this.event[key as keyof IEvent];
            }
        }

        // If the event is encrypted prune the decrypted bits
        if (this.isEncrypted()) {
            this.clearEvent = undefined;
        }

        const keeps =
            this.getType() in REDACT_KEEP_CONTENT_MAP
                ? REDACT_KEEP_CONTENT_MAP[this.getType() as keyof typeof REDACT_KEEP_CONTENT_MAP]
                : {};
        const content = this.getContent();
        for (const key in content) {
            if (content.hasOwnProperty(key) && !keeps[key]) {
                delete content[key];
            }
        }

        this.invalidateExtensibleEvent();
    }

    /**
     * Check if this event has been redacted
     *
     * @returns True if this event has been redacted
     */
    public isRedacted(): boolean {
        return Boolean(this.getUnsigned().redacted_because);
    }

    /**
     * Check if this event is a redaction of another event
     *
     * @returns True if this event is a redaction
     */
    public isRedaction(): boolean {
        return this.getType() === EventType.RoomRedaction;
    }

    /**
     * Return the visibility change caused by this event,
     * as per https://github.com/matrix-org/matrix-doc/pull/3531.
     *
     * @returns If the event is a well-formed visibility change event,
     * an instance of `IVisibilityChange`, otherwise `null`.
     */
    public asVisibilityChange(): IVisibilityChange | null {
        if (!EVENT_VISIBILITY_CHANGE_TYPE.matches(this.getType())) {
            // Not a visibility change event.
            return null;
        }
        const relation = this.getRelation();
        if (!relation || relation.rel_type != "m.reference") {
            // Ill-formed, ignore this event.
            return null;
        }
        const eventId = relation.event_id;
        if (!eventId) {
            // Ill-formed, ignore this event.
            return null;
        }
        const content = this.getWireContent();
        const visible = !!content.visible;
        const reason = content.reason;
        if (reason && typeof reason != "string") {
            // Ill-formed, ignore this event.
            return null;
        }
        // Well-formed visibility change event.
        return {
            visible,
            reason,
            eventId,
        };
    }

    /**
     * Check if this event alters the visibility of another event,
     * as per https://github.com/matrix-org/matrix-doc/pull/3531.
     *
     * @returns True if this event alters the visibility
     * of another event.
     */
    public isVisibilityEvent(): boolean {
        return EVENT_VISIBILITY_CHANGE_TYPE.matches(this.getType());
    }

    /**
     * Get the (decrypted, if necessary) redaction event JSON
     * if event was redacted
     *
     * @returns The redaction event JSON, or an empty object
     */
    public getRedactionEvent(): IEvent | {} | null {
        if (!this.isRedacted()) return null;

        if (this.clearEvent?.unsigned) {
            return this.clearEvent?.unsigned.redacted_because ?? null;
        } else if (this.event.unsigned?.redacted_because) {
            return this.event.unsigned.redacted_because;
        } else {
            return {};
        }
    }

    /**
     * Get the push actions, if known, for this event
     *
     * @returns push actions
     */
    public getPushActions(): IActionsObject | null {
        return this.pushDetails.actions || null;
    }

    /**
     * Get the push details, if known, for this event
     *
     * @returns push actions
     */
    public getPushDetails(): PushDetails {
        return this.pushDetails;
    }

    /**
     * Set the push actions for this event.
     * Clears rule from push details if present
     * @deprecated use `setPushDetails`
     *
     * @param pushActions - push actions
     */
    public setPushActions(pushActions: IActionsObject | null): void {
        this.pushDetails = {
            actions: pushActions || undefined,
        };
    }

    /**
     * Set the push details for this event.
     *
     * @param pushActions - push actions
     * @param rule - the executed push rule
     */
    public setPushDetails(pushActions?: IActionsObject, rule?: IAnnotatedPushRule): void {
        this.pushDetails = {
            actions: pushActions,
            rule,
        };
    }

    /**
     * Replace the `event` property and recalculate any properties based on it.
     * @param event - the object to assign to the `event` property
     */
    public handleRemoteEcho(event: object): void {
        const oldUnsigned = this.getUnsigned();
        const oldId = this.getId();
        this.event = event;
        // if this event was redacted before it was sent, it's locally marked as redacted.
        // At this point, we've received the remote echo for the event, but not yet for
        // the redaction that we are sending ourselves. Preserve the locally redacted
        // state by copying over redacted_because so we don't get a flash of
        // redacted, not-redacted, redacted as remote echos come in
        if (oldUnsigned.redacted_because) {
            if (!this.event.unsigned) {
                this.event.unsigned = {};
            }
            this.event.unsigned.redacted_because = oldUnsigned.redacted_because;
        }
        // successfully sent.
        this.setStatus(null);
        if (this.getId() !== oldId) {
            // emit the event if it changed
            this.emit(MatrixEventEvent.LocalEventIdReplaced, this);
        }

        this.localTimestamp = Date.now() - this.getAge()!;
    }

    /**
     * Whether the event is in any phase of sending, send failure, waiting for
     * remote echo, etc.
     */
    public isSending(): boolean {
        return !!this.status;
    }

    /**
     * Update the event's sending status and emit an event as well.
     *
     * @param status - The new status
     */
    public setStatus(status: EventStatus | null): void {
        this.status = status;
        this.emit(MatrixEventEvent.Status, this, status);
    }

    public replaceLocalEventId(eventId: string): void {
        this.event.event_id = eventId;
        this.emit(MatrixEventEvent.LocalEventIdReplaced, this);
    }

    /**
     * Get whether the event is a relation event, and of a given type if
     * `relType` is passed in. State events cannot be relation events
     *
     * @param relType - if given, checks that the relation is of the
     * given type
     */
    public isRelation(relType?: string): boolean {
        // Relation info is lifted out of the encrypted content when sent to
        // encrypted rooms, so we have to check `getWireContent` for this.
        const relation = this.getWireContent()?.["m.relates_to"];
        if (this.isState() && relation?.rel_type === RelationType.Replace) {
            // State events cannot be m.replace relations
            return false;
        }
        return !!(relation?.rel_type && relation.event_id && (relType ? relation.rel_type === relType : true));
    }

    /**
     * Get relation info for the event, if any.
     */
    public getRelation(): IEventRelation | null {
        if (!this.isRelation()) {
            return null;
        }
        return this.getWireContent()["m.relates_to"] ?? null;
    }

    /**
     * Set an event that replaces the content of this event, through an m.replace relation.
     *
     * @param newEvent - the event with the replacing content, if any.
     *
     * @remarks
     * Fires {@link MatrixEventEvent.Replaced}
     */
    public makeReplaced(newEvent?: MatrixEvent): void {
        // don't allow redacted events to be replaced.
        // if newEvent is null we allow to go through though,
        // as with local redaction, the replacing event might get
        // cancelled, which should be reflected on the target event.
        if (this.isRedacted() && newEvent) {
            return;
        }
        // don't allow state events to be replaced using this mechanism as per MSC2676
        if (this.isState()) {
            return;
        }
        if (this._replacingEvent !== newEvent) {
            this._replacingEvent = newEvent ?? null;
            this.emit(MatrixEventEvent.Replaced, this);
            this.invalidateExtensibleEvent();
        }
    }

    /**
     * Returns the status of any associated edit or redaction
     * (not for reactions/annotations as their local echo doesn't affect the original event),
     * or else the status of the event.
     */
    public getAssociatedStatus(): EventStatus | null {
        if (this._replacingEvent) {
            return this._replacingEvent.status;
        } else if (this._localRedactionEvent) {
            return this._localRedactionEvent.status;
        }
        return this.status;
    }

    public getServerAggregatedRelation<T>(relType: RelationType | string): T | undefined {
        return this.getUnsigned()["m.relations"]?.[relType];
    }

    /**
     * Returns the event ID of the event replacing the content of this event, if any.
     */
    public replacingEventId(): string | undefined {
        const replaceRelation = this.getServerAggregatedRelation<IAggregatedRelation>(RelationType.Replace);
        if (replaceRelation) {
            return replaceRelation.event_id;
        } else if (this._replacingEvent) {
            return this._replacingEvent.getId();
        }
    }

    /**
     * Returns the event replacing the content of this event, if any.
     * Replacements are aggregated on the server, so this would only
     * return an event in case it came down the sync, or for local echo of edits.
     */
    public replacingEvent(): MatrixEvent | null {
        return this._replacingEvent;
    }

    /**
     * Returns the origin_server_ts of the event replacing the content of this event, if any.
     */
    public replacingEventDate(): Date | undefined {
        const replaceRelation = this.getServerAggregatedRelation<IAggregatedRelation>(RelationType.Replace);
        if (replaceRelation) {
            const ts = replaceRelation.origin_server_ts;
            if (Number.isFinite(ts)) {
                return new Date(ts);
            }
        } else if (this._replacingEvent) {
            return this._replacingEvent.getDate() ?? undefined;
        }
    }

    /**
     * Returns the event that wants to redact this event, but hasn't been sent yet.
     * @returns the event
     */
    public localRedactionEvent(): MatrixEvent | null {
        return this._localRedactionEvent;
    }

    /**
     * For relations and redactions, returns the event_id this event is referring to.
     */
    public getAssociatedId(): string | undefined {
        const relation = this.getRelation();
        if (this.replyEventId) {
            return this.replyEventId;
        } else if (relation) {
            return relation.event_id;
        } else if (this.isRedaction()) {
            return this.event.redacts;
        }
    }

    /**
     * Checks if this event is associated with another event. See `getAssociatedId`.
     * @deprecated use hasAssociation instead.
     */
    public hasAssocation(): boolean {
        return !!this.getAssociatedId();
    }

    /**
     * Checks if this event is associated with another event. See `getAssociatedId`.
     */
    public hasAssociation(): boolean {
        return !!this.getAssociatedId();
    }

    /**
     * Update the related id with a new one.
     *
     * Used to replace a local id with remote one before sending
     * an event with a related id.
     *
     * @param eventId - the new event id
     */
    public updateAssociatedId(eventId: string): void {
        const relation = this.getRelation();
        if (relation) {
            relation.event_id = eventId;
        } else if (this.isRedaction()) {
            this.event.redacts = eventId;
        }
    }

    /**
     * Flags an event as cancelled due to future conditions. For example, a verification
     * request event in the same sync transaction may be flagged as cancelled to warn
     * listeners that a cancellation event is coming down the same pipe shortly.
     * @param cancelled - Whether the event is to be cancelled or not.
     */
    public flagCancelled(cancelled = true): void {
        this._isCancelled = cancelled;
    }

    /**
     * Gets whether or not the event is flagged as cancelled. See flagCancelled() for
     * more information.
     * @returns True if the event is cancelled, false otherwise.
     */
    public isCancelled(): boolean {
        return this._isCancelled;
    }

    /**
     * Get a copy/snapshot of this event. The returned copy will be loosely linked
     * back to this instance, though will have "frozen" event information. Other
     * properties of this MatrixEvent instance will be copied verbatim, which can
     * mean they are in reference to this instance despite being on the copy too.
     * The reference the snapshot uses does not change, however members aside from
     * the underlying event will not be deeply cloned, thus may be mutated internally.
     * For example, the sender profile will be copied over at snapshot time, and
     * the sender profile internally may mutate without notice to the consumer.
     *
     * This is meant to be used to snapshot the event details themselves, not the
     * features (such as sender) surrounding the event.
     * @returns A snapshot of this event.
     */
    public toSnapshot(): MatrixEvent {
        const ev = new MatrixEvent(JSON.parse(JSON.stringify(this.event)));
        for (const [p, v] of Object.entries(this)) {
            if (p !== "event") {
                // exclude the thing we just cloned
                // @ts-ignore - XXX: this is just nasty
                ev[p as keyof MatrixEvent] = v;
            }
        }
        return ev;
    }

    /**
     * Determines if this event is equivalent to the given event. This only checks
     * the event object itself, not the other properties of the event. Intended for
     * use with toSnapshot() to identify events changing.
     * @param otherEvent - The other event to check against.
     * @returns True if the events are the same, false otherwise.
     */
    public isEquivalentTo(otherEvent: MatrixEvent): boolean {
        if (!otherEvent) return false;
        if (otherEvent === this) return true;
        const myProps = deepSortedObjectEntries(this.event);
        const theirProps = deepSortedObjectEntries(otherEvent.event);
        return JSON.stringify(myProps) === JSON.stringify(theirProps);
    }

    /**
     * Summarise the event as JSON. This is currently used by React SDK's view
     * event source feature and Seshat's event indexing, so take care when
     * adjusting the output here.
     *
     * If encrypted, include both the decrypted and encrypted view of the event.
     *
     * This is named `toJSON` for use with `JSON.stringify` which checks objects
     * for functions named `toJSON` and will call them to customise the output
     * if they are defined.
     */
    public toJSON(): object {
        const event = this.getEffectiveEvent();

        if (!this.isEncrypted()) {
            return event;
        }

        return {
            decrypted: event,
            encrypted: this.event,
        };
    }

    public setVerificationRequest(request: VerificationRequest): void {
        this.verificationRequest = request;
    }

    public setTxnId(txnId: string): void {
        this.txnId = txnId;
    }

    public getTxnId(): string | undefined {
        return this.txnId;
    }

    /**
     * Set the instance of a thread associated with the current event
     * @param thread - the thread
     */
    public setThread(thread?: Thread): void {
        if (this.thread) {
            this.reEmitter.stopReEmitting(this.thread, [ThreadEvent.Update]);
        }
        this.thread = thread;
        this.setThreadId(thread?.id);
        if (thread) {
            this.reEmitter.reEmit(thread, [ThreadEvent.Update]);
        }
    }

    /**
     * Get the instance of the thread associated with the current event
     */
    public getThread(): Thread | undefined {
        return this.thread;
    }

    public setThreadId(threadId?: string): void {
        this.threadId = threadId;
    }
}

/* REDACT_KEEP_KEYS gives the keys we keep when an event is redacted
 *
 * This is specified here:
 *  http://matrix.org/speculator/spec/HEAD/client_server/latest.html#redactions
 *
 * Also:
 *  - We keep 'unsigned' since that is created by the local server
 *  - We keep user_id for backwards-compat with v1
 */
const REDACT_KEEP_KEYS = new Set([
    "event_id",
    "type",
    "room_id",
    "user_id",
    "sender",
    "state_key",
    "prev_state",
    "content",
    "unsigned",
    "origin_server_ts",
]);

// a map from state event type to the .content keys we keep when an event is redacted
const REDACT_KEEP_CONTENT_MAP: Record<string, Record<string, 1>> = {
    [EventType.RoomMember]: { membership: 1 },
    [EventType.RoomCreate]: { creator: 1 },
    [EventType.RoomJoinRules]: { join_rule: 1 },
    [EventType.RoomPowerLevels]: {
        ban: 1,
        events: 1,
        events_default: 1,
        kick: 1,
        redact: 1,
        state_default: 1,
        users: 1,
        users_default: 1,
    },
} as const;
