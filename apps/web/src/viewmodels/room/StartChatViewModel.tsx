/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    type StartChatViewSnapshot,
    type StartChatViewActions,
    _t,
} from "@element-hq/web-shared-components";
import {
    EventType,
    type MatrixEvent,
    RoomEvent,
    RoomStateEvent,
    type MatrixClient,
    type Room,
    type User,
} from "matrix-js-sdk/src/matrix";
import React, { type JSX } from "react";
import { UIComponent } from "@element-hq/element-web-module-api";

import { DefaultTagID } from "../../stores/room-list-v3/skip-list/tag";
import { LocalRoom } from "../../models/LocalRoom";
import DMRoomMap from "../../utils/DMRoomMap";
import { isRoomEncrypted } from "../../hooks/useIsEncrypted";
import { tagRoom } from "../../utils/room/tagRoom";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { RoomSettingsTab } from "../../components/views/dialogs/RoomSettingsDialog";
import { shouldShowComponent } from "../../customisations/helpers/UIComponents";
import RoomAvatar from "../../components/views/avatars/RoomAvatar";
import { type ViewUserPayload } from "../../dispatcher/payloads/ViewUserPayload";
import { Action } from "../../dispatcher/actions";
import MiniAvatarUploader, { AVATAR_LARGE_SIZE } from "../../components/views/elements/MiniAvatarUploader";

interface Props {
    /** The room associated with this view model */
    room: Room;
    /** The Matrix client instance */
    matrixClient: MatrixClient;
}

/**
 * View model for the StartChatView component.
 */
export class StartChatViewModel extends BaseViewModel<StartChatViewSnapshot, Props> implements StartChatViewActions {
    private dmPartner: string | undefined;

    public constructor(props: Props) {
        super(props, StartChatViewModel.getInitialSnapshot(props));
        this.dmPartner = StartChatViewModel.getDmPartner(props.room);

        // The operation is async
        this.setEncrypted();

        this.disposables.trackListener(props.room, RoomEvent.Name, this.onRoomNameChanged);
        this.disposables.trackListener(props.room, RoomEvent.Tags, this.onRoomNameTagChanged);
        // To track invitation rights
        this.disposables.trackListener(props.room, RoomEvent.MyMembership, this.onMembershipChanged);
        this.disposables.trackListener(props.room.currentState, RoomStateEvent.Events, this.onRoomStateEvents);
    }

    private onRoomNameChanged = (): void => {
        this.snapshot.merge({ roomName: this.props.room.name });
    };

    private onRoomNameTagChanged = (): void => {
        this.snapshot.merge({ isFavourite: StartChatViewModel.isFavourite(this.props.room) });
    };

    private onMembershipChanged = (): void => {
        this.snapshot.merge({ canInvite: StartChatViewModel.canInvite(this.props) });
    };

    private onRoomStateEvents = (ev: unknown): void => {
        const event = ev as MatrixEvent;
        if (event.getType() === EventType.RoomPowerLevels) {
            this.snapshot.merge({ canInvite: StartChatViewModel.canInvite(this.props) });
        }
    };

    /**
     * Checks if the room is tagged as favourite by the user.
     */
    private static isFavourite(room: Room): boolean {
        return Boolean(room.tags[DefaultTagID.Favourite]);
    }

    /**
     * Gets the DM partner's user ID for a given room, if it exists. For local rooms, it checks the targets, otherwise it uses the DMRoomMap.
     */
    private static getDmPartner(room: Room): string | undefined {
        if (room instanceof LocalRoom) return room?.targets[0]?.userId;
        return DMRoomMap.shared().getUserIdForRoomId(room.roomId);
    }

    /**
     * Checks if the user can invite others to the room, which requires both the necessary permissions and the feature being enabled.
     */
    private static canInvite({ room, matrixClient }: Props): boolean {
        return room.canInvite(matrixClient.getSafeUserId()) && shouldShowComponent(UIComponent.InviteUsers);
    }

    /**
     * Generates the initial snapshot for the view model based on the room's properties.
     * The encryption status is default set at false.
     */
    private static getInitialSnapshot(props: Props): StartChatViewSnapshot {
        const { room } = props;
        const dmPartner = StartChatViewModel.getDmPartner(room);

        const commonSnapshot = {
            roomName: room.name,
            canInvite: false,
            // Encryption is looked asynchronously
            isEncrypted: false,
            isFavourite: StartChatViewModel.isFavourite(room),
        };

        if (dmPartner) {
            const member = room?.getMember(dmPartner);
            const dmName = room.name || member?.rawDisplayName || dmPartner;

            return {
                ...commonSnapshot,
                type: "dm",
                dmName,
            };
        }

        const isPublic: boolean = room.getJoinRule() === "public";

        return {
            ...commonSnapshot,
            type: isPublic ? "public_room" : "private_room",
            canInvite: StartChatViewModel.canInvite(props),
        };
    }

    /**
     * Asynchronously checks if the room is encrypted and updates the snapshot accordingly. If there's an error during the check, it defaults to not encrypted.
     */
    private async setEncrypted(): Promise<void> {
        try {
            const crypto = this.props.matrixClient.getCrypto();
            const isEncrypted = Boolean(this.props.room && crypto && (await isRoomEncrypted(this.props.room, crypto)));
            this.snapshot.merge({ isEncrypted });
        } catch {
            this.snapshot.merge({ isEncrypted: false });
        }
    }

    public toggleFavourite = (): void => {
        tagRoom(this.props.room, DefaultTagID.Favourite);
    };

    public openNotifications = (): void => {
        defaultDispatcher.dispatch({
            action: "open_room_settings",
            initial_tab_id: RoomSettingsTab.Notifications,
        });
    };

    public invite = (): void => {
        defaultDispatcher.dispatch({ action: "view_invite", roomId: this.props.room.roomId });
    };

    /**
     * Gets the avatar component for the room. If it's a DM, it shows the partner's avatar and opens their profile on click. Otherwise, it shows the room avatar with an uploader to change it.
     */
    public getAvatar(): JSX.Element {
        if (this.dmPartner) {
            const member = this.props.room.getMember(this.dmPartner);

            return (
                <RoomAvatar
                    room={this.props.room}
                    size={AVATAR_LARGE_SIZE}
                    onClick={() => {
                        defaultDispatcher.dispatch<ViewUserPayload>({
                            action: Action.ViewUser,
                            // XXX: We should be using a real member object and not assuming what the receiver wants.
                            member: member || ({ userId: this.dmPartner } as User),
                        });
                    }}
                />
            );
        }

        const hasAvatar = Boolean(
            this.props.room.currentState.getStateEvents(EventType.RoomAvatar, "")?.getContent()?.url,
        );
        const avatar = <RoomAvatar room={this.props.room} size={AVATAR_LARGE_SIZE} viewAvatarOnClick={false} />;

        return (
            <MiniAvatarUploader
                hasAvatar={hasAvatar}
                noAvatarLabel={_t("room|intro|no_avatar_label")}
                setAvatarUrl={(url) =>
                    this.props.matrixClient.sendStateEvent(this.props.room.roomId, EventType.RoomAvatar, { url }, "")
                }
                size={AVATAR_LARGE_SIZE}
            >
                {avatar}
            </MiniAvatarUploader>
        );
    }
}
