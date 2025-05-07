/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useContext } from "react";
import { EventType, type Room, type User, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import DMRoomMap from "../../../utils/DMRoomMap";
import { _t, _td, type TranslationKey } from "../../../languageHandler";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";
import MiniAvatarUploader, { AVATAR_SIZE } from "../elements/MiniAvatarUploader";
import RoomAvatar from "../avatars/RoomAvatar";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { type ViewUserPayload } from "../../../dispatcher/payloads/ViewUserPayload";
import { Action } from "../../../dispatcher/actions";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import { showSpaceInvite } from "../../../utils/space";
import EventTileBubble from "../messages/EventTileBubble";
import { RoomSettingsTab } from "../dialogs/RoomSettingsDialog";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { privateShouldBeEncrypted } from "../../../utils/rooms";
import { LocalRoom } from "../../../models/LocalRoom";
import { shouldEncryptRoomWithSingle3rdPartyInvite } from "../../../utils/room/shouldEncryptRoomWithSingle3rdPartyInvite";
import { useScopedRoomContext } from "../../../contexts/ScopedRoomContext.tsx";

function hasExpectedEncryptionSettings(matrixClient: MatrixClient, room: Room): boolean {
    const isEncrypted: boolean = matrixClient.isRoomEncrypted(room.roomId);
    const isPublic: boolean = room.getJoinRule() === "public";
    return isPublic || !privateShouldBeEncrypted(matrixClient) || isEncrypted;
}

const determineIntroMessage = (room: Room, encryptedSingle3rdPartyInvite: boolean): TranslationKey => {
    if (room instanceof LocalRoom) {
        return _td("room|intro|send_message_start_dm");
    }

    if (encryptedSingle3rdPartyInvite) {
        return _td("room|intro|encrypted_3pid_dm_pending_join");
    }

    return _td("room|intro|start_of_dm_history");
};

const NewRoomIntro: React.FC = () => {
    const cli = useContext(MatrixClientContext);
    const { room, roomId } = useScopedRoomContext("room", "roomId");

    if (!room || !roomId) {
        throw new Error("Unable to create a NewRoomIntro without room and roomId");
    }

    const isLocalRoom = room instanceof LocalRoom;
    const dmPartner = isLocalRoom ? room.targets[0]?.userId : DMRoomMap.shared().getUserIdForRoomId(roomId);

    let body: JSX.Element;
    if (dmPartner) {
        const { shouldEncrypt: encryptedSingle3rdPartyInvite } = shouldEncryptRoomWithSingle3rdPartyInvite(room);
        const introMessage = determineIntroMessage(room, encryptedSingle3rdPartyInvite);
        let caption: string | undefined;

        if (
            !(room instanceof LocalRoom) &&
            !encryptedSingle3rdPartyInvite &&
            room.getJoinedMemberCount() + room.getInvitedMemberCount() === 2
        ) {
            caption = _t("room|intro|dm_caption");
        }

        const member = room?.getMember(dmPartner);
        const displayName = room?.name || member?.rawDisplayName || dmPartner;
        body = (
            <React.Fragment>
                <RoomAvatar
                    room={room}
                    size={AVATAR_SIZE}
                    onClick={() => {
                        defaultDispatcher.dispatch<ViewUserPayload>({
                            action: Action.ViewUser,
                            // XXX: We should be using a real member object and not assuming what the receiver wants.
                            member: member || ({ userId: dmPartner } as User),
                        });
                    }}
                />

                <h2>{room.name}</h2>

                <p>
                    {_t(
                        introMessage,
                        {},
                        {
                            displayName: () => <strong>{displayName}</strong>,
                        },
                    )}
                </p>
                {caption && <p>{caption}</p>}
            </React.Fragment>
        );
    } else {
        const inRoom = room && room.getMyMembership() === KnownMembership.Join;
        const topic = room.currentState.getStateEvents(EventType.RoomTopic, "")?.getContent()?.topic;
        const canAddTopic = inRoom && room.currentState.maySendStateEvent(EventType.RoomTopic, cli.getSafeUserId());

        const onTopicClick = (): void => {
            defaultDispatcher.dispatch(
                {
                    action: "open_room_settings",
                    room_id: roomId,
                },
                true,
            );
            // focus the topic field to help the user find it as it'll gain an outline
            setTimeout(() => {
                window.document.getElementById("profileTopic")?.focus();
            });
        };

        let topicText;
        if (canAddTopic && topic) {
            topicText = _t(
                "room|intro|topic_edit",
                { topic },
                {
                    a: (sub) => (
                        <AccessibleButton element="a" kind="link_inline" onClick={onTopicClick}>
                            {sub}
                        </AccessibleButton>
                    ),
                },
            );
        } else if (topic) {
            topicText = _t("room|intro|topic", { topic });
        } else if (canAddTopic) {
            topicText = _t(
                "room|intro|no_topic",
                {},
                {
                    a: (sub) => (
                        <AccessibleButton element="a" kind="link_inline" onClick={onTopicClick}>
                            {sub}
                        </AccessibleButton>
                    ),
                },
            );
        }

        const creator = room.currentState.getStateEvents(EventType.RoomCreate, "")?.getSender();
        const creatorName = (creator && room?.getMember(creator)?.rawDisplayName) || creator;

        let createdText: string;
        if (creator === cli.getUserId()) {
            createdText = _t("room|intro|you_created");
        } else {
            createdText = _t("room|intro|user_created", {
                displayName: creatorName,
            });
        }

        let parentSpace: Room | undefined;
        if (
            SpaceStore.instance.activeSpaceRoom?.canInvite(cli.getSafeUserId()) &&
            SpaceStore.instance.isRoomInSpace(SpaceStore.instance.activeSpace!, room.roomId)
        ) {
            parentSpace = SpaceStore.instance.activeSpaceRoom;
        }

        let buttons: JSX.Element | undefined;
        if (parentSpace && shouldShowComponent(UIComponent.InviteUsers)) {
            buttons = (
                <div className="mx_NewRoomIntro_buttons">
                    <AccessibleButton
                        className="mx_NewRoomIntro_inviteButton"
                        kind="primary"
                        onClick={() => {
                            showSpaceInvite(parentSpace!);
                        }}
                    >
                        {_t("invite|to_space", { spaceName: parentSpace.name })}
                    </AccessibleButton>
                    {room.canInvite(cli.getSafeUserId()) && (
                        <AccessibleButton
                            className="mx_NewRoomIntro_inviteButton"
                            kind="primary_outline"
                            onClick={() => {
                                defaultDispatcher.dispatch({ action: "view_invite", roomId });
                            }}
                        >
                            {_t("room|intro|room_invite")}
                        </AccessibleButton>
                    )}
                </div>
            );
        } else if (room.canInvite(cli.getSafeUserId()) && shouldShowComponent(UIComponent.InviteUsers)) {
            buttons = (
                <div className="mx_NewRoomIntro_buttons">
                    <AccessibleButton
                        className="mx_NewRoomIntro_inviteButton"
                        kind="primary"
                        onClick={() => {
                            defaultDispatcher.dispatch({ action: "view_invite", roomId });
                        }}
                    >
                        {_t("room|invite_this_room")}
                    </AccessibleButton>
                </div>
            );
        }

        const avatarUrl = room.currentState.getStateEvents(EventType.RoomAvatar, "")?.getContent()?.url;
        let avatar = <RoomAvatar room={room} size={AVATAR_SIZE} viewAvatarOnClick={!!avatarUrl} />;

        if (!avatarUrl) {
            avatar = (
                <MiniAvatarUploader
                    hasAvatar={false}
                    noAvatarLabel={_t("room|intro|no_avatar_label")}
                    setAvatarUrl={(url) => cli.sendStateEvent(roomId, EventType.RoomAvatar, { url }, "")}
                >
                    {avatar}
                </MiniAvatarUploader>
            );
        }

        body = (
            <React.Fragment>
                {avatar}

                <h2>{room.name}</h2>

                <p>
                    {createdText}{" "}
                    {_t(
                        "room|intro|start_of_room",
                        {},
                        {
                            roomName: () => <strong>{room.name}</strong>,
                        },
                    )}
                </p>
                <p>{topicText}</p>
                {buttons}
            </React.Fragment>
        );
    }

    function openRoomSettings(event: ButtonEvent): void {
        event.preventDefault();
        defaultDispatcher.dispatch({
            action: "open_room_settings",
            initial_tab_id: RoomSettingsTab.Security,
        });
    }

    const subText = _t("room|intro|private_unencrypted_warning");

    let subButton: JSX.Element | undefined;
    if (
        room.currentState.mayClientSendStateEvent(EventType.RoomEncryption, MatrixClientPeg.safeGet()) &&
        !isLocalRoom
    ) {
        subButton = (
            <AccessibleButton kind="link_inline" onClick={openRoomSettings}>
                {_t("room|intro|enable_encryption_prompt")}
            </AccessibleButton>
        );
    }

    const subtitle = (
        <span>
            {" "}
            {subText} {subButton}{" "}
        </span>
    );

    return (
        <li className="mx_NewRoomIntro">
            {!hasExpectedEncryptionSettings(cli, room) && (
                <EventTileBubble
                    className="mx_cryptoEvent mx_cryptoEvent_icon_warning"
                    title={_t("room|intro|unencrypted_warning")}
                    subtitle={subtitle}
                />
            )}

            {body}
        </li>
    );
};

export default NewRoomIntro;
