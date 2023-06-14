/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent } from "../models/event";
import { TypedEventEmitter } from "../models/typed-event-emitter";

/**
 * An incoming, or outgoing, request to verify a user or a device via cross-signing.
 */
export interface VerificationRequest
    extends TypedEventEmitter<VerificationRequestEvent, VerificationRequestEventHandlerMap> {
    /**
     * Unique ID for this verification request.
     *
     * An ID isn't assigned until the first message is sent, so this may be `undefined` in the early phases.
     */
    get transactionId(): string | undefined;

    /**
     * For an in-room verification, the ID of the room.
     *
     * For to-device verifictions, `undefined`.
     */
    get roomId(): string | undefined;

    /**
     * True if this request was initiated by the local client.
     *
     * For in-room verifications, the initiator is who sent the `m.key.verification.request` event.
     * For to-device verifications, the initiator is who sent the `m.key.verification.start` event.
     */
    get initiatedByMe(): boolean;

    /** The user id of the other party in this request */
    get otherUserId(): string;

    /** For verifications via to-device messages: the ID of the other device. Otherwise, undefined. */
    get otherDeviceId(): string | undefined;

    /** True if the other party in this request is one of this user's own devices. */
    get isSelfVerification(): boolean;

    /** current phase of the request. */
    get phase(): VerificationPhase;

    /** True if the request has sent its initial event and needs more events to complete
     * (ie it is in phase `Requested`, `Ready` or `Started`).
     */
    get pending(): boolean;

    /**
     * True if we have started the process of sending an `m.key.verification.ready` (but have not necessarily received
     * the remote echo which causes a transition to {@link VerificationPhase.Ready}.
     */
    get accepting(): boolean;

    /**
     * True if we have started the process of sending an `m.key.verification.cancel` (but have not necessarily received
     * the remote echo which causes a transition to {@link VerificationPhase.Cancelled}).
     */
    get declining(): boolean;

    /**
     * The remaining number of ms before the request will be automatically cancelled.
     *
     * `null` indicates that there is no timeout
     */
    get timeout(): number | null;

    /** once the phase is Started (and !initiatedByMe) or Ready: common methods supported by both sides */
    get methods(): string[];

    /** the method picked in the .start event */
    get chosenMethod(): string | null;

    /**
     * Checks whether the other party supports a given verification method.
     * This is useful when setting up the QR code UI, as it is somewhat asymmetrical:
     * if the other party supports SCAN_QR, we should show a QR code in the UI, and vice versa.
     * For methods that need to be supported by both ends, use the `methods` property.
     *
     * @param method - the method to check
     * @returns true if the other party said they supported the method
     */
    otherPartySupportsMethod(method: string): boolean;

    /**
     * Accepts the request, sending a .ready event to the other party
     *
     * @returns Promise which resolves when the event has been sent.
     */
    accept(): Promise<void>;

    /**
     * Cancels the request, sending a cancellation to the other party
     *
     * @param params - Details for the cancellation, including `reason` (defaults to "User declined"), and `code`
     *    (defaults to `m.user`).
     *
     * @returns Promise which resolves when the event has been sent.
     */
    cancel(params?: { reason?: string; code?: string }): Promise<void>;

    /**
     * Create a {@link Verifier} to do this verification via a particular method.
     *
     * If a verifier has already been created for this request, returns that verifier.
     *
     * This does *not* send the `m.key.verification.start` event - to do so, call {@link Crypto.Verifier#verify} on the
     * returned verifier.
     *
     * If no previous events have been sent, pass in `targetDevice` to set who to direct this request to.
     *
     * @param method - the name of the verification method to use.
     * @param targetDevice - details of where to send the request to.
     *
     * @returns The verifier which will do the actual verification.
     */
    beginKeyVerification(method: string, targetDevice?: { userId?: string; deviceId?: string }): Verifier;

    /**
     * The verifier which is doing the actual verification, once the method has been established.
     * Only defined when the `phase` is Started.
     */
    get verifier(): Verifier | undefined;

    /**
     * Get the data for a QR code allowing the other device to verify this one, if it supports it.
     *
     * Only set after a .ready if the other party can scan a QR code, otherwise undefined.
     */
    getQRCodeBytes(): Buffer | undefined;

    /**
     * If this request has been cancelled, the cancellation code (e.g `m.user`) which is responsible for cancelling
     * this verification.
     */
    get cancellationCode(): string | null;

    /**
     * The id of the user that cancelled the request.
     *
     * Only defined when phase is Cancelled
     */
    get cancellingUserId(): string | undefined;
}

/** Events emitted by {@link VerificationRequest}. */
export enum VerificationRequestEvent {
    /**
     * Fires whenever the state of the request object has changed.
     *
     * There is no payload to the event.
     */
    Change = "change",
}

/**
 * Listener type map for {@link VerificationRequestEvent}s.
 *
 * @internal
 */
export type VerificationRequestEventHandlerMap = {
    [VerificationRequestEvent.Change]: () => void;
};

/** The current phase of a verification request. */
export enum VerificationPhase {
    /** Initial state: no event yet exchanged */
    Unsent = 1,

    /** An `m.key.verification.request` event has been sent or received */
    Requested,

    /** An `m.key.verification.ready` event has been sent or received, indicating the verification request is accepted. */
    Ready,

    /** An `m.key.verification.start` event has been sent or received, choosing a verification method */
    Started,

