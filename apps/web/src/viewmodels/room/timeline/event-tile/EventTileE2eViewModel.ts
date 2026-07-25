/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, MatrixEventEvent, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { CryptoEvent, EventShieldColour, type EventShieldReason } from "matrix-js-sdk/src/crypto-api";
import { BaseViewModel } from "@element-hq/web-shared-components";

import { isLocalRoom } from "../../../../utils/localRoom/isLocalRoom";
import { objectHasDiff } from "../../../../utils/objects";
import { getEventTileE2ePadlockViewState, type EventTileE2ePadlockViewState } from "./EventTileE2eState";

export interface EventTileE2eViewModelProps {
    /** Matrix client used for crypto verification lookups. */
    cli: MatrixClient;
    /** Matrix event rendered by the tile. */
    mxEvent: MatrixEvent;
    /** Whether the room is encrypted. */
    isRoomEncrypted?: boolean | null;
    /** Current event send status. Used to re-check verification as local echoes progress. */
    eventSendStatus?: MatrixEvent["status"] | null;
    /** Whether the view model should register live event and trust listeners. */
    enableListeners: boolean;
    /** Optional local-room predicate for tests. */
    isLocalRoom?: (roomId: string) => boolean;
}

interface EventTileE2eShieldState {
    shieldColour: EventShieldColour;
    shieldReason: EventShieldReason | null;
}

/** View model for EventTile E2E padlock state and verification refreshes. */
export class EventTileE2eViewModel extends BaseViewModel<EventTileE2ePadlockViewState, EventTileE2eViewModelProps> {
    private shieldState: EventTileE2eShieldState = {
        shieldColour: EventShieldColour.NONE,
        shieldReason: null,
    };
    private listenerCleanups: Array<() => void> = [];
    private started = false;
    private verificationRequestId = 0;

    public constructor(props: EventTileE2eViewModelProps) {
        super(
            props,
            EventTileE2eViewModel.calculateSnapshot(props, {
                shieldColour: EventShieldColour.NONE,
                shieldReason: null,
            }),
        );
    }

    private static calculateSnapshot(
        props: EventTileE2eViewModelProps,
        shieldState: EventTileE2eShieldState,
    ): EventTileE2ePadlockViewState {
        const verificationEvent = props.mxEvent.replacingEvent() ?? props.mxEvent;
        const roomId = verificationEvent.getRoomId()!;

        return getEventTileE2ePadlockViewState({
            mxEvent: props.mxEvent,
            verificationEvent,
            shieldColour: shieldState.shieldColour,
            shieldReason: shieldState.shieldReason,
            isRoomEncrypted: props.isRoomEncrypted,
            isLocalRoom: props.isLocalRoom?.(roomId) ?? isLocalRoom(roomId),
        });
    }

    /** Starts live listeners and runs the initial verification check. */
    public start(): void {
        if (this.started) return;

        this.started = true;
        this.setupListeners();
        this.verifyEvent();
    }

    /** Updates inputs, refreshes listeners when the event changes, and re-checks verification when needed. */
    public setProps(newProps: Partial<EventTileE2eViewModelProps>): void {
        const prevProps = this.props;
        const prevEvent = this.props.mxEvent;

        this.props = {
            ...this.props,
            ...newProps,
        };

        const eventChanged = prevEvent !== this.props.mxEvent;
        const shouldVerify =
            eventChanged ||
            prevProps.eventSendStatus !== this.props.eventSendStatus ||
            prevProps.enableListeners !== this.props.enableListeners;

        if (eventChanged) {
            this.shieldState = {
                shieldColour: EventShieldColour.NONE,
                shieldReason: null,
            };
            this.refreshSnapshot();
            this.setupListeners();
        } else if (prevProps.enableListeners !== this.props.enableListeners) {
            this.setupListeners();
        } else if (prevProps.isRoomEncrypted !== this.props.isRoomEncrypted) {
            this.refreshSnapshot();
        }

        if (shouldVerify) {
            this.verifyEvent();
        }
    }

    public override dispose(): void {
        this.teardownListeners();
        super.dispose();
    }

    private setupListeners(): void {
        this.teardownListeners();

        if (!this.started || !this.props.enableListeners) {
            return;
        }

        const { cli, mxEvent } = this.props;

        cli.on(CryptoEvent.UserTrustStatusChanged, this.onUserVerificationChanged);
        this.listenerCleanups.push(() => {
            cli.removeListener(CryptoEvent.UserTrustStatusChanged, this.onUserVerificationChanged);
        });

        mxEvent.on(MatrixEventEvent.Decrypted, this.onDecrypted);
        this.listenerCleanups.push(() => {
            mxEvent.removeListener(MatrixEventEvent.Decrypted, this.onDecrypted);
        });

        mxEvent.on(MatrixEventEvent.Replaced, this.onReplaced);
        this.listenerCleanups.push(() => {
            mxEvent.removeListener(MatrixEventEvent.Replaced, this.onReplaced);
        });
    }

    private teardownListeners(): void {
        for (const cleanup of this.listenerCleanups) {
            cleanup();
        }
        this.listenerCleanups = [];
    }

    private readonly onDecrypted = (): void => {
        this.verifyEvent();
    };

    private readonly onReplaced = (): void => {
        this.verifyEvent();
    };

    private readonly onUserVerificationChanged = (userId: string): void => {
        if (userId === this.props.mxEvent.getSender()) {
            this.verifyEvent();
        }
    };

    private verifyEvent(): void {
        const requestId = ++this.verificationRequestId;

        this.doVerifyEvent(requestId).catch((e) => {
            const event = this.props.mxEvent;
            logger.error(`Error getting encryption info on event ${event.getId()} in room ${event.getRoomId()}`, e);
        });
    }

    private async doVerifyEvent(requestId: number): Promise<void> {
        const verificationEvent = this.props.mxEvent.replacingEvent() ?? this.props.mxEvent;

        if (!verificationEvent.isEncrypted() || verificationEvent.isRedacted()) {
            this.setShieldState(EventShieldColour.NONE, null);
            return;
        }

        const encryptionInfo = (await this.props.cli.getCrypto()?.getEncryptionInfoForEvent(verificationEvent)) ?? null;
        if (this.isDisposed || requestId !== this.verificationRequestId) return;

        if (encryptionInfo === null) {
            // likely a decryption error
            this.setShieldState(EventShieldColour.NONE, null);
            return;
        }

        this.setShieldState(encryptionInfo.shieldColour, encryptionInfo.shieldReason);
    }

    private setShieldState(shieldColour: EventShieldColour, shieldReason: EventShieldReason | null): void {
        this.shieldState = {
            shieldColour,
            shieldReason,
        };
        this.refreshSnapshot();
    }

    private refreshSnapshot(): void {
        const nextSnapshot = EventTileE2eViewModel.calculateSnapshot(this.props, this.shieldState);

        if (objectHasDiff(this.snapshot.current, nextSnapshot)) {
            this.snapshot.set(nextSnapshot);
        }
    }
}
