/*
Copyright 2021 Robin Townsend <robin@robin.town>

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

import React, {useMemo, useState, useEffect} from "react";
import classnames from "classnames";
import {MatrixEvent} from "matrix-js-sdk/src/models/event";
import {Room} from "matrix-js-sdk/src/models/room";
import {MatrixClient} from "matrix-js-sdk/src/client";

import {_t} from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import {useSettingValue, useFeatureEnabled} from "../../../hooks/useSettings";
import {UIFeature} from "../../../settings/UIFeature";
import {Layout} from "../../../settings/Layout";
import {IDialogProps} from "./IDialogProps";
import BaseDialog from "./BaseDialog";
import {avatarUrlForUser} from "../../../Avatar";
import EventTile from "../rooms/EventTile";
import SearchBox from "../../structures/SearchBox";
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import {Alignment} from '../elements/Tooltip';
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import {StaticNotificationState} from "../../../stores/notifications/StaticNotificationState";
import NotificationBadge from "../rooms/NotificationBadge";
import {RoomPermalinkCreator} from "../../../utils/permalinks/Permalinks";
import {sortRooms} from "../../../stores/room-list/algorithms/tag-sorting/RecentAlgorithm";
import QueryMatcher from "../../../autocomplete/QueryMatcher";

const AVATAR_SIZE = 30;

interface IProps extends IDialogProps {
    matrixClient: MatrixClient;
    // The event to forward
    event: MatrixEvent;
    // We need a permalink creator for the source room to pass through to EventTile
    // in case the event is a reply (even though the user can't get at the link)
    permalinkCreator: RoomPermalinkCreator;
}

interface IEntryProps {
    room: Room;
    event: MatrixEvent;
    matrixClient: MatrixClient;
    onFinished(success: boolean): void;
}

enum SendState {
    CanSend,
    Sending,
    Sent,
    Failed,
}

const Entry: React.FC<IEntryProps> = ({ room, event, matrixClient: cli, onFinished }) => {
    const [sendState, setSendState] = useState<SendState>(SendState.CanSend);

    const jumpToRoom = () => {
        dis.dispatch({
            action: "view_room",
            room_id: room.roomId,
        });
        onFinished(true);
    };
    const send = async () => {
        setSendState(SendState.Sending);
        try {
            await cli.sendEvent(room.roomId, event.getType(), event.getContent());
            setSendState(SendState.Sent);
        } catch (e) {
            setSendState(SendState.Failed);
        }
    };

    let className;
    let disabled = false;
    let title;
    let icon;
    if (sendState === SendState.CanSend) {
        className = "mx_ForwardList_canSend";
        if (room.maySendMessage()) {
            title = _t("Send");
        } else {
            disabled = true;
            title = _t("You don't have permission to do this");
        }
    } else if (sendState === SendState.Sending) {
        className = "mx_ForwardList_sending";
        disabled = true;
        title = _t("Sending");
        icon = <div className="mx_ForwardList_sendIcon" aria-label={title}></div>;
    } else if (sendState === SendState.Sent) {
        className = "mx_ForwardList_sent";
        disabled = true;
        title = _t("Sent");
        icon = <div className="mx_ForwardList_sendIcon" aria-label={title}></div>;
    } else {
        className = "mx_ForwardList_sendFailed";
        disabled = true;
        title = _t("Failed to send");
        icon = <NotificationBadge
            notification={StaticNotificationState.RED_EXCLAMATION}
        />;
    }

    return <div className="mx_ForwardList_entry">
        <AccessibleTooltipButton
            className="mx_ForwardList_roomButton"
            onClick={jumpToRoom}
            title={_t("Open link")}
            yOffset={-20}
            alignment={Alignment.Top}
        >
            <DecoratedRoomAvatar room={room} avatarSize={32} />
            <span className="mx_ForwardList_entry_name">{ room.name }</span>
        </AccessibleTooltipButton>
        <AccessibleTooltipButton
            kind={sendState === SendState.Failed ? "danger_outline" : "primary_outline"}
            className={`mx_ForwardList_sendButton ${className}`}
            onClick={send}
            disabled={disabled}
            title={title}
            yOffset={-20}
            alignment={Alignment.Top}
        >
            <div className="mx_ForwardList_sendLabel">{ _t("Send") }</div>
            { icon }
        </AccessibleTooltipButton>
    </div>;
};

const ForwardDialog: React.FC<IProps> = ({ matrixClient: cli, event, permalinkCreator, onFinished }) => {
    const userId = cli.getUserId();
    const [profileInfo, setProfileInfo] = useState<any>({});
    useEffect(() => {
        cli.getProfileInfo(userId).then(info => setProfileInfo(info));
    }, [cli, userId]);

    // For the message preview we fake the sender as ourselves
    const mockEvent = new MatrixEvent({
        type: "m.room.message",
        sender: userId,
        content: event.getContent(),
        unsigned: {
            age: 97,
        },
        event_id: "$9999999999999999999999999999999999999999999",
        room_id: event.getRoomId(),
    });
    mockEvent.sender = {
        name: profileInfo.displayname || userId,
        userId,
        getAvatarUrl: (..._) => {
            return avatarUrlForUser(
                { avatarUrl: profileInfo.avatar_url },
                AVATAR_SIZE, AVATAR_SIZE, "crop",
            );
        },
        getMxcAvatarUrl: () => profileInfo.avatar_url,
    };

    const [query, setQuery] = useState("");
    const lcQuery = query.toLowerCase();

    const spacesEnabled = useFeatureEnabled("feature_spaces");
    const flairEnabled = useFeatureEnabled(UIFeature.Flair);
    const previewLayout = useSettingValue<Layout>("layout");

    let rooms = useMemo(() => sortRooms(
        cli.getVisibleRooms().filter(
            room => room.getMyMembership() === "join" &&
                !(spacesEnabled && room.isSpaceRoom()),
        ),
    ), [cli, spacesEnabled]);

    if (lcQuery) {
        rooms = new QueryMatcher<Room>(rooms, {
            keys: ["name"],
            funcs: [r => [r.getCanonicalAlias(), ...r.getAltAliases()].filter(Boolean)],
            shouldMatchWordsOnly: false,
        }).match(lcQuery);
    }

    return <BaseDialog
        title={_t("Forward message")}
        className="mx_ForwardDialog"
        contentId="mx_ForwardList"
        onFinished={onFinished}
        fixedWidth={false}
    >
        <h3>{ _t("Message preview") }</h3>
        <div className={classnames("mx_ForwardDialog_preview", {
            "mx_IRCLayout": previewLayout == Layout.IRC,
            "mx_GroupLayout": previewLayout == Layout.Group,
        })}>
            <EventTile
                mxEvent={mockEvent}
                layout={previewLayout}
                enableFlair={flairEnabled}
                permalinkCreator={permalinkCreator}
                as="div"
            />
        </div>
        <hr />
        <div className="mx_ForwardList" id="mx_ForwardList">
            <SearchBox
                className="mx_textinput_icon mx_textinput_search"
                placeholder={_t("Search for rooms or people")}
                onSearch={setQuery}
                autoComplete={true}
                autoFocus={true}
            />
            <AutoHideScrollbar className="mx_ForwardList_content">
                { rooms.length > 0 ? (
                    <div className="mx_ForwardList_results">
                        { rooms.map(room =>
                            <Entry
                                key={room.roomId}
                                room={room}
                                event={event}
                                matrixClient={cli}
                                onFinished={onFinished}
                            />,
                        ) }
                    </div>
                ) : <span className="mx_ForwardList_noResults">
                    { _t("No results") }
                </span> }
            </AutoHideScrollbar>
        </div>
    </BaseDialog>;
};

export default ForwardDialog;
