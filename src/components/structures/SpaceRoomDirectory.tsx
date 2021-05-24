/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, {ReactNode, useMemo, useState} from "react";
import {Room} from "matrix-js-sdk/src/models/room";
import {MatrixClient} from "matrix-js-sdk/src/client";
import {EventType, RoomType} from "matrix-js-sdk/src/@types/event";
import classNames from "classnames";
import {sortBy} from "lodash";

import {MatrixClientPeg} from "../../MatrixClientPeg";
import dis from "../../dispatcher/dispatcher";
import {_t} from "../../languageHandler";
import AccessibleButton, {ButtonEvent} from "../views/elements/AccessibleButton";
import BaseDialog from "../views/dialogs/BaseDialog";
import Spinner from "../views/elements/Spinner";
import SearchBox from "./SearchBox";
import RoomAvatar from "../views/avatars/RoomAvatar";
import RoomName from "../views/elements/RoomName";
import {useAsyncMemo} from "../../hooks/useAsyncMemo";
import {EnhancedMap} from "../../utils/maps";
import StyledCheckbox from "../views/elements/StyledCheckbox";
import AutoHideScrollbar from "./AutoHideScrollbar";
import BaseAvatar from "../views/avatars/BaseAvatar";
import {mediaFromMxc} from "../../customisations/Media";
import InfoTooltip from "../views/elements/InfoTooltip";
import TextWithTooltip from "../views/elements/TextWithTooltip";
import {useStateToggle} from "../../hooks/useStateToggle";
import {getOrder} from "../../stores/SpaceStore";
import AccessibleTooltipButton from "../views/elements/AccessibleTooltipButton";
import {linkifyElement} from "../../HtmlUtils";

interface IHierarchyProps {
    space: Room;
    initialText?: string;
    refreshToken?: any;
    additionalButtons?: ReactNode;
    showRoom(room: ISpaceSummaryRoom, viaServers?: string[], autoJoin?: boolean): void;
}

/* eslint-disable camelcase */
export interface ISpaceSummaryRoom {
    canonical_alias?: string;
    aliases: string[];
    avatar_url?: string;
    guest_can_join: boolean;
    name?: string;
    num_joined_members: number
    room_id: string;
    topic?: string;
    world_readable: boolean;
    num_refs: number;
    room_type: string;
}

export interface ISpaceSummaryEvent {
    room_id: string;
    event_id: string;
    origin_server_ts: number;
    type: string;
    state_key: string;
    content: {
        order?: string;
        suggested?: boolean;
        auto_join?: boolean;
        via?: string;
    };
}
/* eslint-enable camelcase */

interface ITileProps {
    room: ISpaceSummaryRoom;
    suggested?: boolean;
    selected?: boolean;
    numChildRooms?: number;
    hasPermissions?: boolean;
    onViewRoomClick(autoJoin: boolean): void;
    onToggleClick?(): void;
}

