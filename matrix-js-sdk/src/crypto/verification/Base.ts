/*
Copyright 2018 New Vector Ltd
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

/**
 * Base class for verification methods.
 */

import { MatrixEvent } from "../../models/event";
import { EventType } from "../../@types/event";
import { logger } from "../../logger";
import { DeviceInfo } from "../deviceinfo";
import { newTimeoutError } from "./Error";
import { KeysDuringVerification, requestKeysDuringVerification } from "../CrossSigning";
import { IVerificationChannel } from "./request/Channel";
import { MatrixClient } from "../../client";
import { VerificationRequest } from "./request/VerificationRequest";
import { TypedEventEmitter } from "../../models/typed-event-emitter";
import {
    ShowQrCodeCallbacks,
    ShowSasCallbacks,
    Verifier,
    VerifierEvent,
    VerifierEventHandlerMap,
} from "../../crypto-api/verification";

const timeoutException = new Error("Verification timed out");

export class SwitchStartEventError extends Error {
    public constructor(public readonly startEvent: MatrixEvent | null) {
        super();
    }
}

export type KeyVerifier = (keyId: string, device: DeviceInfo, keyInfo: string) => void;

/** @deprecated use VerifierEvent */
export type VerificationEvent = VerifierEvent;
/** @deprecated use VerifierEvent */
export const VerificationEvent = VerifierEvent;

/** @deprecated use VerifierEventHandlerMap */
export type VerificationEventHandlerMap = {
    [VerificationEvent.Cancel]: (e: Error | MatrixEvent) => void;
};

