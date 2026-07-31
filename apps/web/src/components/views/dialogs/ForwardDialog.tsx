/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Robin Townsend <robin@robin.town>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useEffect, useMemo, useState } from "react";
import classnames from "classnames";
import {
    MatrixEvent,
    type Room,
    type RoomMember,
    EventType,
    type MatrixClient,
    ContentHelpers,
    type ILocationContent,
    LocationAssetType,
    M_TIMESTAMP,
    M_BEACON,
    M_POLL_START,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { CheckCircleIcon, CircleIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { AutoHideScrollbar } from "@element-hq/web-shared-components";

import { _t } from "../../../languageHandler";
import { useSettingValue } from "../../../hooks/useSettings";
import { Layout } from "../../../settings/enums/Layout";
import BaseDialog from "./BaseDialog";
import { avatarUrlForUser } from "../../../Avatar";
import EventTile from "../rooms/EventTile";
import SearchBox from "../../structures/SearchBox";
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { sortRoomsByRecency } from "../../../utils/room/sortRoomsByRecency";
import QueryMatcher from "../../../autocomplete/QueryMatcher";
import TruncatedList from "../elements/TruncatedList";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";
import { isLocationEvent } from "../../../utils/EventUtils";
import { isSelfLocation, locationEventGeoUri } from "../../../utils/location";
import { RoomContextDetails } from "../rooms/RoomContextDetails";
import { filterBoolean } from "../../../utils/arrays";
import {
    type IState,
    RovingStateActionType,
    RovingTabIndexContext,
    RovingTabIndexProvider,
    useRovingTabIndex,
} from "../../../accessibility/RovingTabIndex";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { OverflowTileView } from "../rooms/OverflowTileView";
import { attachMentions } from "../../../utils/messages";
import { CommandPartCreator } from "../../../editor/parts";
import SettingsStore from "../../../settings/SettingsStore";
import { parseEvent } from "../../../editor/deserialize";
import EditorModel from "../../../editor/model";
import { copyForwardedMedia, getForwardedMediaUrl } from "../../../features/forward/ForwardedMedia";

const AVATAR_SIZE = 30;

interface IProps {
    matrixClient: MatrixClient;
    // The event to forward
    event: MatrixEvent;
    /** Events selected through the multi-message forwarding list. */
    events?: MatrixEvent[];
    // We need a permalink creator for the source room to pass through to EventTile
    // in case the event is a reply (even though the user can't get at the link)
    permalinkCreator: RoomPermalinkCreator;
    onFinished(this: void): void;
}

interface ForwardItem {
    // Matrix event content is a discriminated union; the event type is only
    // known at runtime while forwarding arbitrary timeline events.
    type: any;
    content: any;
}

interface IEntryProps {
    room: Room;
    selected: boolean;
    onToggle(this: void, roomId: string): void;
}

const Entry: React.FC<IEntryProps> = ({ room, selected, onToggle }) => {
    const [onFocus, isActive, ref] = useRovingTabIndex<HTMLDivElement>();

    const jumpToRoom = (ev: ButtonEvent): void => {
        ev.preventDefault();
        onToggle(room.roomId);
    };
    const id = `mx_ForwardDialog_entry_${room.roomId}`;
    return (
        <div
            className={classnames("mx_ForwardList_entry", {
                mx_ForwardList_entry_active: isActive,
                mx_ForwardList_entry_selected: selected,
            })}
            aria-labelledby={`${id}_name`}
            aria-describedby={`${id}_send`}
            role="listitem"
            ref={ref}
            onFocus={onFocus}
            id={id}
        >
            <AccessibleButton
                className="mx_ForwardList_roomButton"
                onClick={jumpToRoom}
                title={_t("forward|open_room")}
                placement="top"
                tabIndex={isActive ? 0 : -1}
            >
                <DecoratedRoomAvatar room={room} size="32px" tooltipProps={{ tabIndex: isActive ? 0 : -1 }} />
                <span className="mx_ForwardList_entry_name" id={`${id}_name`}>
                    {room.name}
                </span>
                <RoomContextDetails component="span" className="mx_ForwardList_entry_detail" room={room} />
                {selected ? <CheckCircleIcon aria-label="已选中" /> : <CircleIcon aria-label="未选中" />}
            </AccessibleButton>
        </div>
    );
};

/**
 * Transform content of a MatrixEvent before forwarding:
 * 1. Strip all relations.
 * 2. Convert location events into a static pin-drop location share,
 *    and remove description from self-location shares.
 * 3. Parse the event back into an EditorModel and recalculate mentions.
 *
 * @param event - The MatrixEvent to transform.
 * @param cli - The MatrixClient (used for recalculation of mentions).
 * @returns The transformed event type and content.
 */
const transformEvent = (event: MatrixEvent, cli: MatrixClient): ForwardItem => {
    const {
        "m.relates_to": _, // strip relations - in future we will attach a relation pointing at the original event
        // We're taking a shallow copy here to avoid https://github.com/vector-im/element-web/issues/10924
        ...content
    } = event.getContent();

    // beacon pulses get transformed into static locations on forward
    const type = M_BEACON.matches(event.getType()) ? EventType.RoomMessage : event.getType();

    // These event types are not WYSIWYG messages. Retain the cleaned stable poll/sticker
    // content rather than parsing it through the composer and corrupting its event shape.
    if (M_POLL_START.matches(event.getType()) || event.getType() === EventType.Sticker) {
        return { type, content };
    }

    // self location shares should have their description removed
    // and become 'pin' share type
    if (
        (isLocationEvent(event) && isSelfLocation(content as ILocationContent)) ||
        // beacon pulses get transformed into static locations on forward
        M_BEACON.matches(event.getType())
    ) {
        const timestamp = M_TIMESTAMP.findIn<number>(content as ILocationContent);
        const geoUri = locationEventGeoUri(event);
        return {
            type,
            content: {
                ...content,
                ...ContentHelpers.makeLocationContent(
                    undefined, // text
                    geoUri,
                    timestamp || Date.now(),
                    undefined, // description
                    LocationAssetType.Pin,
                ),
            },
        };
    }

    // Mentions can leak information about the context of the original message, so:
    // 1. Parse the event's message body back into an EditorModel, then
    // 2. Pass through attachMentions() to recalculate mentions.
    const room = cli.getRoom(event.getRoomId())!;
    const partCreator = new CommandPartCreator(room, cli);
    const parts = parseEvent(event, partCreator, {
        shouldEscape: SettingsStore.getValue("MessageComposerInput.useMarkdown"),
    });
    const model = new EditorModel(parts, partCreator); // Temporary EditorModel to pass through
    const userId = cli.getSafeUserId();
    attachMentions(userId, content, model, undefined);

    return { type, content };
};

const ForwardDialog: React.FC<IProps> = ({ matrixClient: cli, event, events, permalinkCreator, onFinished }) => {
    const userId = cli.getSafeUserId();
    const [profileInfo, setProfileInfo] = useState<any>({});
    useEffect(() => {
        cli.getProfileInfo(userId).then((info) => setProfileInfo(info));
    }, [cli, userId]);

    const sourceEvents = events?.length ? events : [event];
    const items = sourceEvents.map((sourceEvent) => transformEvent(sourceEvent, cli));

    // For the message preview we fake each sender as ourselves.
    const mockEvents = items.map(({ type, content }, index) => {
        const sourceEvent = sourceEvents[index];
        const mockEvent = new MatrixEvent({
            type,
            sender: userId,
            content,
            unsigned: { age: 97 },
            event_id: `$9999999999999999999999999999999999999999999-${index}`,
            room_id: sourceEvent.getRoomId(),
            origin_server_ts: sourceEvent.getTs(),
        });
        mockEvent.sender = {
            name: profileInfo.displayname || userId,
            rawDisplayName: profileInfo.displayname,
            userId,
            getAvatarUrl: (..._) =>
                avatarUrlForUser({ avatarUrl: profileInfo.avatar_url }, AVATAR_SIZE, AVATAR_SIZE, "crop"),
            getMxcAvatarUrl: () => profileInfo.avatar_url,
        } as RoomMember;
        return mockEvent;
    });

    const [query, setQuery] = useState("");
    const lcQuery = query.toLowerCase();

    const previewLayout = useSettingValue("layout");
    const msc3946DynamicRoomPredecessors = useSettingValue("feature_dynamic_room_predecessors");

    const allRooms = useMemo(
        () =>
            sortRoomsByRecency(
                cli
                    .getVisibleRooms(msc3946DynamicRoomPredecessors)
                    .filter((room) => room.getMyMembership() === KnownMembership.Join && !room.isSpaceRoom()),
                cli.getSafeUserId(),
            ),
        [cli, msc3946DynamicRoomPredecessors],
    );

    const rooms = lcQuery
        ? new QueryMatcher<Room>(allRooms, {
              keys: ["name"],
              funcs: [(r) => filterBoolean([r.getCanonicalAlias(), ...r.getAltAliases()])],
              shouldMatchWordsOnly: false,
          }).match(lcQuery)
        : allRooms;

    const [truncateAt, setTruncateAt] = useState(20);
    const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
    const [sendingSelected, setSendingSelected] = useState(false);
    const [sendError, setSendError] = useState<string>();

    const toggleRoom = (roomId: string): void => {
        setSendError(undefined);
        setSelectedRoomIds((current) =>
            current.includes(roomId)
                ? current.filter((selectedRoomId) => selectedRoomId !== roomId)
                : [...current, roomId],
        );
    };

    const sendSelected = async (): Promise<void> => {
        // Keep previously selected rooms even when the user uses the search box
        // before pressing Send.
        const targetRooms = allRooms.filter((room) => selectedRoomIds.includes(room.roomId));
        if (!targetRooms.length || sendingSelected) return;
        setSendingSelected(true);
        setSendError(undefined);
        try {
            for (const room of targetRooms) {
                for (const { type, content } of items) {
                    const targetContent = getForwardedMediaUrl(content)
                        ? await copyForwardedMedia(cli, room, content)
                        : content;
                    await cli.sendEvent(room.roomId, type, targetContent);
                }
            }
            onFinished();
        } catch (cause) {
            setSendError(cause instanceof Error ? cause.message : "转发失败，请检查网络后重试");
        } finally {
            setSendingSelected(false);
        }
    };

    function overflowTile(overflowCount: number, totalCount: number): JSX.Element {
        return <OverflowTileView remaining={overflowCount} onClick={() => setTruncateAt(totalCount)} />;
    }

    const onKeyDown = (ev: React.KeyboardEvent, state: IState): void => {
        let handled = true;

        const action = getKeyBindingsManager().getAccessibilityAction(ev);
        switch (action) {
            case KeyBindingAction.Enter: {
                state.activeNode?.querySelector<HTMLButtonElement>(".mx_ForwardList_roomButton")?.click();
                break;
            }

            default:
                handled = false;
        }

        if (handled) {
            ev.preventDefault();
            ev.stopPropagation();
        }
    };

    return (
        <BaseDialog
            title={_t("common|forward_message")}
            className="mx_ForwardDialog"
            contentId="mx_ForwardList"
            onFinished={onFinished}
            fixedWidth={false}
        >
            <h3>{items.length === 1 ? _t("forward|message_preview_heading") : `将转发 ${items.length} 条消息`}</h3>
            <div
                className={classnames("mx_ForwardDialog_preview", {
                    mx_IRCLayout: previewLayout == Layout.IRC,
                })}
            >
                {mockEvents.map((mockEvent) => (
                    <EventTile
                        key={mockEvent.getId()}
                        mxEvent={mockEvent}
                        layout={previewLayout}
                        permalinkCreator={permalinkCreator}
                        as="div"
                        inhibitInteraction
                    />
                ))}
            </div>
            <hr />
            <RovingTabIndexProvider
                handleUpDown
                handleInputFields
                onKeyDown={onKeyDown}
                scrollIntoView={{ block: "center" }}
            >
                {({ onKeyDownHandler }) => (
                    <div className="mx_ForwardList" id="mx_ForwardList">
                        <RovingTabIndexContext.Consumer>
                            {(context) => (
                                <SearchBox
                                    className="mx_textinput_icon mx_textinput_search"
                                    placeholder={_t("forward|filter_placeholder")}
                                    onSearch={(query: string): void => {
                                        setQuery(query);
                                        setTimeout(() => {
                                            const node = context.state.nodes[0];
                                            if (node) {
                                                context.dispatch({
                                                    type: RovingStateActionType.SetFocus,
                                                    payload: { node },
                                                });
                                                node?.scrollIntoView?.({
                                                    block: "nearest",
                                                });
                                            }
                                        });
                                    }}
                                    autoFocus={true}
                                    onKeyDown={onKeyDownHandler}
                                    aria-activedescendant={context.state.activeNode?.id}
                                    aria-owns="mx_ForwardDialog_resultsList"
                                />
                            )}
                        </RovingTabIndexContext.Consumer>
                        <AutoHideScrollbar className="mx_AutoHideScrollbar mx_ForwardList_content">
                            {rooms.length > 0 ? (
                                <div className="mx_ForwardList_results">
                                    <TruncatedList
                                        id="mx_ForwardDialog_resultsList"
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
                                                        selected={selectedRoomIds.includes(room.roomId)}
                                                        onToggle={toggleRoom}
                                                    />
                                                ))
                                        }
                                        getChildCount={() => rooms.length}
                                    />
                                </div>
                            ) : (
                                <span className="mx_ForwardList_noResults">{_t("common|no_results")}</span>
                            )}
                        </AutoHideScrollbar>
                    </div>
                )}
            </RovingTabIndexProvider>
            <div className="mx_ForwardDialog_selectionFooter">
                <div className="mx_ForwardDialog_selectionStatus">
                    <span>
                        {selectedRoomIds.length ? `将转发到 ${selectedRoomIds.length} 个会话` : "请选择转发目标"}
                    </span>
                    {sendError && <span className="mx_ForwardDialog_selectionError">{sendError}</span>}
                </div>
                <div className="mx_ForwardDialog_selectionActions">
                    <AccessibleButton
                        kind="secondary"
                        onClick={() => setSelectedRoomIds([])}
                        disabled={!selectedRoomIds.length || sendingSelected}
                    >
                        取消选择
                    </AccessibleButton>
                    <AccessibleButton
                        kind="primary"
                        onClick={sendSelected}
                        disabled={!selectedRoomIds.length || sendingSelected}
                    >
                        {sendingSelected ? "正在转发…" : "开始转发"}
                    </AccessibleButton>
                </div>
            </div>
        </BaseDialog>
    );
};

export default ForwardDialog;