const Tile: React.FC<ITileProps> = ({
    room,
    suggested,
    selected,
    hasPermissions,
    onToggleClick,
    onViewRoomClick,
    numChildRooms,
    children,
}) => {
    const name = room.name || room.canonical_alias || room.aliases?.[0]
        || (room.room_type === RoomType.Space ? _t("Unnamed Space") : _t("Unnamed Room"));

    const [showChildren, toggleShowChildren] = useStateToggle(true);

    const cli = MatrixClientPeg.get();
    const cliRoom = cli.getRoom(room.room_id);
    const myMembership = cliRoom?.getMyMembership();

    const onPreviewClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        onViewRoomClick(false);
    }
    const onJoinClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        onViewRoomClick(true);
    }

    let button;
    if (myMembership === "join") {
        button = <AccessibleButton onClick={onPreviewClick} kind="primary_outline">
            { _t("View") }
        </AccessibleButton>;
    } else if (onJoinClick) {
        button = <AccessibleButton onClick={onJoinClick} kind="primary">
            { _t("Join") }
        </AccessibleButton>;
    }

    let checkbox;
    if (onToggleClick) {
        if (hasPermissions) {
            checkbox = <StyledCheckbox checked={!!selected} onChange={onToggleClick} />;
        } else {
            checkbox = <TextWithTooltip
                tooltip={_t("You don't have permission")}
                onClick={ev => { ev.stopPropagation() }}
            >
                <StyledCheckbox disabled={true} />
            </TextWithTooltip>;
        }
    }

    let url: string;
    if (room.avatar_url) {
        url = mediaFromMxc(room.avatar_url).getSquareThumbnailHttp(20);
    }

    let description = _t("%(count)s members", { count: room.num_joined_members });
    if (numChildRooms) {
        description += " · " + _t("%(count)s rooms", { count: numChildRooms });
    }
    if (room.topic) {
        description += " · " + room.topic;
    }

    let suggestedSection;
    if (suggested) {
        suggestedSection = <InfoTooltip tooltip={_t("This room is suggested as a good one to join")}>
            { _t("Suggested") }
        </InfoTooltip>;
    }

    const content = <React.Fragment>
        <BaseAvatar name={name} idName={room.room_id} url={url} width={20} height={20} />
        <div className="mx_SpaceRoomDirectory_roomTile_name">
            { name }
            { suggestedSection }
        </div>

        <div
            className="mx_SpaceRoomDirectory_roomTile_info"
            ref={e => e && linkifyElement(e)}
            onClick={ev => {
                // prevent clicks on links from bubbling up to the room tile
                if ((ev.target as HTMLElement).tagName === "A") {
                    ev.stopPropagation();
                }
            }}
        >
            { description }
        </div>
        <div className="mx_SpaceRoomDirectory_actions">
            { button }
            { checkbox }
        </div>
    </React.Fragment>;

    let childToggle;
    let childSection;
    if (children) {
        // the chevron is purposefully a div rather than a button as it should be ignored for a11y
        childToggle = <div
            className={classNames("mx_SpaceRoomDirectory_subspace_toggle", {
                mx_SpaceRoomDirectory_subspace_toggle_shown: showChildren,
            })}
            onClick={ev => {
                ev.stopPropagation();
                toggleShowChildren();
            }}
        />;
        if (showChildren) {
            childSection = <div className="mx_SpaceRoomDirectory_subspace_children">
                { children }
            </div>;
        }
    }

    return <>
        <AccessibleButton
            className={classNames("mx_SpaceRoomDirectory_roomTile", {
                mx_SpaceRoomDirectory_subspace: room.room_type === RoomType.Space,
            })}
            onClick={(hasPermissions && onToggleClick) ? onToggleClick : onPreviewClick}
        >
            { content }
            { childToggle }
        </AccessibleButton>
        { childSection }
    </>;
};

export const showRoom = (room: ISpaceSummaryRoom, viaServers?: string[], autoJoin = false) => {
    // Don't let the user view a room they won't be able to either peek or join:
    // fail earlier so they don't have to click back to the directory.
    if (MatrixClientPeg.get().isGuest()) {
        if (!room.world_readable && !room.guest_can_join) {
            dis.dispatch({ action: "require_registration" });
            return;
        }
    }

    const roomAlias = getDisplayAliasForRoom(room) || undefined;
    dis.dispatch({
        action: "view_room",
        auto_join: autoJoin,
        should_peek: true,
        _type: "room_directory", // instrumentation
        room_alias: roomAlias,
        room_id: room.room_id,
        via_servers: viaServers,
        oob_data: {
            avatarUrl: room.avatar_url,
            // XXX: This logic is duplicated from the JS SDK which would normally decide what the name is.
            name: room.name || roomAlias || _t("Unnamed room"),
        },
    });
};

interface IHierarchyLevelProps {
    spaceId: string;
    rooms: Map<string, ISpaceSummaryRoom>;
    relations: Map<string, Map<string, ISpaceSummaryEvent>>;
    parents: Set<string>;
    selectedMap?: Map<string, Set<string>>;
    onViewRoomClick(roomId: string, autoJoin: boolean): void;
    onToggleClick?(parentId: string, childId: string): void;
}

