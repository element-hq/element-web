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

import React, { useEffect, useMemo, useState } from "react";
import classnames from "classnames";
import { IContent, MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { ILocationContent, LocationAssetType, M_TIMESTAMP } from "matrix-js-sdk/src/@types/location";
import { makeLocationContent } from "matrix-js-sdk/src/content-helpers";
import { M_BEACON } from "matrix-js-sdk/src/@types/beacon";

import { _t } from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import { useSettingValue } from "../../../hooks/useSettings";
import { Layout } from "../../../settings/enums/Layout";
import BaseDialog from "./BaseDialog";
import { avatarUrlForUser } from "../../../Avatar";
import EventTile from "../rooms/EventTile";
import SearchBox from "../../structures/SearchBox";
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import { Alignment } from "../elements/Tooltip";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import { StaticNotificationState } from "../../../stores/notifications/StaticNotificationState";
import NotificationBadge from "../rooms/NotificationBadge";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { sortRooms } from "../../../stores/room-list/algorithms/tag-sorting/RecentAlgorithm";
import QueryMatcher from "../../../autocomplete/QueryMatcher";
import TruncatedList from "../elements/TruncatedList";
import EntityTile from "../rooms/EntityTile";
import BaseAvatar from "../avatars/BaseAvatar";
import { Action } from "../../../dispatcher/actions";
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { ButtonEvent } from "../elements/AccessibleButton";
import { isLocationEvent } from "../../../utils/EventUtils";
import { isSelfLocation, locationEventGeoUri } from "../../../utils/location";
import { RoomContextDetails } from "../rooms/RoomContextDetails";
import { filterBoolean } from "../../../utils/arrays";

const AVATAR_SIZE = 30;

interface IProps {
    matrixClient: MatrixClient;
    // The event to forward
    event: MatrixEvent;
    // We need a permalink creator for the source room to pass through to EventTile
    // in case the event is a reply (even though the user can't get at the link)
    permalinkCreator: RoomPermalinkCreator;
    onFinished(): void;
}

interface IEntryProps {
    room: Room;
    type: EventType | string;
    content: IContent;
    matrixClient: MatrixClient;
    onFinished(success: boolean): void;
}

enum SendState {
    CanSend,
    Sending,
    Sent,
    Failed,
}

const Entry: React.FC<IEntryProps> = ({ room, type, content, matrixClient: cli, onFinished }) => {
    const [sendState, setSendState] = useState<SendState>(SendState.CanSend);

    const jumpToRoom = (ev: ButtonEvent): void => {
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: room.roomId,
            metricsTrigger: "WebForwardShortcut",
            metricsViaKeyboard: ev.type !== "click",
        });
        onFinished(true);
    };
    const send = async (): Promise<void> => {
        setSendState(SendState.Sending);
        try {
            await cli.sendEvent(room.roomId, type, content);
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
        if (!room.maySendMessage()) {
            disabled = true;
            title = _t("You don't have permission to do this");
        }
    } else if (sendState === SendState.Sending) {
        className = "mx_ForwardList_sending";
        disabled = true;
        title = _t("Sending");
        icon = <div className="mx_ForwardList_sendIcon" aria-label={title} />;
    } else if (sendState === SendState.Sent) {
        className = "mx_ForwardList_sent";
        disabled = true;
        title = _t("Sent");
        icon = <div className="mx_ForwardList_sendIcon" aria-label={title} />;
    } else {
        className = "mx_ForwardList_sendFailed";
        disabled = true;
        title = _t("Failed to send");
        icon = <NotificationBadge notification={StaticNotificationState.RED_EXCLAMATION} />;
    }

    return (
        <div className="mx_ForwardList_entry">
            <AccessibleTooltipButton
                className="mx_ForwardList_roomButton"
                onClick={jumpToRoom}
                title={_t("Open room")}
                alignment={Alignment.Top}
            >
                <DecoratedRoomAvatar room={room} avatarSize={32} />
                <span className="mx_ForwardList_entry_name">{room.name}</span>
                <RoomContextDetails component="span" className="mx_ForwardList_entry_detail" room={room} />
            </AccessibleTooltipButton>
            <AccessibleTooltipButton
                kind={sendState === SendState.Failed ? "danger_outline" : "primary_outline"}
                className={`mx_ForwardList_sendButton ${className}`}
                onClick={send}
                disabled={disabled}
                title={title}
                alignment={Alignment.Top}
            >
                <div className="mx_ForwardList_sendLabel">{_t("Send")}</div>
                {icon}
            </AccessibleTooltipButton>
        </div>
    );
};

