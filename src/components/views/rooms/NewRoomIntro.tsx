/*
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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

import { EventType, ISendEventResponse, MatrixClient, Room, User } from "matrix-js-sdk/src/matrix";
import { MatrixClientPeg } from "matrix-react-sdk/src/MatrixClientPeg";
import RoomAvatar from "matrix-react-sdk/src/components/views/avatars/RoomAvatar";
import { RoomSettingsTab } from "matrix-react-sdk/src/components/views/dialogs/RoomSettingsDialog";
import AccessibleButton, { ButtonEvent } from "matrix-react-sdk/src/components/views/elements/AccessibleButton";
import MiniAvatarUploader, { AVATAR_SIZE } from "matrix-react-sdk/src/components/views/elements/MiniAvatarUploader";
import EventTileBubble from "matrix-react-sdk/src/components/views/messages/EventTileBubble";
import MatrixClientContext from "matrix-react-sdk/src/contexts/MatrixClientContext";
import RoomContext from "matrix-react-sdk/src/contexts/RoomContext";
import { shouldShowComponent } from "matrix-react-sdk/src/customisations/helpers/UIComponents";
import { Action } from "matrix-react-sdk/src/dispatcher/actions";
import defaultDispatcher from "matrix-react-sdk/src/dispatcher/dispatcher";
import { ViewUserPayload } from "matrix-react-sdk/src/dispatcher/payloads/ViewUserPayload";
import { TranslationKey, _t, _td } from "matrix-react-sdk/src/languageHandler";
import { LocalRoom } from "matrix-react-sdk/src/models/LocalRoom";
import { UIComponent } from "matrix-react-sdk/src/settings/UIFeature";
import SpaceStore from "matrix-react-sdk/src/stores/spaces/SpaceStore";
import DMRoomMap from "matrix-react-sdk/src/utils/DMRoomMap";
import { shouldEncryptRoomWithSingle3rdPartyInvite } from "matrix-react-sdk/src/utils/room/shouldEncryptRoomWithSingle3rdPartyInvite";
import { privateShouldBeEncrypted } from "matrix-react-sdk/src/utils/rooms";
import { showSpaceInvite } from "matrix-react-sdk/src/utils/space";
import React, { useContext } from "react";

import { getRoomName } from "../../../hooks/useRoomName";
import RoomName from "../elements/RoomName";

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
    const { room, roomId } = useContext(RoomContext);

    if (!room || !roomId) {
        throw new Error("Unable to create a NewRoomIntro without room and roomId");
    }

    const isLocalRoom = room instanceof LocalRoom;
    const dmPartner = isLocalRoom ? room.targets[0]?.userId : DMRoomMap.shared().getUserIdForRoomId(roomId);

    const onSendHelloClick = (): void => {
        if (!dmPartner) return;
        cli.sendEvent(roomId, EventType.RoomMessage, {
            body: "👋",
            msgtype: "m.text",
        });
    };

    const sendHelloButton = !room.getLastActiveTimestamp() && (
        <AccessibleButton
            kind="primary_outline"
            onClick={onSendHelloClick}
            style={{ marginTop: "5px", fontSize: "30px" }}
        >
            👋
        </AccessibleButton>
    );

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
                    onClick={(): void => {
                        defaultDispatcher.dispatch<ViewUserPayload>({
                            action: Action.ViewUser,
                            // XXX: We should be using a real member object and not assuming what the receiver wants.
                            member: member || ({ userId: dmPartner } as User),
                        });
                    }}
                />

                <h2>
                    <RoomName room={room} />
                </h2>

                <p>
                    {_t(
                        introMessage,
                        {},
                        {
                            displayName: () => <b>{displayName}</b>,
                        },
                    )}
                </p>
                {caption && <p>{caption}</p>}
                {sendHelloButton}
            </React.Fragment>
        );
    } else {
        const inRoom = room && room.getMyMembership() === "join";
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
            setImmediate(() => {
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
                        onClick={(): void => {
                            showSpaceInvite(parentSpace!);
                        }}
                    >
                        {_t("invite|to_space", { spaceName: parentSpace.name })}
                    </AccessibleButton>
                    {room.canInvite(cli.getSafeUserId()) && (
                        <AccessibleButton
                            className="mx_NewRoomIntro_inviteButton"
                            kind="primary_outline"
                            onClick={(): void => {
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
                        onClick={(): void => {
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
                    setAvatarUrl={(url): Promise<ISendEventResponse> =>
                        cli.sendStateEvent(roomId, EventType.RoomAvatar, { url }, "")
                    }
                >
                    {avatar}
                </MiniAvatarUploader>
            );
        }

        body = (
            <React.Fragment>
                {avatar}

                <h2>
                    <RoomName room={room} />
                </h2>

                <p>
                    {createdText}{" "}
                    {_t(
                        "room|intro|start_of_room",
                        {},
                        {
                            roomName: () => <b>{getRoomName(room)}</b>,
                        },
                    )}
                </p>
                <p>{topicText}</p>
                {buttons}
                {sendHelloButton}
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