export const HierarchyLevel = ({
    spaceId,
    rooms,
    relations,
    parents,
    selectedMap,
    onViewRoomClick,
    onToggleClick,
}: IHierarchyLevelProps) => {
    const cli = MatrixClientPeg.get();
    const space = cli.getRoom(spaceId);
    const hasPermissions = space?.currentState.maySendStateEvent(EventType.SpaceChild, cli.getUserId());

    const children = Array.from(relations.get(spaceId)?.values() || []);
    const sortedChildren = sortBy(children, ev => {
        // XXX: Space Summary API doesn't give the child origin_server_ts but once it does we should use it for sorting
        return getOrder(ev.content.order, null, ev.state_key);
    });
    const [subspaces, childRooms] = sortedChildren.reduce((result, ev: ISpaceSummaryEvent) => {
        const roomId = ev.state_key;
        if (!rooms.has(roomId)) return result;
        result[rooms.get(roomId).room_type === RoomType.Space ? 0 : 1].push(roomId);
        return result;
    }, [[], []]) || [[], []];

    const newParents = new Set(parents).add(spaceId);
    return <React.Fragment>
        {
            childRooms.map(roomId => (
                <Tile
                    key={roomId}
                    room={rooms.get(roomId)}
                    suggested={relations.get(spaceId)?.get(roomId)?.content.suggested}
                    selected={selectedMap?.get(spaceId)?.has(roomId)}
                    onViewRoomClick={(autoJoin) => {
                        onViewRoomClick(roomId, autoJoin);
                    }}
                    hasPermissions={hasPermissions}
                    onToggleClick={onToggleClick ? () => onToggleClick(spaceId, roomId) : undefined}
                />
            ))
        }

        {
            subspaces.filter(roomId => !newParents.has(roomId)).map(roomId => (
                <Tile
                    key={roomId}
                    room={rooms.get(roomId)}
                    numChildRooms={Array.from(relations.get(roomId)?.values() || [])
                        .filter(ev => rooms.get(ev.state_key)?.room_type !== RoomType.Space).length}
                    suggested={relations.get(spaceId)?.get(roomId)?.content.suggested}
                    selected={selectedMap?.get(spaceId)?.has(roomId)}
                    onViewRoomClick={(autoJoin) => {
                        onViewRoomClick(roomId, autoJoin);
                    }}
                    hasPermissions={hasPermissions}
                    onToggleClick={onToggleClick ? () => onToggleClick(spaceId, roomId) : undefined}
                >
                    <HierarchyLevel
                        spaceId={roomId}
                        rooms={rooms}
                        relations={relations}
                        parents={newParents}
                        selectedMap={selectedMap}
                        onViewRoomClick={onViewRoomClick}
                        onToggleClick={onToggleClick}
                    />
                </Tile>
            ))
        }
    </React.Fragment>
};

// mutate argument refreshToken to force a reload
export const useSpaceSummary = (cli: MatrixClient, space: Room, refreshToken?: any): [
    null,
    ISpaceSummaryRoom[],
    Map<string, Map<string, ISpaceSummaryEvent>>?,
    Map<string, Set<string>>?,
    Map<string, Set<string>>?,
] | [Error] => {
    // TODO pagination
    return useAsyncMemo(async () => {
        try {
            const data = await cli.getSpaceSummary(space.roomId);

            const parentChildRelations = new EnhancedMap<string, Map<string, ISpaceSummaryEvent>>();
            const childParentRelations = new EnhancedMap<string, Set<string>>();
            const viaMap = new EnhancedMap<string, Set<string>>();
            data.events.map((ev: ISpaceSummaryEvent) => {
                if (ev.type === EventType.SpaceChild) {
                    parentChildRelations.getOrCreate(ev.room_id, new Map()).set(ev.state_key, ev);
                    childParentRelations.getOrCreate(ev.state_key, new Set()).add(ev.room_id);
                }
                if (Array.isArray(ev.content["via"])) {
                    const set = viaMap.getOrCreate(ev.state_key, new Set());
                    ev.content["via"].forEach(via => set.add(via));
                }
            });

            return [null, data.rooms as ISpaceSummaryRoom[], parentChildRelations, viaMap, childParentRelations];
        } catch (e) {
            console.error(e); // TODO
            return [e];
        }
    }, [space, refreshToken], [undefined]);
};

