/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    type RoomStatusBarViewModel as RoomStatusBarViewModelInterface,
    type RoomStatusBarViewSnapshot,
} from "@element-hq/web-shared-components";
import {
    ClientEvent,
    SyncState,
    MatrixClient,
    type Room,
    MatrixError,
    RoomEvent,
    EventStatus,
} from "matrix-js-sdk/src/matrix";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import Resend from "../../Resend";
import { Action } from "../../dispatcher/actions";
import dis from "../../dispatcher/dispatcher";
import { LocalRoom, LocalRoomState } from "../../models/LocalRoom";

interface PropsWithRoom {
    room: Room;
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
    private static readonly determineStateForUnreadMessages = (room: Room): RoomStatusBarViewSnapshot["state"] => {
        const unsentMessages = room.getPendingEvents().filter((ev) => ev.status === EventStatus.NOT_SENT);
        if (unsentMessages.length === 0) {
            return null;
        }
        let resourceLimitError: MatrixError | null = null;
        for (const m of unsentMessages) {
            if (m.error) {
                if (m.error.errcode === "M_CONSENT_NOT_GIVEN") {
                    // This is the most important thing to show, so break here if we find one.
                    return {
                        // This MUST exist.
                        consentUri: m.error.data.consent_uri,
                    };
                }
                if (m.error.errcode === "M_RESOURCE_LIMIT_EXCEEDED") {
                    resourceLimitError = m.error;
                }
            }
        }
        if (resourceLimitError) {
            return {
                resourceLimit: resourceLimitError.data.limit_type ?? "",
                adminContactHref: resourceLimitError.data.admin_contact,
            };
        }
        return {
            isResending: false,
        };
    };

    private static readonly computeSnapshot = (
        room: Room,
        client: MatrixClient,
        isResending: boolean,
        isRetryingRoomCreation: boolean,
    ): RoomStatusBarViewSnapshot => {
        if (room instanceof LocalRoom) {
            if (isRetryingRoomCreation) {
                return {
                    state: {
                        isRetryingRoomCreation,
                    },
                };
            }
            if (room.isError) {
                return {
                    state: {
                        isRetryingRoomCreation,
                    },
                };
            } else {
                // Local rooms do not have to worry about these other conditions :)
                return { state: null };
            }
        }

        // If we're in the process of resending, don't flicker.
        if (isResending) {
            return {
                state: {
                    isResending,
                },
            };
        }
        const syncState = client.getSyncState();

        // Highest priority.
        if (syncState === SyncState.Error) {
            // no conn bar trumps the "some not sent" msg since you can't resend without
            // a connection!
            // There's one situation in which we don't show this 'no connection' bar, and that's
            // if it's a resource limit exceeded error: those are shown in the top bar.
            const syncData = client.getSyncStateData();
            if (syncData?.error?.name === "M_RESOURCE_LIMIT_EXCEEDED") {
                const error = syncData.error as MatrixError;
                return {
                    state: {
                        // TODO: Correct limit
                        resourceLimit: error.data.limit_type ?? "",
                        adminContactHref: error.data.admin_contact,
                    },
                };
            } else {
                return {
                    state: {
                        connectionLost: true,
                    },
                };
            }
        }

        // Then check messages.
        return { state: this.determineStateForUnreadMessages(room) };
    };

    private readonly client: MatrixClient;

    public constructor(props: Props) {
        const client = MatrixClientPeg.safeGet();
        super(props, RoomStatusBarViewModel.computeSnapshot(props.room, client, false, false));
        this.client = client;
        client.on(ClientEvent.Sync, this.onClientSync);
        props.room.on(RoomEvent.LocalEchoUpdated, this.onRoomLocalEchoUpdated);
    }

    private readonly onClientSync = () => {
        this.setSnapshot();
    };

    private readonly onRoomLocalEchoUpdated = () => {
        this.setSnapshot();
    };

    private isResending = false;
    private isRetryingRoomCreation = false;

    private setSnapshot(): void {
        this.snapshot.set(
            RoomStatusBarViewModel.computeSnapshot(
                this.props.room,
                this.client,
                this.isResending,
                this.isRetryingRoomCreation,
            ),
        );
    }

    public dispose(): void {
        this.client.off(ClientEvent.Sync, this.onClientSync);
        this.props.room.on(RoomEvent.LocalEchoUpdated, this.onRoomLocalEchoUpdated);
        super.dispose();
    }

    public onDeleteAllClick = (): void => {
        Resend.cancelUnsentEvents(this.props.room);
        dis.fire(Action.FocusSendMessageComposer);
        this.setSnapshot();
    };

    public onResendAllClick = (): void => {
        this.isResending = true;
        this.setSnapshot();
        void Resend.resendUnsentEvents(this.props.room).finally(() => {
            this.isResending = false;
            this.setSnapshot();
        });
        dis.fire(Action.FocusSendMessageComposer);
    };

    public onRetryRoomCreationClick = (): void => {
        // eslint-disable-next-line react-compiler/react-compiler
        (this.props.room as LocalRoom).state = LocalRoomState.NEW;
        dis.dispatch({
            action: "local_room_event",
            roomId: this.props.room.roomId,
        });
    };
}