/** @deprecated Avoid referencing this class directly; instead use {@link Crypto.Verifier}. */
// The type parameters of VerificationBase are no longer used, but we need some placeholders to maintain
// backwards compatibility with applications that reference the class.
export class VerificationBase<
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        Events extends string = VerifierEvent,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        Arguments = VerifierEventHandlerMap,
    >
    extends TypedEventEmitter<VerifierEvent, VerifierEventHandlerMap>
    implements Verifier
{
    private cancelled = false;
    private _done = false;
    private promise: Promise<void> | null = null;
    private transactionTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
    protected expectedEvent?: string;
    private resolve?: () => void;
    private reject?: (e: Error | MatrixEvent) => void;
    private resolveEvent?: (e: MatrixEvent) => void;
    private rejectEvent?: (e: Error) => void;
    private started?: boolean;

    /**
     * Base class for verification methods.
     *
     * <p>Once a verifier object is created, the verification can be started by
     * calling the verify() method, which will return a promise that will
     * resolve when the verification is completed, or reject if it could not
     * complete.</p>
     *
     * <p>Subclasses must have a NAME class property.</p>
     *
     * @param channel - the verification channel to send verification messages over.
     * TODO: Channel types
     *
     * @param baseApis - base matrix api interface
     *
     * @param userId - the user ID that is being verified
     *
     * @param deviceId - the device ID that is being verified
     *
     * @param startEvent - the m.key.verification.start event that
     * initiated this verification, if any
     *
     * @param request - the key verification request object related to
     * this verification, if any
     */
    public constructor(
        public readonly channel: IVerificationChannel,
        public readonly baseApis: MatrixClient,
        public readonly userId: string,
        public readonly deviceId: string,
        public startEvent: MatrixEvent | null,
        public readonly request: VerificationRequest,
    ) {
        super();
    }

    public get initiatedByMe(): boolean {
        // if there is no start event yet,
        // we probably want to send it,
        // which happens if we initiate
        if (!this.startEvent) {
            return true;
        }
        const sender = this.startEvent.getSender();
        const content = this.startEvent.getContent();
        return sender === this.baseApis.getUserId() && content.from_device === this.baseApis.getDeviceId();
    }

    public get hasBeenCancelled(): boolean {
        return this.cancelled;
    }

    private resetTimer(): void {
        logger.info("Refreshing/starting the verification transaction timeout timer");
        if (this.transactionTimeoutTimer !== null) {
            clearTimeout(this.transactionTimeoutTimer);
        }
        this.transactionTimeoutTimer = setTimeout(() => {
            if (!this._done && !this.cancelled) {
                logger.info("Triggering verification timeout");
                this.cancel(timeoutException);
            }
        }, 10 * 60 * 1000); // 10 minutes
    }

    private endTimer(): void {
        if (this.transactionTimeoutTimer !== null) {
            clearTimeout(this.transactionTimeoutTimer);
            this.transactionTimeoutTimer = null;
        }
    }

    protected send(type: string, uncompletedContent: Record<string, any>): Promise<void> {
        return this.channel.send(type, uncompletedContent);
    }

    protected waitForEvent(type: string): Promise<MatrixEvent> {
        if (this._done) {
            return Promise.reject(new Error("Verification is already done"));
        }
        const existingEvent = this.request.getEventFromOtherParty(type);
        if (existingEvent) {
            return Promise.resolve(existingEvent);
        }

        this.expectedEvent = type;
        return new Promise((resolve, reject) => {
            this.resolveEvent = resolve;
            this.rejectEvent = reject;
        });
    }

    public canSwitchStartEvent(event: MatrixEvent): boolean {
        return false;
    }

    public switchStartEvent(event: MatrixEvent): void {
        if (this.canSwitchStartEvent(event)) {
            logger.log("Verification Base: switching verification start event", { restartingFlow: !!this.rejectEvent });
            if (this.rejectEvent) {
                const reject = this.rejectEvent;
                this.rejectEvent = undefined;
                reject(new SwitchStartEventError(event));
            } else {
                this.startEvent = event;
            }
        }
    }

    public handleEvent(e: MatrixEvent): void {
        if (this._done) {
            return;
        } else if (e.getType() === this.expectedEvent) {
            // if we receive an expected m.key.verification.done, then just
            // ignore it, since we don't need to do anything about it
            if (this.expectedEvent !== EventType.KeyVerificationDone) {
                this.expectedEvent = undefined;
                this.rejectEvent = undefined;
                this.resetTimer();
                this.resolveEvent?.(e);
            }
        } else if (e.getType() === EventType.KeyVerificationCancel) {
            const reject = this.reject;
            this.reject = undefined;
            // there is only promise to reject if verify has been called
            if (reject) {
                const content = e.getContent();
                const { reason, code } = content;
                reject(new Error(`Other side cancelled verification ` + `because ${reason} (${code})`));
            }
        } else if (this.expectedEvent) {
            // only cancel if there is an event expected.
            // if there is no event expected, it means verify() wasn't called
            // and we're just replaying the timeline events when syncing
            // after a refresh when the events haven't been stored in the cache yet.
            const exception = new Error(
                "Unexpected message: expecting " + this.expectedEvent + " but got " + e.getType(),
            );
            this.expectedEvent = undefined;
            if (this.rejectEvent) {
                const reject = this.rejectEvent;
                this.rejectEvent = undefined;
                reject(exception);
            }
            this.cancel(exception);
        }
    }

    public async done(): Promise<KeysDuringVerification | void> {
        this.endTimer(); // always kill the activity timer
        if (!this._done) {
            this.request.onVerifierFinished();
            this.resolve?.();
            return requestKeysDuringVerification(this.baseApis, this.userId, this.deviceId);
        }
    }

    public cancel(e: Error | MatrixEvent): void {
        this.endTimer(); // always kill the activity timer
        if (!this._done) {
            this.cancelled = true;
            this.request.onVerifierCancelled();
            if (this.userId && this.deviceId) {
                // send a cancellation to the other user (if it wasn't
                // cancelled by the other user)
                if (e === timeoutException) {
                    const timeoutEvent = newTimeoutError();
                    this.send(timeoutEvent.getType(), timeoutEvent.getContent());
                } else if (e instanceof MatrixEvent) {
                    const sender = e.getSender();
                    if (sender !== this.userId) {
                        const content = e.getContent();
                        if (e.getType() === EventType.KeyVerificationCancel) {
                            content.code = content.code || "m.unknown";
                            content.reason = content.reason || content.body || "Unknown reason";
                            this.send(EventType.KeyVerificationCancel, content);
                        } else {
                            this.send(EventType.KeyVerificationCancel, {
                                code: "m.unknown",
                                reason: content.body || "Unknown reason",
                            });
                        }
                    }
                } else {
                    this.send(EventType.KeyVerificationCancel, {
                        code: "m.unknown",
                        reason: e.toString(),
                    });
                }
            }
            if (this.promise !== null) {
                // when we cancel without a promise, we end up with a promise
                // but no reject function. If cancel is called again, we'd error.
                if (this.reject) this.reject(e);
            } else {
                // FIXME: this causes an "Uncaught promise" console message
                // if nothing ends up chaining this promise.
                this.promise = Promise.reject(e);
            }
            // Also emit a 'cancel' event that the app can listen for to detect cancellation
            // before calling verify()
            this.emit(VerificationEvent.Cancel, e);
        }
    }

    /**
     * Begin the key verification
     *
     * @returns Promise which resolves when the verification has
     *     completed.
     */
    public verify(): Promise<void> {
        if (this.promise) return this.promise;

        this.promise = new Promise((resolve, reject) => {
            this.resolve = (...args): void => {
                this._done = true;
                this.endTimer();
                resolve(...args);
            };
            this.reject = (e: Error | MatrixEvent): void => {
                this._done = true;
                this.endTimer();
                reject(e);
            };
        });
        if (this.doVerification && !this.started) {
            this.started = true;
            this.resetTimer(); // restart the timeout
            new Promise<void>((resolve, reject) => {
                const crossSignId = this.baseApis.crypto!.deviceList.getStoredCrossSigningForUser(this.userId)?.getId();
                if (crossSignId === this.deviceId) {
                    reject(new Error("Device ID is the same as the cross-signing ID"));
                }
                resolve();
            })
                .then(() => this.doVerification!())
                .then(this.done.bind(this), this.cancel.bind(this));
        }
        return this.promise;
    }

    protected doVerification?: () => Promise<void>;

    protected async verifyKeys(userId: string, keys: Record<string, string>, verifier: KeyVerifier): Promise<void> {
        // we try to verify all the keys that we're told about, but we might
        // not know about all of them, so keep track of the keys that we know
        // about, and ignore the rest
        const verifiedDevices: [string, string, string][] = [];

        for (const [keyId, keyInfo] of Object.entries(keys)) {
            const deviceId = keyId.split(":", 2)[1];
            const device = this.baseApis.getStoredDevice(userId, deviceId);
            if (device) {
                verifier(keyId, device, keyInfo);
                verifiedDevices.push([deviceId, keyId, device.keys[keyId]]);
            } else {
                const crossSigningInfo = this.baseApis.crypto!.deviceList.getStoredCrossSigningForUser(userId);
                if (crossSigningInfo && crossSigningInfo.getId() === deviceId) {
                    verifier(
                        keyId,
                        DeviceInfo.fromStorage(
                            {
                                keys: {
                                    [keyId]: deviceId,
                                },
                            },
                            deviceId,
                        ),
                        keyInfo,
                    );
                    verifiedDevices.push([deviceId, keyId, deviceId]);
                } else {
                    logger.warn(`verification: Could not find device ${deviceId} to verify`);
                }
            }
        }

        // if none of the keys could be verified, then error because the app
        // should be informed about that
        if (!verifiedDevices.length) {
            throw new Error("No devices could be verified");
        }

        logger.info("Verification completed! Marking devices verified: ", verifiedDevices);
        // TODO: There should probably be a batch version of this, otherwise it's going
        // to upload each signature in a separate API call which is silly because the
        // API supports as many signatures as you like.
        for (const [deviceId, keyId, key] of verifiedDevices) {
            await this.baseApis.crypto!.setDeviceVerification(userId, deviceId, true, null, null, { [keyId]: key });
        }

        // if one of the user's own devices is being marked as verified / unverified,
        // check the key backup status, since whether or not we use this depends on
        // whether it has a signature from a verified device
        if (userId == this.baseApis.credentials.userId) {
            await this.baseApis.checkKeyBackup();
        }
    }

    public get events(): string[] | undefined {
        return undefined;
    }

    /**
     * Get the details for an SAS verification, if one is in progress
     *
     * Returns `null`, unless this verifier is for a SAS-based verification and we are waiting for the user to confirm
     * the SAS matches.
     */
    public getShowSasCallbacks(): ShowSasCallbacks | null {
        return null;
    }

    /**
     * Get the details for reciprocating QR code verification, if one is in progress
     *
     * Returns `null`, unless this verifier is for reciprocating a QR-code-based verification (ie, the other user has
     * already scanned our QR code), and we are waiting for the user to confirm.
     */
    public getReciprocateQrCodeCallbacks(): ShowQrCodeCallbacks | null {
        return null;
    }
}
