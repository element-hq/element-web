/*
Copyright 2024,2025 New Vector Ltd.
Copyright 2021-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    type JSX,
    type Dispatch,
    type KeyboardEvent,
    type KeyboardEventHandler,
    type ReactElement,
    type ReactNode,
    type SetStateAction,
    useCallback,
    useContext,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    type Room,
    RoomEvent,
    ClientEvent,
    type MatrixClient,
    MatrixError,
    EventType,
    RoomType,
    GuestAccess,
    HistoryVisibility,
    type HierarchyRelation,
    type HierarchyRoom,
    JoinRule,
} from "matrix-js-sdk/src/matrix";
import { RoomHierarchy } from "matrix-js-sdk/src/room-hierarchy";
import classNames from "classnames";
import { sortBy, uniqBy } from "lodash";
import { logger } from "matrix-js-sdk/src/logger";
import { KnownMembership, type SpaceChildEventContent } from "matrix-js-sdk/src/types";

import defaultDispatcher from "../../dispatcher/dispatcher";
import { _t } from "../../languageHandler";
import AccessibleButton, { type ButtonEvent } from "../views/elements/AccessibleButton";
import Spinner from "../views/elements/Spinner";
import SearchBox from "./SearchBox";
import RoomAvatar from "../views/avatars/RoomAvatar";
import StyledCheckbox from "../views/elements/StyledCheckbox";
import BaseAvatar from "../views/avatars/BaseAvatar";
import { mediaFromMxc } from "../../customisations/Media";
import InfoTooltip from "../views/elements/InfoTooltip";
import TextWithTooltip from "../views/elements/TextWithTooltip";
import { useStateToggle } from "../../hooks/useStateToggle";
import { getChildOrder } from "../../stores/spaces/SpaceStore";
import { Linkify, topicToHtml } from "../../HtmlUtils";
import { useDispatcher } from "../../hooks/useDispatcher";
import { Action } from "../../dispatcher/actions";
import { type IState, RovingTabIndexProvider, useRovingTabIndex } from "../../accessibility/RovingTabIndex";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import { useTypedEventEmitterState } from "../../hooks/useEventEmitter";
import { type IOOBData } from "../../stores/ThreepidInviteStore";
import { awaitRoomDownSync } from "../../utils/RoomUpgrade";
import { type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { type JoinRoomReadyPayload } from "../../dispatcher/payloads/JoinRoomReadyPayload";
import { KeyBindingAction } from "../../accessibility/KeyboardShortcuts";
import { getKeyBindingsManager } from "../../KeyBindingsManager";
import { getTopic } from "../../hooks/room/useTopic";
import { SdkContextClass } from "../../contexts/SDKContext";
import { getDisplayAliasForAliasSet } from "../../Rooms";
import SettingsStore from "../../settings/SettingsStore";

interface IProps {
    space: Room;
    initialText?: string;
    additionalButtons?: ReactNode;
    showRoom(cli: MatrixClient, hierarchy: RoomHierarchy, roomId: string, roomType?: RoomType): void;
}

interface ITileProps {
    room: HierarchyRoom;
    suggested?: boolean;
    selected?: boolean;
    numChildRooms?: number;
    hasPermissions?: boolean;
    children?: ReactNode;
    onViewRoomClick(): void;
    onJoinRoomClick(): Promise<unknown>;
    onToggleClick?(): void;
}

const Tile: React.FC<ITileProps> = ({
    room,
    suggested,
    selected,
    hasPermissions,
    onToggleClick,
    onViewRoomClick,
    onJoinRoomClick,
    numChildRooms,
    children,
}) => {
    const cli = useContext(MatrixClientContext);
    const joinedRoom = useTypedEventEmitterState(cli, ClientEvent.Room, () => {
        const cliRoom = cli?.getRoom(room.room_id);
        return cliRoom?.getMyMembership() === KnownMembership.Join ? cliRoom : undefined;
    });
    const joinedRoomName = useTypedEventEmitterState(joinedRoom, RoomEvent.Name, (room) => room?.name);
    const name =
        joinedRoomName ||
        room.name ||
        room.canonical_alias ||
        room.aliases?.[0] ||
        (room.room_type === RoomType.Space ? _t("common|unnamed_space") : _t("common|unnamed_room"));

    const [showChildren, toggleShowChildren] = useStateToggle(true);
    const [onFocus, isActive, ref, nodeRef] = useRovingTabIndex();
    const [busy, setBusy] = useState(false);
    const checkboxLabelId = useId();

    const onPreviewClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        onViewRoomClick();
    };
    const onJoinClick = async (ev: ButtonEvent): Promise<void> => {
        setBusy(true);
        ev.preventDefault();
        ev.stopPropagation();
        try {
            await onJoinRoomClick();
            await awaitRoomDownSync(cli, room.room_id);
        } finally {
            setBusy(false);
        }
    };

    let button: ReactElement;
    if (busy) {
        button = (
            <AccessibleButton
                disabled={true}
                onClick={onJoinClick}
                kind="primary_outline"
                onFocus={onFocus}
                tabIndex={isActive ? 0 : -1}
                title={_t("space|joining_space")}
            >
                <Spinner w={24} h={24} />
            </AccessibleButton>
        );
    } else if (joinedRoom || room.join_rule === JoinRule.Knock) {
        // If the room is knockable, show the "View" button even if we are not a member; that
        // allows us to reuse the "request to join" UX in RoomView.
        button = (
            <AccessibleButton
                onClick={onPreviewClick}
                kind="primary_outline"
                onFocus={onFocus}
                tabIndex={isActive ? 0 : -1}
            >
                {_t("action|view")}
            </AccessibleButton>
        );
    } else {
        button = (
            <AccessibleButton onClick={onJoinClick} kind="primary" onFocus={onFocus} tabIndex={isActive ? 0 : -1}>
                {_t("action|join")}
            </AccessibleButton>
        );
    }

    let checkbox: ReactElement | undefined;
    if (onToggleClick) {
        if (hasPermissions) {
            checkbox = (
                <StyledCheckbox
                    role="presentation"
                    aria-labelledby={checkboxLabelId}
                    checked={!!selected}
                    tabIndex={-1}
                />
            );
        } else {
            checkbox = (
                <TextWithTooltip
                    tooltip={_t("space|user_lacks_permission")}
                    onClick={(ev) => {
                        ev.stopPropagation();
                    }}
                >
                    <StyledCheckbox
                        role="presentation"
                        aria-labelledby={checkboxLabelId}
                        disabled={true}
                        tabIndex={-1}
                    />
                </TextWithTooltip>
            );
        }
    }

    let avatar: ReactElement;
    if (joinedRoom) {
        avatar = <RoomAvatar room={joinedRoom} size="20px" />;
    } else {
        avatar = (
            <BaseAvatar
                name={name}
                idName={room.room_id}
                url={room.avatar_url ? mediaFromMxc(room.avatar_url).getSquareThumbnailHttp(20) : null}
                size="20px"
            />
        );
    }

    let description = _t("common|n_members", { count: room.num_joined_members ?? 0 });
    if (numChildRooms !== undefined) {
        description += " · " + _t("common|n_rooms", { count: numChildRooms });
    }

    let topic: ReactNode | string | null;
    if (joinedRoom) {
        const topicObj = getTopic(joinedRoom);
        topic = topicToHtml(topicObj?.text, topicObj?.html);
    } else {
        topic = room.topic;
    }

    let topicSection: ReactNode | undefined;
    if (topic) {
        topicSection = (
            <Linkify
                options={{
                    attributes: {
                        onClick(ev: MouseEvent) {
                            // prevent clicks on links from bubbling up to the room tile
                            ev.stopPropagation();
                        },
                    },
                }}
            >
                {" · "}
                {topic}
            </Linkify>
        );
    }

    let joinedSection: ReactElement | undefined;
    if (joinedRoom) {
        joinedSection = <div className="mx_SpaceHierarchy_roomTile_joined">{_t("common|joined")}</div>;
    }

    let suggestedSection: ReactElement | undefined;
    if (suggested && (!joinedRoom || hasPermissions)) {
        suggestedSection = <InfoTooltip tooltip={_t("space|suggested_tooltip")}>{_t("space|suggested")}</InfoTooltip>;
    }

    const content = (
        <React.Fragment>
            <div className="mx_SpaceHierarchy_roomTile_item">
                <div className="mx_SpaceHierarchy_roomTile_avatar">{avatar}</div>
                <div className="mx_SpaceHierarchy_roomTile_name">
                    <span id={checkboxLabelId}>{name}</span>
                    {joinedSection}
                    {suggestedSection}
                </div>
                <div className="mx_SpaceHierarchy_roomTile_info">
                    {description}
                    {topicSection}
                </div>
            </div>
            <div className="mx_SpaceHierarchy_actions">
                {button}
                {checkbox}
            </div>
        </React.Fragment>
    );

    let childToggle: JSX.Element | undefined;
    let childSection: JSX.Element | undefined;
    let onKeyDown: KeyboardEventHandler | undefined;
    if (children) {
        // the chevron is purposefully a div rather than a button as it should be ignored for a11y
        childToggle = (
            <div
                className={classNames("mx_SpaceHierarchy_subspace_toggle", {
                    mx_SpaceHierarchy_subspace_toggle_shown: showChildren,
                })}
                onClick={(ev) => {
                    ev.stopPropagation();
                    toggleShowChildren();
                }}
            />
        );

        if (showChildren) {
            const onChildrenKeyDown = (e: React.KeyboardEvent): void => {
                const action = getKeyBindingsManager().getAccessibilityAction(e);
                switch (action) {
                    case KeyBindingAction.ArrowLeft:
                        e.preventDefault();
                        e.stopPropagation();
                        nodeRef.current?.focus();
                        break;
                }
            };

            childSection = (
                <div className="mx_SpaceHierarchy_subspace_children" onKeyDown={onChildrenKeyDown} role="group">
                    {children}
                </div>
            );
        }

        onKeyDown = (e) => {
            let handled = false;

            const action = getKeyBindingsManager().getAccessibilityAction(e);
            switch (action) {
                case KeyBindingAction.ArrowLeft:
                    if (showChildren) {
                        handled = true;
                        toggleShowChildren();
                    }
                    break;

                case KeyBindingAction.ArrowRight:
                    handled = true;
                    if (showChildren) {
                        const childSection = nodeRef.current?.nextElementSibling;
                        childSection?.querySelector<HTMLDivElement>(".mx_SpaceHierarchy_roomTile")?.focus();
                    } else {
                        toggleShowChildren();
                    }
                    break;
            }

            if (handled) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
    }

    const shouldToggle = hasPermissions && onToggleClick;

    return (
        <li
            className="mx_SpaceHierarchy_roomTileWrapper"
            role="treeitem"
            aria-selected={selected}
            aria-labelledby={checkboxLabelId}
            aria-expanded={children ? showChildren : undefined}
        >
            <AccessibleButton
                className={classNames("mx_SpaceHierarchy_roomTile", {
                    mx_SpaceHierarchy_subspace: room.room_type === RoomType.Space,
                    mx_SpaceHierarchy_joining: busy,
                })}
                onClick={shouldToggle ? onToggleClick : onPreviewClick}
                onKeyDown={onKeyDown}
                ref={ref}
                onFocus={onFocus}
                tabIndex={isActive ? 0 : -1}
            >
                {content}
                {childToggle}
            </AccessibleButton>
            {childSection}
        </li>
    );
};

export const showRoom = (cli: MatrixClient, hierarchy: RoomHierarchy, roomId: string, roomType?: RoomType): void => {
    const room = hierarchy.roomMap.get(roomId);

    // Don't let the user view a room they won't be able to either peek or join:
    // fail earlier so they don't have to click back to the directory.
    if (cli.isGuest()) {
        if (!room?.world_readable && !room?.guest_can_join) {
            defaultDispatcher.dispatch({ action: "require_registration" });
            return;
        }
    }

    const roomAlias = getDisplayAliasForAliasSet(room?.canonical_alias ?? "", room?.aliases ?? []) || undefined;

    defaultDispatcher.dispatch<ViewRoomPayload>({
        action: Action.ViewRoom,
        should_peek: true,
        room_alias: roomAlias,
        room_id: roomId,
        via_servers: Array.from(hierarchy.viaMap.get(roomId) || []),
        oob_data: {
            avatarUrl: room?.avatar_url,
            // XXX: This logic is duplicated from the JS SDK which would normally decide what the name is.
            name: room?.name || roomAlias || _t("common|unnamed_room"),
            roomType,
        } as IOOBData,
        metricsTrigger: "RoomDirectory",
    });
};

export const joinRoom = async (cli: MatrixClient, hierarchy: RoomHierarchy, roomId: string): Promise<unknown> => {
    // Don't let the user view a room they won't be able to either peek or join:
    // fail earlier so they don't have to click back to the directory.
    if (cli.isGuest()) {
        defaultDispatcher.dispatch({ action: "require_registration" });
        return;
    }

    try {
        await cli.joinRoom(roomId, {
            viaServers: Array.from(hierarchy.viaMap.get(roomId) || []),
        });
    } catch (err: unknown) {
        if (err instanceof MatrixError) {
            SdkContextClass.instance.roomViewStore.showJoinRoomError(err, roomId);
        } else {
            logger.warn("Got a non-MatrixError while joining room", err);
            SdkContextClass.instance.roomViewStore.showJoinRoomError(
                new MatrixError({
                    error: _t("error|unknown"),
                }),
                roomId,
            );
        }

        // rethrow error so that the caller can handle react to it too
        throw err;
    }

    defaultDispatcher.dispatch<JoinRoomReadyPayload>({
        action: Action.JoinRoomReady,
        roomId,
        metricsTrigger: "SpaceHierarchy",
    });
};

interface IHierarchyLevelProps {
    root: HierarchyRoom;
    roomSet: Set<HierarchyRoom>;
    hierarchy: RoomHierarchy;
    parents: Set<string>;
    selectedMap?: Map<string, Set<string>>;
    onViewRoomClick(roomId: string, roomType?: RoomType): void;
    onJoinRoomClick(roomId: string, parents: Set<string>): Promise<unknown>;
    onToggleClick?(parentId: string, childId: string): void;
}

export const toLocalRoom = (cli: MatrixClient, room: HierarchyRoom, hierarchy: RoomHierarchy): HierarchyRoom => {
    const history = cli.getRoomUpgradeHistory(
        room.room_id,
        true,
        SettingsStore.getValue("feature_dynamic_room_predecessors"),
    );

    // Pick latest room that is actually part of the hierarchy
    let cliRoom: Room | null = null;
    for (let idx = history.length - 1; idx >= 0; --idx) {
        if (hierarchy.roomMap.get(history[idx].roomId)) {
            cliRoom = history[idx];
            break;
        }
    }

    if (cliRoom) {
        return {
            ...room,
            room_id: cliRoom.roomId,
            room_type: cliRoom.getType(),
            name: cliRoom.name,
            topic: cliRoom.currentState.getStateEvents(EventType.RoomTopic, "")?.getContent().topic,
            avatar_url: cliRoom.getMxcAvatarUrl() ?? undefined,
            canonical_alias: cliRoom.getCanonicalAlias() ?? undefined,
            aliases: cliRoom.getAltAliases(),
            world_readable:
                cliRoom.currentState.getStateEvents(EventType.RoomHistoryVisibility, "")?.getContent()
                    .history_visibility === HistoryVisibility.WorldReadable,
            guest_can_join:
                cliRoom.currentState.getStateEvents(EventType.RoomGuestAccess, "")?.getContent().guest_access ===
                GuestAccess.CanJoin,
            num_joined_members: cliRoom.getJoinedMemberCount(),
        };
    }

    return room;
};

export const HierarchyLevel: React.FC<IHierarchyLevelProps> = ({
    root,
    roomSet,
    hierarchy,
    parents,
    selectedMap,
    onViewRoomClick,
    onJoinRoomClick,
    onToggleClick,
}) => {
    const cli = useContext(MatrixClientContext);
    const space = cli.getRoom(root.room_id);
    const hasPermissions = space?.currentState.maySendStateEvent(EventType.SpaceChild, cli.getSafeUserId());

    const sortedChildren = sortBy(root.children_state, (ev) => {
        return getChildOrder(ev.content.order, ev.origin_server_ts, ev.state_key);
    });

    const [subspaces, childRooms] = sortedChildren.reduce(
        (result, ev: HierarchyRelation) => {
            const room = hierarchy.roomMap.get(ev.state_key);
            if (room && roomSet.has(room)) {
                result[room.room_type === RoomType.Space ? 0 : 1].push(toLocalRoom(cli, room, hierarchy));
            }
            return result;
        },
        [[] as HierarchyRoom[], [] as HierarchyRoom[]],
    );

    const newParents = new Set(parents).add(root.room_id);
    return (
        <React.Fragment>
            {uniqBy(childRooms, "room_id").map((room) => (
                <Tile
                    key={room.room_id}
                    room={room}
                    suggested={hierarchy.isSuggested(root.room_id, room.room_id)}
                    selected={selectedMap?.get(root.room_id)?.has(room.room_id)}
                    onViewRoomClick={() => onViewRoomClick(room.room_id, room.room_type as RoomType)}
                    onJoinRoomClick={() => onJoinRoomClick(room.room_id, newParents)}
                    hasPermissions={hasPermissions}
                    onToggleClick={onToggleClick ? () => onToggleClick(root.room_id, room.room_id) : undefined}
                />
            ))}

            {subspaces
                .filter((room) => !newParents.has(room.room_id))
                .map((space) => (
                    <Tile
                        key={space.room_id}
                        room={space}
                        numChildRooms={
                            space.children_state.filter((ev) => {
                                const room = hierarchy.roomMap.get(ev.state_key);
                                return room && roomSet.has(room) && !room.room_type;
                            }).length
                        }
                        suggested={hierarchy.isSuggested(root.room_id, space.room_id)}
                        selected={selectedMap?.get(root.room_id)?.has(space.room_id)}
                        onViewRoomClick={() => onViewRoomClick(space.room_id, RoomType.Space)}
                        onJoinRoomClick={() => onJoinRoomClick(space.room_id, newParents)}
                        hasPermissions={hasPermissions}
                        onToggleClick={onToggleClick ? () => onToggleClick(root.room_id, space.room_id) : undefined}
                    >
                        <HierarchyLevel
                            root={space}
                            roomSet={roomSet}
                            hierarchy={hierarchy}
                            parents={newParents}
                            selectedMap={selectedMap}
                            onViewRoomClick={onViewRoomClick}
                            onJoinRoomClick={onJoinRoomClick}
                            onToggleClick={onToggleClick}
                        />
                    </Tile>
                ))}
        </React.Fragment>
    );
};

const INITIAL_PAGE_SIZE = 20;

export const useRoomHierarchy = (
    space: Room,
): {
    loading: boolean;
    rooms?: HierarchyRoom[];
    hierarchy?: RoomHierarchy;
    error?: Error;
    loadMore(pageSize?: number): Promise<void>;
} => {
    const [rooms, setRooms] = useState<HierarchyRoom[]>([]);
    const [hierarchy, setHierarchy] = useState<RoomHierarchy>();
    const [error, setError] = useState<Error | undefined>();

    const resetHierarchy = useCallback(() => {
        setError(undefined);
        const hierarchy = new RoomHierarchy(space, INITIAL_PAGE_SIZE);
        hierarchy.load().then(() => {
            if (space !== hierarchy.root) return; // discard stale results
            setRooms(hierarchy.rooms ?? []);
        }, setError);
        setHierarchy(hierarchy);
    }, [space]);
    useEffect(resetHierarchy, [resetHierarchy]);

    useDispatcher(defaultDispatcher, (payload) => {
        if (payload.action === Action.UpdateSpaceHierarchy) {
            setRooms([]); // TODO
            resetHierarchy();
        }
    });

    const loadMore = useCallback(
        async (pageSize?: number): Promise<void> => {
            if (!hierarchy || hierarchy.loading || !hierarchy.canLoadMore || hierarchy.noSupport || error) return;
            await hierarchy.load(pageSize).catch(setError);
            setRooms(hierarchy.rooms ?? []);
        },
        [error, hierarchy],
    );

    // Only return the hierarchy if it is for the space requested
    if (hierarchy?.root !== space) {
        return {
            loading: true,
            loadMore,
        };
    }

    return {
        loading: hierarchy.loading,
        rooms,
        hierarchy,
        loadMore,
        error,
    };
};

const useIntersectionObserver = (callback: () => void): ((element: HTMLDivElement) => void) => {
    const handleObserver = (entries: IntersectionObserverEntry[]): void => {
        const target = entries[0];
        if (target.isIntersecting) {
            callback();
        }
    };

    const observerRef = useRef<IntersectionObserver>(undefined);
    return (element: HTMLDivElement) => {
        if (observerRef.current) {
            observerRef.current.disconnect();
        } else if (element) {
            observerRef.current = new IntersectionObserver(handleObserver, {
                root: element.parentElement,
                rootMargin: "0px 0px 600px 0px",
            });
        }

        if (observerRef.current && element) {
            observerRef.current.observe(element);
        }
    };
};

interface IManageButtonsProps {
    hierarchy: RoomHierarchy;
    selected: Map<string, Set<string>>;
    setSelected: Dispatch<SetStateAction<Map<string, Set<string>>>>;
    setError: Dispatch<SetStateAction<string>>;
}

const ManageButtons: React.FC<IManageButtonsProps> = ({ hierarchy, selected, setSelected, setError }) => {
    const cli = useContext(MatrixClientContext);

    const [removing, setRemoving] = useState(false);
    const [saving, setSaving] = useState(false);

    const selectedRelations = Array.from(selected.keys()).flatMap((parentId) => {
        return [...selected.get(parentId)!.values()].map((childId) => [parentId, childId]);
    });

    const selectionAllSuggested = selectedRelations.every(([parentId, childId]) => {
        return hierarchy.isSuggested(parentId, childId);
    });

    const disabled = !selectedRelations.length || removing || saving;

    let buttonText = _t("common|saving");
    if (!saving) {
        buttonText = selectionAllSuggested ? _t("space|unmark_suggested") : _t("space|mark_suggested");
    }

    const title = !selectedRelations.length ? _t("space|select_room_below") : undefined;

    return (
        <>
            <AccessibleButton
                onClick={async (): Promise<void> => {
                    setRemoving(true);
                    try {
                        const userId = cli.getSafeUserId();
                        for (const [parentId, childId] of selectedRelations) {
                            await cli.sendStateEvent(parentId, EventType.SpaceChild, {}, childId);

                            // remove the child->parent relation too, if we have permission to.
                            const childRoom = cli.getRoom(childId);
                            const parentRelation = childRoom?.currentState.getStateEvents(
                                EventType.SpaceParent,
                                parentId,
                            );
                            if (
                                childRoom?.currentState.maySendStateEvent(EventType.SpaceParent, userId) &&
                                Array.isArray(parentRelation?.getContent().via)
                            ) {
                                await cli.sendStateEvent(childId, EventType.SpaceParent, {}, parentId);
                            }

                            hierarchy.removeRelation(parentId, childId);
                        }
                    } catch {
                        setError(_t("space|failed_remove_rooms"));
                    }
                    setRemoving(false);
                    setSelected(new Map());
                }}
                kind="danger_outline"
                disabled={disabled}
                aria-label={removing ? _t("redact|ongoing") : _t("action|remove")}
                title={title}
                placement="top"
            >
                {removing ? _t("redact|ongoing") : _t("action|remove")}
            </AccessibleButton>
            <AccessibleButton
                onClick={async (): Promise<void> => {
                    setSaving(true);
                    try {
                        for (const [parentId, childId] of selectedRelations) {
                            const suggested = !selectionAllSuggested;
                            const existingContent = hierarchy.getRelation(parentId, childId)?.content;
                            if (!existingContent || existingContent.suggested === suggested) continue;

                            const content: SpaceChildEventContent = {
                                ...existingContent,
                                suggested: !selectionAllSuggested,
                            };

                            await cli.sendStateEvent(parentId, EventType.SpaceChild, content, childId);

                            // mutate the local state to save us having to refetch the world
                            existingContent.suggested = content.suggested;
                        }
                    } catch {
                        setError("Failed to update some suggestions. Try again later");
                    }
                    setSaving(false);
                    setSelected(new Map());
                }}
                kind="primary_outline"
                disabled={disabled}
                aria-label={buttonText}
                title={title}
                placement="top"
            >
                {buttonText}
            </AccessibleButton>
        </>
    );
};

const SpaceHierarchy: React.FC<IProps> = ({ space, initialText = "", showRoom, additionalButtons }) => {
    const cli = useContext(MatrixClientContext);
    const [query, setQuery] = useState(initialText);

    const [selected, setSelected] = useState(new Map<string, Set<string>>()); // Map<parentId, Set<childId>>

    const { loading, rooms, hierarchy, loadMore, error: hierarchyError } = useRoomHierarchy(space);

    const filteredRoomSet = useMemo<Set<HierarchyRoom>>(() => {
        if (!rooms?.length || !hierarchy) return new Set();
        const lcQuery = query.toLowerCase().trim();
        if (!lcQuery) return new Set(rooms);

        const directMatches = rooms.filter((r) => {
            return r.name?.toLowerCase().includes(lcQuery) || r.topic?.toLowerCase().includes(lcQuery);
        });

        // Walk back up the tree to find all parents of the direct matches to show their place in the hierarchy
        const visited = new Set<string>();
        const queue = [...directMatches.map((r) => r.room_id)];
        while (queue.length) {
            const roomId = queue.pop()!;
            visited.add(roomId);
            hierarchy.backRefs.get(roomId)?.forEach((parentId) => {
                if (!visited.has(parentId)) {
                    queue.push(parentId);
                }
            });
        }

        return new Set(rooms.filter((r) => visited.has(r.room_id)));
    }, [rooms, hierarchy, query]);

    const [error, setError] = useState("");
    let errorText = error;
    if (!error && hierarchyError) {
        errorText = _t("space|failed_load_rooms");
    }

    const loaderRef = useIntersectionObserver(loadMore);

    if (!loading && hierarchy!.noSupport) {
        return <p>{_t("space|incompatible_server_hierarchy")}</p>;
    }

    const onKeyDown = (ev: KeyboardEvent, state: IState): void => {
        const action = getKeyBindingsManager().getAccessibilityAction(ev);
        if (action === KeyBindingAction.ArrowDown && ev.currentTarget.classList.contains("mx_SpaceHierarchy_search")) {
            state.nodes[0]?.focus();
        }
    };

    const onToggleClick = (parentId: string, childId: string): void => {
        setError("");
        if (!selected.has(parentId)) {
            setSelected(new Map(selected.set(parentId, new Set([childId]))));
            return;
        }

        const parentSet = selected.get(parentId)!;
        if (!parentSet.has(childId)) {
            setSelected(new Map(selected.set(parentId, new Set([...parentSet, childId]))));
            return;
        }

        parentSet.delete(childId);
        setSelected(new Map(selected.set(parentId, new Set(parentSet))));
    };

    return (
        <RovingTabIndexProvider onKeyDown={onKeyDown} handleHomeEnd handleUpDown>
            {({ onKeyDownHandler }) => {
                let content: JSX.Element;
                if (!hierarchy || (loading && !rooms?.length)) {
                    content = <Spinner />;
                } else {
                    const hasPermissions =
                        space?.getMyMembership() === KnownMembership.Join &&
                        space.currentState.maySendStateEvent(EventType.SpaceChild, cli.getSafeUserId());

                    const root = hierarchy.roomMap.get(space.roomId);
                    let results: JSX.Element | undefined;
                    if (filteredRoomSet.size && root) {
                        results = (
                            <>
                                <HierarchyLevel
                                    root={root}
                                    roomSet={filteredRoomSet}
                                    hierarchy={hierarchy}
                                    parents={new Set()}
                                    selectedMap={selected}
                                    onToggleClick={hasPermissions ? onToggleClick : undefined}
                                    onViewRoomClick={(roomId, roomType) => showRoom(cli, hierarchy, roomId, roomType)}
                                    onJoinRoomClick={async (roomId, parents) => {
                                        for (const parent of parents) {
                                            if (cli.getRoom(parent)?.getMyMembership() !== KnownMembership.Join) {
                                                await joinRoom(cli, hierarchy, parent);
                                            }
                                        }
                                        await joinRoom(cli, hierarchy, roomId);
                                    }}
                                />
                            </>
                        );
                    } else if (!hierarchy.canLoadMore) {
                        results = (
                            <div className="mx_SpaceHierarchy_noResults">
                                <h3>{_t("common|no_results_found")}</h3>
                                <div>{_t("space|no_search_result_hint")}</div>
                            </div>
                        );
                    }

                    let loader: JSX.Element | undefined;
                    if (hierarchy.canLoadMore) {
                        loader = (
                            <div ref={loaderRef}>
                                <Spinner />
                            </div>
                        );
                    }

                    content = (
                        <>
                            <div className="mx_SpaceHierarchy_listHeader">
                                <h4 className="mx_SpaceHierarchy_listHeader_header">
                                    {query.trim()
                                        ? _t("space|title_when_query_available")
                                        : _t("space|title_when_query_unavailable")}
                                </h4>
                                <div className="mx_SpaceHierarchy_listHeader_buttons">
                                    {additionalButtons}
                                    {hasPermissions && (
                                        <ManageButtons
                                            hierarchy={hierarchy}
                                            selected={selected}
                                            setSelected={setSelected}
                                            setError={setError}
                                        />
                                    )}
                                </div>
                            </div>
                            {errorText && <div className="mx_SpaceHierarchy_error">{errorText}</div>}
                            <ul
                                className="mx_SpaceHierarchy_list"
                                onKeyDown={onKeyDownHandler}
                                role="tree"
                                aria-label={_t("common|space")}
                            >
                                {results}
                            </ul>
                            {loader}
                        </>
                    );
                }

                return (
                    <>
                        <SearchBox
                            className="mx_SpaceHierarchy_search mx_textinput_icon mx_textinput_search"
                            placeholder={_t("space|search_placeholder")}
                            onSearch={setQuery}
                            autoFocus={true}
                            initialValue={initialText}
                            onKeyDown={onKeyDownHandler}
                        />

                        {content}
                    </>
                );
            }}
        </RovingTabIndexProvider>
    );
};

export default SpaceHierarchy;