    /** An `m.key.verification.cancel` event has been sent or received at any time before the `done` event, cancelling the verification request */
    Cancelled,

    /** An `m.key.verification.done` event has been **sent**, completing the verification request. */
    Done,
}

/**
 * A `Verifier` is responsible for performing the verification using a particular method, such as via QR code or SAS
 * (emojis).
 *
 * A verifier object can be created by calling `VerificationRequest.beginVerification`; one is also created
 * automatically when a `m.key.verification.start` event is received for an existing VerificationRequest.
 *
 * Once a verifier object is created, the verification can be started by calling the {@link Verifier#verify} method.
 */
export interface Verifier extends TypedEventEmitter<VerifierEvent, VerifierEventHandlerMap> {
    /**
     * Returns true if the verification has been cancelled, either by us or the other side.
     */
    get hasBeenCancelled(): boolean;

    /**
     * The ID of the other user in the verification process.
     */
    get userId(): string;

    /**
     * Start the key verification, if it has not already been started.
     *
     * This means sending a `m.key.verification.start` if we are the first responder, or a `m.key.verification.accept`
     * if the other side has already sent a start event.
     *
     * @returns Promise which resolves when the verification has completed, or rejects if the verification is cancelled
     *    or times out.
     */
    verify(): Promise<void>;

    /**
     * Cancel a verification.
     *
     * We will send an `m.key.verification.cancel` if the verification is still in flight. The verification promise
     * will reject, and a {@link Crypto.VerifierEvent#Cancel} will be emitted.
     *
     * @param e - the reason for the cancellation.
     */
    cancel(e: Error): void;

    /**
     * Get the details for an SAS verification, if one is in progress
     *
     * Returns `null`, unless this verifier is for a SAS-based verification and we are waiting for the user to confirm
     * the SAS matches.
     */
    getShowSasCallbacks(): ShowSasCallbacks | null;

    /**
     * Get the details for reciprocating QR code verification, if one is in progress
     *
     * Returns `null`, unless this verifier is for reciprocating a QR-code-based verification (ie, the other user has
     * already scanned our QR code), and we are waiting for the user to confirm.
     */
    getReciprocateQrCodeCallbacks(): ShowQrCodeCallbacks | null;
}

/** Events emitted by {@link Verifier} */
export enum VerifierEvent {
    /**
     * The verification has been cancelled, by us or the other side.
     *
     * The payload is either an {@link Error}, or an (incoming or outgoing) {@link MatrixEvent}, depending on
     * unspecified reasons.
     */
    Cancel = "cancel",

    /**
     * SAS data has been exchanged and should be displayed to the user.
     *
     * The payload is the {@link ShowSasCallbacks} object.
     */
    ShowSas = "show_sas",

    /**
     * QR code data should be displayed to the user.
     *
     * The payload is the {@link ShowQrCodeCallbacks} object.
     */
    ShowReciprocateQr = "show_reciprocate_qr",
}

/** Listener type map for {@link VerifierEvent}s. */
export type VerifierEventHandlerMap = {
    [VerifierEvent.Cancel]: (e: Error | MatrixEvent) => void;
    [VerifierEvent.ShowSas]: (sas: ShowSasCallbacks) => void;
    [VerifierEvent.ShowReciprocateQr]: (qr: ShowQrCodeCallbacks) => void;
};

/**
 * Callbacks for user actions while a QR code is displayed.
 *
 * This is exposed as the payload of a `VerifierEvent.ShowReciprocateQr` event, or can be retrieved directly from the
 * verifier as `reciprocateQREvent`.
 */
export interface ShowQrCodeCallbacks {
    /** The user confirms that the verification data matches */
    confirm(): void;

    /** Cancel the verification flow */
    cancel(): void;
}

/**
 * Callbacks for user actions while a SAS is displayed.
 *
 * This is exposed as the payload of a `VerifierEvent.ShowSas` event, or directly from the verifier as `sasEvent`.
 */
export interface ShowSasCallbacks {
    /** The generated SAS to be shown to the user */
    sas: GeneratedSas;

    /** Function to call if the user confirms that the SAS matches.
     *
     * @returns A Promise that completes once the m.key.verification.mac is queued.
     */
    confirm(): Promise<void>;

    /**
     * Function to call if the user finds the SAS does not match.
     *
     * Sends an `m.key.verification.cancel` event with a `m.mismatched_sas` error code.
     */
    mismatch(): void;

    /** Cancel the verification flow */
    cancel(): void;
}

/** A generated SAS to be shown to the user, in alternative formats */
export interface GeneratedSas {
    /**
     * The SAS as three numbers between 0 and 8191.
     *
     * Only populated if the `decimal` SAS method was negotiated.
     */
    decimal?: [number, number, number];

    /**
     * The SAS as seven emojis.
     *
     * Only populated if the `emoji` SAS method was negotiated.
     */
    emoji?: EmojiMapping[];
}

/**
 * An emoji for the generated SAS. A tuple `[emoji, name]` where `emoji` is the emoji itself and `name` is the
 * English name.
 */
export type EmojiMapping = [emoji: string, name: string];

/**
 * True if the request is in a state where it can be accepted (ie, that we're in phases {@link VerificationPhase.Unsent}
 * or {@link VerificationPhase.Requested}, and that we're not in the process of sending a `ready` or `cancel`).
 */
export function canAcceptVerificationRequest(req: VerificationRequest): boolean {
    return req.phase < VerificationPhase.Ready && !req.accepting && !req.declining;
}
