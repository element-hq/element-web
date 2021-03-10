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

import React, {useMemo, useRef, useState} from "react";
import Room from "matrix-js-sdk/src/models/room";
import MatrixEvent from "matrix-js-sdk/src/models/event";
import {EventType, RoomType} from "matrix-js-sdk/src/@types/event";

import {MatrixClientPeg} from "../../MatrixClientPeg";
import dis from "../../dispatcher/dispatcher";
import {_t} from "../../languageHandler";
import AccessibleButton from "../views/elements/AccessibleButton";
import BaseDialog from "../views/dialogs/BaseDialog";
import FormButton from "../views/elements/FormButton";
import SearchBox from "./SearchBox";
import RoomAvatar from "../views/avatars/RoomAvatar";
import RoomName from "../views/elements/RoomName";
import {useAsyncMemo} from "../../hooks/useAsyncMemo";
import {shouldShowSpaceSettings} from "../../utils/space";
import {EnhancedMap} from "../../utils/maps";
import StyledCheckbox from "../views/elements/StyledCheckbox";
import AutoHideScrollbar from "./AutoHideScrollbar";
import BaseAvatar from "../views/avatars/BaseAvatar";

interface IProps {
    space: Room;
    initialText?: string;
    onFinished(): void;
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

interface ISubspaceProps {
    space: ISpaceSummaryRoom;
    event?: MatrixEvent;
    editing?: boolean;
    onPreviewClick?(): void;
    queueAction?(action: IAction): void;
    onJoinClick?(): void;
}

const SubSpace: React.FC<ISubspaceProps> = ({
    space,
    editing,
    event,
    queueAction,
    onJoinClick,
    onPreviewClick,
    children,
}) => {
    const name = space.name || space.canonical_alias || space.aliases?.[0] || _t("Unnamed Space");

    const evContent = event?.getContent();
    const [suggested, _setSuggested] = useState(evContent?.suggested);
    const [removed, _setRemoved] = useState(!evContent?.via);

    const cli = MatrixClientPeg.get();
    const cliRoom = cli.getRoom(space.room_id);
    const myMembership = cliRoom?.getMyMembership();

    // TODO DRY code
    let actions;
    if (editing && queueAction) {
        if (event && cli.getRoom(event.getRoomId())?.currentState.maySendStateEvent(event.getType(), cli.getUserId())) {
            const setSuggested = () => {
                _setSuggested(v => {
                    queueAction({
                        event,
                        removed,
                        suggested: !v,
                    });
                    return !v;
                });
            };

            const setRemoved = () => {
                _setRemoved(v => {
                    queueAction({
                        event,
                        removed: !v,
                        suggested,
                    });
                    return !v;
                });
            };

            if (removed) {
                actions = <React.Fragment>
                    <FormButton kind="danger" onClick={setRemoved} label={_t("Undo")} />
                </React.Fragment>;
            } else {
                actions = <React.Fragment>
                    <FormButton kind="danger" onClick={setRemoved} label={_t("Remove from Space")} />
                    <StyledCheckbox checked={suggested} onChange={setSuggested} />
                </React.Fragment>;
            }
        } else {
            actions = <span className="mx_SpaceRoomDirectory_actionsText">
                { _t("No permissions")}
            </span>;
        }
        // TODO confirm remove from space click behaviour here
    } else {
        if (myMembership === "join") {
            actions = <span className="mx_SpaceRoomDirectory_actionsText">
                { _t("You're in this space")}
            </span>;
        } else if (onJoinClick) {
            actions = <React.Fragment>
                <AccessibleButton onClick={onPreviewClick} kind="link">
                    { _t("Preview") }
                </AccessibleButton>
                <FormButton onClick={onJoinClick} label={_t("Join")} />
            </React.Fragment>
        }
    }

    let url: string;
    if (space.avatar_url) {
        url = MatrixClientPeg.get().mxcUrlToHttp(
            space.avatar_url,
            Math.floor(24 * window.devicePixelRatio),
            Math.floor(24 * window.devicePixelRatio),
            "crop",
        );
    }

    return <div className="mx_SpaceRoomDirectory_subspace">
        <div className="mx_SpaceRoomDirectory_subspace_info">
            <BaseAvatar name={name} idName={space.room_id} url={url} width={24} height={24} />
            { name }

            <div className="mx_SpaceRoomDirectory_actions">
                { actions }
            </div>
        </div>
        <div className="mx_SpaceRoomDirectory_subspace_children">
            { children }
        </div>
    </div>
};

interface IAction {
    event: MatrixEvent;
    suggested: boolean;
    removed: boolean;
}

interface IRoomTileProps {
    room: ISpaceSummaryRoom;
    event?: MatrixEvent;
    editing?: boolean;
    onPreviewClick(): void;
    queueAction?(action: IAction): void;
    onJoinClick?(): void;
}

const RoomTile = ({ room, event, editing, queueAction, onPreviewClick, onJoinClick }: IRoomTileProps) => {
    const name = room.name || room.canonical_alias || room.aliases?.[0] || _t("Unnamed Room");

    const evContent = event?.getContent();
    const [suggested, _setSuggested] = useState(evContent?.suggested);
    const [removed, _setRemoved] = useState(!evContent?.via);

    const cli = MatrixClientPeg.get();
    const cliRoom = cli.getRoom(room.room_id);
    const myMembership = cliRoom?.getMyMembership();

    let actions;
    if (editing && queueAction) {
        if (event && cli.getRoom(event.getRoomId())?.currentState.maySendStateEvent(event.getType(), cli.getUserId())) {
            const setSuggested = () => {
                _setSuggested(v => {
                    queueAction({
                        event,
                        removed,
                        suggested: !v,
                    });
                    return !v;
                });
            };

            const setRemoved = () => {
                _setRemoved(v => {
                    queueAction({
                        event,
                        removed: !v,
                        suggested,
                    });
                    return !v;
                });
            };

            if (removed) {
                actions = <React.Fragment>
                    <FormButton kind="danger" onClick={setRemoved} label={_t("Undo")} />
                </React.Fragment>;
            } else {
                actions = <React.Fragment>
                    <FormButton kind="danger" onClick={setRemoved} label={_t("Remove from Space")} />
                    <StyledCheckbox checked={suggested} onChange={setSuggested} />
                </React.Fragment>;
            }
        } else {
            actions = <span className="mx_SpaceRoomDirectory_actionsText">
                { _t("No permissions")}
            </span>;
        }
        // TODO confirm remove from space click behaviour here
    } else {
        if (myMembership === "join") {
            actions = <span className="mx_SpaceRoomDirectory_actionsText">
                { _t("You're in this room")}
            </span>;
        } else if (onJoinClick) {
            actions = <React.Fragment>
                <AccessibleButton onClick={onPreviewClick} kind="link">
                    { _t("Preview") }
                </AccessibleButton>
                <FormButton onClick={onJoinClick} label={_t("Join")} />
            </React.Fragment>
        }
    }

    let url: string;
    if (room.avatar_url) {
        url = cli.mxcUrlToHttp(
            room.avatar_url,
            Math.floor(32 * window.devicePixelRatio),
            Math.floor(32 * window.devicePixelRatio),
            "crop",
        );
    }

    const content = <React.Fragment>
        <BaseAvatar name={name} idName={room.room_id} url={url} width={32} height={32} />

        <div className="mx_SpaceRoomDirectory_roomTile_info">
            <div className="mx_SpaceRoomDirectory_roomTile_name">
                { name }
            </div>
            <div className="mx_SpaceRoomDirectory_roomTile_topic">
                { room.topic }
            </div>
        </div>
        <div className="mx_SpaceRoomDirectory_roomTile_memberCount">
            { room.num_joined_members }
        </div>

        <div className="mx_SpaceRoomDirectory_actions">
            { actions }
        </div>
    </React.Fragment>;

    if (editing) {
        return <div className="mx_SpaceRoomDirectory_roomTile">
            { content }
        </div>
    }

    return <AccessibleButton className="mx_SpaceRoomDirectory_roomTile" onClick={onPreviewClick}>
        { content }
    </AccessibleButton>;
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
    editing?: boolean;
    relations: EnhancedMap<string, string[]>;
    parents: Set<string>;
    queueAction?(action: IAction): void;
    onPreviewClick(roomId: string): void;
    onRemoveFromSpaceClick?(roomId: string): void;
    onJoinClick?(roomId: string): void;
}

export const HierarchyLevel = ({
    spaceId,
    rooms,
    editing,
    relations,
    parents,
    onPreviewClick,
    onJoinClick,
    queueAction,
}: IHierarchyLevelProps) => {
    const cli = MatrixClientPeg.get();
    const space = cli.getRoom(spaceId);
    // TODO respect order
    const [subspaces, childRooms] = relations.get(spaceId)?.reduce((result, roomId: string) => {
        if (!rooms.has(roomId)) return result; // TODO wat
        result[rooms.get(roomId).room_type === RoomType.Space ? 0 : 1].push(roomId);
        return result;
    }, [[], []]) || [[], []];

    // Don't render this subspace if it has no rooms we can show
    // TODO this is broken - as a space may have subspaces we still need to show
    // if (!childRooms.length) return null;

    const userId = cli.getUserId();

    const newParents = new Set(parents).add(spaceId);
    return <React.Fragment>
        {
            childRooms.map(roomId => (
                <RoomTile
                    key={roomId}
                    room={rooms.get(roomId)}
                    event={space?.currentState.maySendStateEvent(EventType.SpaceChild, userId)
                        ? space?.currentState.getStateEvents(EventType.SpaceChild, roomId)
                        : undefined}
                    editing={editing}
                    queueAction={queueAction}
                    onPreviewClick={() => {
                        onPreviewClick(roomId);
                    }}
                    onJoinClick={onJoinClick ? () => {
                        onJoinClick(roomId);
                    } : undefined}
                />
            ))
        }

        {
            subspaces.filter(roomId => !newParents.has(roomId)).map(roomId => (
                <SubSpace
                    key={roomId}
                    space={rooms.get(roomId)}
                    event={space?.currentState.getStateEvents(EventType.SpaceChild, roomId)}
                    editing={editing}
                    queueAction={queueAction}
                    onPreviewClick={() => {
                        onPreviewClick(roomId);
                    }}
                    onJoinClick={() => {
                        onJoinClick(roomId);
                    }}
                >
                    <HierarchyLevel
                        spaceId={roomId}
                        rooms={rooms}
                        editing={editing}
                        relations={relations}
                        parents={newParents}
                        onPreviewClick={onPreviewClick}
                        onJoinClick={onJoinClick}
                        queueAction={queueAction}
                    />
                </SubSpace>
            ))
        }
    </React.Fragment>
};

const SpaceRoomDirectory: React.FC<IProps> = ({ space, initialText = "", onFinished }) => {
    // TODO pagination
    const cli = MatrixClientPeg.get();
    const [query, setQuery] = useState(initialText);
    const [isEditing, setIsEditing] = useState(false);

    const onCreateRoomClick = () => {
        dis.dispatch({
            action: 'view_create_room',
            public: true,
        });
        onFinished();
    };

    // stored within a ref as we don't need to re-render when it changes
    const pendingActions = useRef(new Map<string, IAction>());

    let adminButton;
    if (shouldShowSpaceSettings(cli, space)) { // TODO this is an imperfect test
        const onManageButtonClicked = () => {
            setIsEditing(true);
        };

        const onSaveButtonClicked = () => {
            // TODO setBusy
            pendingActions.current.forEach(({event, suggested, removed}) => {
                const content = {
                    ...event.getContent(),
                    suggested,
                };

                if (removed) {
                    delete content["via"];
                }

                cli.sendStateEvent(event.getRoomId(), event.getType(), content, event.getStateKey());
            });
            setIsEditing(false);
        };

        if (isEditing) {
            adminButton = <React.Fragment>
                <FormButton label={_t("Save changes")} onClick={onSaveButtonClicked} />
                <span>{ _t("Promoted to users") }</span>
            </React.Fragment>;
        } else {
            adminButton = <FormButton label={_t("Manage rooms")} onClick={onManageButtonClicked} />;
        }
    }

    const [rooms, relations, viaMap] = useAsyncMemo(async () => {
        try {
            const data = await cli.getSpaceSummary(space.roomId);

            const parentChildRelations = new EnhancedMap<string, string[]>();
            const viaMap = new EnhancedMap<string, Set<string>>();
            data.events.map((ev: ISpaceSummaryEvent) => {
                if (ev.type === EventType.SpaceChild) {
                    parentChildRelations.getOrCreate(ev.room_id, []).push(ev.state_key);
                }
                if (Array.isArray(ev.content["via"])) {
                    const set = viaMap.getOrCreate(ev.state_key, new Set());
                    ev.content["via"].forEach(via => set.add(via));
                }
            });

            return [data.rooms, parentChildRelations, viaMap];
        } catch (e) {
            console.error(e); // TODO
        }

        return [];
    }, [space], []);

    const roomsMap = useMemo(() => {
        if (!rooms) return null;
        const lcQuery = query.toLowerCase();

        const filteredRooms = rooms.filter(r => {
            return r.room_type === RoomType.Space // always include spaces to allow filtering of sub-space rooms
                || r.name?.toLowerCase().includes(lcQuery)
                || r.topic?.toLowerCase().includes(lcQuery);
        });

        return new Map<string, ISpaceSummaryRoom>(filteredRooms.map(r => [r.room_id, r]));
        // const root = rooms.get(space.roomId);
    }, [rooms, query]);

    const title = <React.Fragment>
        <RoomAvatar room={space} height={40} width={40} />
        <div>
            <h1>{ _t("Explore rooms") }</h1>
            <div><RoomName room={space} /></div>
        </div>
    </React.Fragment>;
    const explanation =
        _t("If you can't find the room you're looking for, ask for an invite or <a>Create a new room</a>.", null,
            {a: sub => {
                return <AccessibleButton kind="link" onClick={onCreateRoomClick}>{sub}</AccessibleButton>;
            }},
        );

    let content;
    if (roomsMap) {
        content = <AutoHideScrollbar className="mx_SpaceRoomDirectory_list">
            <HierarchyLevel
                spaceId={space.roomId}
                rooms={roomsMap}
                editing={isEditing}
                relations={relations}
                parents={new Set()}
                queueAction={action => {
                    pendingActions.current.set(action.event.room_id, action);
                }}
                onPreviewClick={roomId => {
                    showRoom(roomsMap.get(roomId), Array.from(viaMap.get(roomId) || []), false);
                    onFinished();
                }}
                onJoinClick={(roomId) => {
                    showRoom(roomsMap.get(roomId), Array.from(viaMap.get(roomId) || []), true);
                    onFinished();
                }}
            />
        </AutoHideScrollbar>;
    }

    // TODO loading state/error state
    return (
        <BaseDialog className="mx_SpaceRoomDirectory" hasCancel={true} onFinished={onFinished} title={title}>
            <div className="mx_Dialog_content">
                { explanation }

                <SearchBox
                    className="mx_textinput_icon mx_textinput_search"
                    placeholder={ _t("Find a room...") }
                    onSearch={setQuery}
                />

                <div className="mx_SpaceRoomDirectory_listHeader">
                    { adminButton }
                </div>
                { content }
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