const transformEvent = (event: MatrixEvent): { type: string; content: IContent } => {
    const {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        "m.relates_to": _, // strip relations - in future we will attach a relation pointing at the original event
        // We're taking a shallow copy here to avoid https://github.com/vector-im/element-web/issues/10924
        ...content
    } = event.getContent();

    // beacon pulses get transformed into static locations on forward
    const type = M_BEACON.matches(event.getType()) ? EventType.RoomMessage : event.getType();

    // self location shares should have their description removed
    // and become 'pin' share type
    if (
        (isLocationEvent(event) && isSelfLocation(content as ILocationContent)) ||
        // beacon pulses get transformed into static locations on forward
        M_BEACON.matches(event.getType())
    ) {
        const timestamp = M_TIMESTAMP.findIn<number>(content);
        const geoUri = locationEventGeoUri(event);
        return {
            type,
            content: {
                ...content,
                ...makeLocationContent(
                    undefined, // text
                    geoUri,
                    timestamp || Date.now(),
                    undefined, // description
                    LocationAssetType.Pin,
                ),
            },
        };
    }

    return { type, content };
};

const ForwardDialog: React.FC<IProps> = ({ matrixClient: cli, event, permalinkCreator, onFinished }) => {
    const userId = cli.getSafeUserId();
    const [profileInfo, setProfileInfo] = useState<any>({});
    useEffect(() => {
        cli.getProfileInfo(userId).then((info) => setProfileInfo(info));
    }, [cli, userId]);

    const { type, content } = transformEvent(event);

    // For the message preview we fake the sender as ourselves
    const mockEvent = new MatrixEvent({
        type: "m.room.message",
        sender: userId,
        content,
        unsigned: {
            age: 97,
        },
        event_id: "$9999999999999999999999999999999999999999999",
        room_id: event.getRoomId(),
    });
    mockEvent.sender = {
        name: profileInfo.displayname || userId,
        rawDisplayName: profileInfo.displayname,
        userId,
        getAvatarUrl: (..._) => {
            return avatarUrlForUser({ avatarUrl: profileInfo.avatar_url }, AVATAR_SIZE, AVATAR_SIZE, "crop");
        },
        getMxcAvatarUrl: () => profileInfo.avatar_url,
    } as RoomMember;

    const [query, setQuery] = useState("");
    const lcQuery = query.toLowerCase();

    const previewLayout = useSettingValue<Layout>("layout");
    const msc3946DynamicRoomPredecessors = useSettingValue<boolean>("feature_dynamic_room_predecessors");

    let rooms = useMemo(
        () =>
            sortRooms(
                cli
                    .getVisibleRooms(msc3946DynamicRoomPredecessors)
                    .filter((room) => room.getMyMembership() === "join" && !room.isSpaceRoom()),
            ),
        [cli, msc3946DynamicRoomPredecessors],
    );

    if (lcQuery) {
        rooms = new QueryMatcher<Room>(rooms, {
            keys: ["name"],
            funcs: [(r) => filterBoolean([r.getCanonicalAlias(), ...r.getAltAliases()])],
            shouldMatchWordsOnly: false,
        }).match(lcQuery);
    }

    const [truncateAt, setTruncateAt] = useState(20);
    function overflowTile(overflowCount: number, totalCount: number): JSX.Element {
        const text = _t("and %(count)s others...", { count: overflowCount });
        return (
            <EntityTile
                className="mx_EntityTile_ellipsis"
                avatarJsx={
                    <BaseAvatar
                        url={require("../../../../res/img/ellipsis.svg").default}
                        name="..."
                        width={36}
                        height={36}
                    />
                }
                name={text}
                presenceState="online"
                suppressOnHover={true}
                onClick={() => setTruncateAt(totalCount)}
            />
        );
    }

    return (
        <BaseDialog
            title={_t("Forward message")}
            className="mx_ForwardDialog"
            contentId="mx_ForwardList"
            onFinished={onFinished}
            fixedWidth={false}
        >
            <h3>{_t("Message preview")}</h3>
            <div
                className={classnames("mx_ForwardDialog_preview", {
                    mx_IRCLayout: previewLayout == Layout.IRC,
                })}
            >
                <EventTile
                    mxEvent={mockEvent}
                    layout={previewLayout}
                    permalinkCreator={permalinkCreator}
                    as="div"
                    inhibitInteraction
                />
            </div>
            <hr />
            <div className="mx_ForwardList" id="mx_ForwardList">
                <SearchBox
                    className="mx_textinput_icon mx_textinput_search"
                    placeholder={_t("Search for rooms or people")}
                    onSearch={setQuery}
                    autoFocus={true}
                />
                <AutoHideScrollbar className="mx_ForwardList_content">
                    {rooms.length > 0 ? (
                        <div className="mx_ForwardList_results">
                            <TruncatedList
                                className="mx_ForwardList_resultsList"
                                truncateAt={truncateAt}
                                createOverflowElement={overflowTile}
                                getChildren={(start, end) =>
                                    rooms
                                        .slice(start, end)
                                        .map((room) => (
                                            <Entry
                                                key={room.roomId}
                                                room={room}
                                                type={type}
                                                content={content}
                                                matrixClient={cli}
                                                onFinished={onFinished}
                                            />
                                        ))
                                }
                                getChildCount={() => rooms.length}
                            />
                        </div>
                    ) : (
                        <span className="mx_ForwardList_noResults">{_t("No results")}</span>
                    )}
                </AutoHideScrollbar>
            </div>
        </BaseDialog>
    );
};

export default ForwardDialog;