export const SpaceHierarchy: React.FC<IHierarchyProps> = ({
    space,
    initialText = "",
    showRoom,
    refreshToken,
    additionalButtons,
    children,
}) => {
    const cli = MatrixClientPeg.get();
    const userId = cli.getUserId();
    const [query, setQuery] = useState(initialText);

    const [selected, setSelected] = useState(new Map<string, Set<string>>()); // Map<parentId, Set<childId>>

    const [summaryError, rooms, parentChildMap, viaMap, childParentMap] = useSpaceSummary(cli, space, refreshToken);

    const roomsMap = useMemo(() => {
        if (!rooms) return null;
        const lcQuery = query.toLowerCase().trim();

        const roomsMap = new Map<string, ISpaceSummaryRoom>(rooms.map(r => [r.room_id, r]));
        if (!lcQuery) return roomsMap;

        const directMatches = rooms.filter(r => {
            return r.name?.toLowerCase().includes(lcQuery) || r.topic?.toLowerCase().includes(lcQuery);
        });

        // Walk back up the tree to find all parents of the direct matches to show their place in the hierarchy
        const visited = new Set<string>();
        const queue = [...directMatches.map(r => r.room_id)];
        while (queue.length) {
            const roomId = queue.pop();
            visited.add(roomId);
            childParentMap.get(roomId)?.forEach(parentId => {
                if (!visited.has(parentId)) {
                    queue.push(parentId);
                }
            });
        }

        // Remove any mappings for rooms which were not visited in the walk
        Array.from(roomsMap.keys()).forEach(roomId => {
            if (!visited.has(roomId)) {
                roomsMap.delete(roomId);
            }
        });
        return roomsMap;
    }, [rooms, childParentMap, query]);

    const [error, setError] = useState("");
    const [removing, setRemoving] = useState(false);
    const [saving, setSaving] = useState(false);

    if (summaryError) {
        return <p>{_t("Your server does not support showing space hierarchies.")}</p>;
    }

    let content;
    if (roomsMap) {
        const numRooms = Array.from(roomsMap.values()).filter(r => r.room_type !== RoomType.Space).length;
        const numSpaces = roomsMap.size - numRooms - 1; // -1 at the end to exclude the space we are looking at

        let countsStr;
        if (numSpaces > 1) {
            countsStr = _t("%(count)s rooms and %(numSpaces)s spaces", { count: numRooms, numSpaces });
        } else if (numSpaces > 0) {
            countsStr = _t("%(count)s rooms and 1 space", { count: numRooms, numSpaces });
        } else {
            countsStr = _t("%(count)s rooms", { count: numRooms, numSpaces });
        }

        let manageButtons;
        if (space.getMyMembership() === "join" && space.currentState.maySendStateEvent(EventType.SpaceChild, userId)) {
            const selectedRelations = Array.from(selected.keys()).flatMap(parentId => {
                return [...selected.get(parentId).values()].map(childId => [parentId, childId]) as [string, string][];
            });

            const selectionAllSuggested = selectedRelations.every(([parentId, childId]) => {
                return parentChildMap.get(parentId)?.get(childId)?.content.suggested;
            });

            const disabled = !selectedRelations.length || removing || saving;

            let Button: React.ComponentType<React.ComponentProps<typeof AccessibleButton>> = AccessibleButton;
            let props = {};
            if (!selectedRelations.length) {
                Button = AccessibleTooltipButton;
                props = {
                    tooltip: _t("Select a room below first"),
                    yOffset: -40,
                };
            }

            manageButtons = <>
                <Button
                    {...props}
                    onClick={async () => {
                        setRemoving(true);
                        try {
                            for (const [parentId, childId] of selectedRelations) {
                                await cli.sendStateEvent(parentId, EventType.SpaceChild, {}, childId);
                                parentChildMap.get(parentId).delete(childId);
                                if (parentChildMap.get(parentId).size > 0) {
                                    parentChildMap.set(parentId, new Map(parentChildMap.get(parentId)));
                                } else {
                                    parentChildMap.delete(parentId);
                                }
                            }
                        } catch (e) {
                            setError(_t("Failed to remove some rooms. Try again later"));
                        }
                        setRemoving(false);
                    }}
                    kind="danger_outline"
                    disabled={disabled}
                >
                    { removing ? _t("Removing...") : _t("Remove") }
                </Button>
                <Button
                    {...props}
                    onClick={async () => {
                        setSaving(true);
                        try {
                            for (const [parentId, childId] of selectedRelations) {
                                const suggested = !selectionAllSuggested;
                                const existingContent = parentChildMap.get(parentId)?.get(childId)?.content;
                                if (!existingContent || existingContent.suggested === suggested) continue;

                                const content = {
                                    ...existingContent,
                                    suggested: !selectionAllSuggested,
                                };

                                await cli.sendStateEvent(parentId, EventType.SpaceChild, content, childId);

                                parentChildMap.get(parentId).get(childId).content = content;
                                parentChildMap.set(parentId, new Map(parentChildMap.get(parentId)));
                            }
                        } catch (e) {
                            setError("Failed to update some suggestions. Try again later");
                        }
                        setSaving(false);
                    }}
                    kind="primary_outline"
                    disabled={disabled}
                >
                    { saving
                        ? _t("Saving...")
                        : (selectionAllSuggested ? _t("Mark as not suggested") : _t("Mark as suggested"))
                    }
                </Button>
            </>;
        }

        let results;
        if (roomsMap.size) {
            const hasPermissions = space?.currentState.maySendStateEvent(EventType.SpaceChild, cli.getUserId());

            results = <>
                <HierarchyLevel
                    spaceId={space.roomId}
                    rooms={roomsMap}
                    relations={parentChildMap}
                    parents={new Set()}
                    selectedMap={selected}
                    onToggleClick={hasPermissions ? (parentId, childId) => {
                        setError("");
                        if (!selected.has(parentId)) {
                            setSelected(new Map(selected.set(parentId, new Set([childId]))));
                            return;
                        }

                        const parentSet = selected.get(parentId);
                        if (!parentSet.has(childId)) {
                            setSelected(new Map(selected.set(parentId, new Set([...parentSet, childId]))));
                            return;
                        }

                        parentSet.delete(childId);
                        setSelected(new Map(selected.set(parentId, new Set(parentSet))));
                    } : undefined}
                    onViewRoomClick={(roomId, autoJoin) => {
                        showRoom(roomsMap.get(roomId), Array.from(viaMap.get(roomId) || []), autoJoin);
                    }}
                />
                { children && <hr /> }
            </>;
        } else {
            results = <div className="mx_SpaceRoomDirectory_noResults">
                <h3>{ _t("No results found") }</h3>
                <div>{ _t("You may want to try a different search or check for typos.") }</div>
            </div>;
        }

        content = <>
            <div className="mx_SpaceRoomDirectory_listHeader">
                { countsStr }
                <span>
                    { additionalButtons }
                    { manageButtons }
                </span>
            </div>
            { error && <div className="mx_SpaceRoomDirectory_error">
                { error }
            </div> }
            <AutoHideScrollbar className="mx_SpaceRoomDirectory_list">
                { results }
                { children }
            </AutoHideScrollbar>
        </>;
    } else {
        content = <Spinner />;
    }

    // TODO loading state/error state
    return <>
        <SearchBox
            className="mx_textinput_icon mx_textinput_search"
            placeholder={ _t("Search names and descriptions") }
            onSearch={setQuery}
            autoFocus={true}
            initialValue={initialText}
        />

        { content }
    </>;
};

