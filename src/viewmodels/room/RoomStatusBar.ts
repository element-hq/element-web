/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    RoomStatusBarState,
    type RoomStatusBarViewModel as RoomStatusBarViewModelInterface,
    type RoomStatusBarViewSnapshot,
} from "@element-hq/web-shared-components";
import {
    ClientEvent,
    SyncState,
    type MatrixClient,
    type Room,
    type MatrixError,
    RoomEvent,
    EventStatus,
    MatrixSafetyError,
} from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../MatrixClientPeg";
import Resend from "../../Resend";
import { Action } from "../../dispatcher/actions";
import dis from "../../dispatcher/dispatcher";
import { LocalRoom, LocalRoomState } from "../../models/LocalRoom";

interface PropsWithRoom {
    room: Room | LocalRoom;
}
interface PropsWithVisibility extends PropsWithRoom {
    /**
     * Called when the bar becomes visible.
     */
    onVisible: () => void;
    /**
     * Called when the bar becomes hidden.
     */
    onHidden: () => void;
}

type Props = PropsWithRoom | PropsWithVisibility;

export class RoomStatusBarViewModel
    extends BaseViewModel<RoomStatusBarViewSnapshot, Props>
    implements RoomStatusBarViewModelInterface
{
    /**
     * Check if the room has any unread messages. If it does, we should render the specific message
     * depending on the kind of error encountered when sending them.
     *
     * Because a room can contain multiple unsent messages, the resultant state is based on the
     * "most important" error to show.
     *
     * @param room The room being viewed.
     * @param hasClickedTermsAndConditions Whether the terms and conditions button has just been pressed.
     * @returns A snapshot if an error should be visible, or null if not.
     */
    private static readonly determineStateForUnreadMessages = (
        room: Room,
        hasClickedTermsAndConditions: boolean,
        isResending: boolean,
    ): RoomStatusBarViewSnapshot => {
        const unsentMessages = room.getPendingEvents().filter((ev) => ev.status === EventStatus.NOT_SENT);
        if (unsentMessages.length === 0) {
            return {
                state: null,
            };
        }
        if (hasClickedTermsAndConditions) {
            // The user has just clicked (and we *assume* accepted) the terms and contitions, so show them the retry buttons.
            // If the user has not accepted the terms, we will just prompt the same error again anyway.
            return {
                state: RoomStatusBarState.UnsentMessages,
                isResending,
            };
        }

        // Filter through the errors and find the most important error.
        let resourceLimitError: MatrixError | null = null;
        let safetyError: MatrixSafetyError | null = null;
        for (const m of unsentMessages) {
            if (m.error?.errcode === "M_CONSENT_NOT_GIVEN") {
                // This is the most important thing to show, so break here if we find one.
                return {
                    state: RoomStatusBarState.NeedsConsent,
                    consentUri: m.error.data.consent_uri,
                };
            }
            if (m.error?.errcode === "M_RESOURCE_LIMIT_EXCEEDED") {
                resourceLimitError = m.error;
            }
            if (m.error instanceof MatrixSafetyError) {
                safetyError = m.error;
            }
        }
        if (resourceLimitError) {
            return {
                state: RoomStatusBarState.ResourceLimited,
                resourceLimit: resourceLimitError.data.limit_type ?? "",
                adminContactHref: resourceLimitError.data.admin_contact,
            };
        }
        if (safetyError) {
            const canRetry = !!safetyError.expiry;
            return {
                state: RoomStatusBarState.MessageRejected,
                harms: [...safetyError.harms],
                serverError: safetyError.error,
                ...(canRetry
                    ? {
                          isResending,
                          canRetryInSeconds:
                              safetyError.expiry && Math.ceil((safetyError.expiry.getTime() - Date.now()) / 1000),
                      }
                    : undefined),
            };
        }
        // Otherwise, we know there are unsent messages but the error is not special.
        return {
            state: RoomStatusBarState.UnsentMessages,
            isResending,
        };
    };

    private static readonly computeSnapshot = (
        room: Room,
        client: MatrixClient,
        isResending: boolean,
        hasClickedTermsAndConditions: boolean,
    ): RoomStatusBarViewSnapshot => {
        const isLocalRoomAndIsError = (room as LocalRoom)["isError"];
        if (isLocalRoomAndIsError !== undefined) {
            return {
                // Local room errors can only be about failed room creation.
                state: isLocalRoomAndIsError ? RoomStatusBarState.LocalRoomFailed : null,
            };
        }

        // If we're in the process of resending, *always* show a resending state so we don't flicker.
        if (isResending) {
            return this.determineStateForUnreadMessages(room, hasClickedTermsAndConditions, true);
        }

        const syncState = client.getSyncState();

        // Highest priority.
        // A no-connection bar trumps all else, as you won't be able to resend or do anything!
        if (syncState === SyncState.Error) {
            const syncData = client.getSyncStateData();
            if (syncData?.error?.name === "M_RESOURCE_LIMIT_EXCEEDED") {
                // There's one situation in which we don't show this 'no connection' bar, and that's
                // if it's a M_RESOURCE_LIMIT_EXCEEDED error: those are shown as a toast by LoggedInView.
                return {
                    state: null,
                };
            }
            return {
                state: RoomStatusBarState.ConnectionLost,
            };
        }

        // Connection is good, so check room messages for any failures.
        return this.determineStateForUnreadMessages(room, hasClickedTermsAndConditions, false);
    };

    private readonly client: MatrixClient;
    private timeout?: ReturnType<typeof globalThis.setTimeout>;

    public constructor(props: Props) {
        const client = MatrixClientPeg.safeGet();
        super(props, RoomStatusBarViewModel.computeSnapshot(props.room, client, false, false));
        this.client = client;
        this.disposables.trackListener(client, ClientEvent.Sync, this.onClientSync);
        this.disposables.trackListener(props.room, RoomEvent.LocalEchoUpdated, this.onRoomLocalEchoUpdated);
    }

    private readonly onClientSync = (): void => {
        this.setSnapshot();
    };

    private readonly onRoomLocalEchoUpdated = (): void => {
        this.setSnapshot();
    };

    private isResending = false;
    private hasClickedTermsAndConditions = false;

    private setSnapshot(): void {
        if (this.timeout) {
            // If we had a timer going, clear it.
            clearTimeout(this.timeout);
        }
        this.snapshot.set(
            RoomStatusBarViewModel.computeSnapshot(
                this.props.room,
                this.client,
                this.isResending,
                this.hasClickedTermsAndConditions,
            ),
        );
        // Reset `hasClickedTermsAndConditions` once the state has cleared.
        if (this.hasClickedTermsAndConditions && !this.snapshot.current.state) {
            this.hasClickedTermsAndConditions = false;
        }
    }

    public onTermsAndConditionsClicked = (): void => {
        this.hasClickedTermsAndConditions = true;
        this.setSnapshot();
    };

    public onDeleteAllClick = (): void => {
        Resend.cancelUnsentEvents(this.props.room);
        dis.fire(Action.FocusSendMessageComposer);
        this.setSnapshot();
    };

    public onResendAllClick = async (): Promise<void> => {
        this.isResending = true;
        this.setSnapshot();
        try {
            await Resend.resendUnsentEvents(this.props.room);
            dis.fire(Action.FocusSendMessageComposer);
        } finally {
            this.isResending = false;
            this.setSnapshot();
        }
    };

    public onRetryRoomCreationClick = (): void => {
        if (this.props.room instanceof LocalRoom === false) {
            throw Error("Tried to recreate local room, but room was not local.");
        }

        // This resets the local room state from error.
        this.props.room.state = LocalRoomState.NEW;
        dis.dispatch({
            action: "local_room_event",
            roomId: this.props.room.roomId,
        });
    };
}