interface IProps {
    space: Room;
    initialText?: string;
    onFinished(): void;
}

const SpaceRoomDirectory: React.FC<IProps> = ({ space, onFinished, initialText }) => {
    const onCreateRoomClick = () => {
        dis.dispatch({
            action: 'view_create_room',
            public: true,
        });
        onFinished();
    };

    const title = <React.Fragment>
        <RoomAvatar room={space} height={32} width={32} />
        <div>
            <h1>{ _t("Explore rooms") }</h1>
            <div><RoomName room={space} /></div>
        </div>
    </React.Fragment>;

    return (
        <BaseDialog className="mx_SpaceRoomDirectory" hasCancel={true} onFinished={onFinished} title={title}>
            <div className="mx_Dialog_content">
                { _t("If you can't find the room you're looking for, ask for an invite or <a>create a new room</a>.",
                    null,
                    {a: sub => {
                        return <AccessibleButton kind="link" onClick={onCreateRoomClick}>{sub}</AccessibleButton>;
                    }},
                ) }

                <SpaceHierarchy
                    space={space}
                    showRoom={(room: ISpaceSummaryRoom, viaServers?: string[], autoJoin = false) => {
                        showRoom(room, viaServers, autoJoin);
                        onFinished();
                    }}
                    initialText={initialText}
                >
                    <AccessibleButton
                        onClick={onCreateRoomClick}
                        kind="primary"
                        className="mx_SpaceRoomDirectory_createRoom"
                    >
                        { _t("Create room") }
                    </AccessibleButton>
                </SpaceHierarchy>
            </div>
        </BaseDialog>
    );
};

export default SpaceRoomDirectory;

// Similar to matrix-react-sdk's MatrixTools.getDisplayAliasForRoom
// but works with the objects we get from the public room list
function getDisplayAliasForRoom(room: ISpaceSummaryRoom) {
    return room.canonical_alias || (room.aliases ? room.aliases[0] : "");
}
