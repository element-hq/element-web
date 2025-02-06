/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement, type ReactNode, useContext, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import { type Room, EventType } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { sleep } from "matrix-js-sdk/src/utils";
import { logger } from "matrix-js-sdk/src/logger";
import { ErrorIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t, _td, type TranslationKey } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import Dropdown from "../elements/Dropdown";
import SearchBox from "../../structures/SearchBox";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import RoomAvatar from "../avatars/RoomAvatar";
import { getDisplayAliasForRoom } from "../../../Rooms";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import DMRoomMap from "../../../utils/DMRoomMap";
import { calculateRoomVia } from "../../../utils/permalinks/Permalinks";
import StyledCheckbox from "../elements/StyledCheckbox";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { sortRooms } from "../../../stores/room-list/algorithms/tag-sorting/RecentAlgorithm";
import ProgressBar from "../elements/ProgressBar";
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import QueryMatcher from "../../../autocomplete/QueryMatcher";
import LazyRenderList from "../elements/LazyRenderList";
import { useSettingValue } from "../../../hooks/useSettings";
import { filterBoolean } from "../../../utils/arrays";
import { type NonEmptyArray } from "../../../@types/common";

// These values match CSS
const ROW_HEIGHT = 32 + 12;
const HEADER_HEIGHT = 15;
const GROUP_MARGIN = 24;

interface IProps {
    space: Room;
    onCreateRoomClick(ev: ButtonEvent): void;
    onAddSubspaceClick(): void;
    onFinished(added?: boolean): void;
}

export const Entry: React.FC<{
    room: Room;
    checked: boolean;
    onChange?(value: boolean): void;
}> = ({ room, checked, onChange }) => {
    return (
        <label className="mx_AddExistingToSpace_entry">
            {room?.isSpaceRoom() ? (
                <RoomAvatar room={room} size="32px" />
            ) : (
                <DecoratedRoomAvatar room={room} size="32px" />
            )}
            <span className="mx_AddExistingToSpace_entry_name">{room.name}</span>
            <StyledCheckbox
                onChange={onChange ? (e) => onChange(e.currentTarget.checked) : undefined}
                checked={checked}
                disabled={!onChange}
            />
        </label>
    );
};

type OnChangeFn = (checked: boolean, room: Room) => void;

type Renderer = (
    rooms: Room[],
    selectedToAdd: Set<Room>,
    scrollState: IScrollState,
    onChange: undefined | OnChangeFn,
) => ReactNode;

interface IAddExistingToSpaceProps {
    space: Room;
    footerPrompt?: ReactNode;
    filterPlaceholder: string;
    emptySelectionButton?: ReactNode;
    onFinished(added: boolean): void;
    roomsRenderer?: Renderer;
    spacesRenderer?: Renderer;
    dmsRenderer?: Renderer;
}

interface IScrollState {
    scrollTop: number;
    height: number;
}

const getScrollState = (
    { scrollTop, height }: IScrollState,
    numItems: number,
    ...prevGroupSizes: number[]
): IScrollState => {
    let heightBefore = 0;
    prevGroupSizes.forEach((size) => {
        heightBefore += GROUP_MARGIN + HEADER_HEIGHT + size * ROW_HEIGHT;
    });

    const viewportTop = scrollTop;
    const viewportBottom = viewportTop + height;
    const listTop = heightBefore + HEADER_HEIGHT;
    const listBottom = listTop + numItems * ROW_HEIGHT;
    const top = Math.max(viewportTop, listTop);
    const bottom = Math.min(viewportBottom, listBottom);
    // the viewport height and scrollTop passed to the LazyRenderList
    // is capped at the intersection with the real viewport, so lists
    // out of view are passed height 0, so they won't render any items.
    return {
        scrollTop: Math.max(0, scrollTop - listTop),
        height: Math.max(0, bottom - top),
    };
};

export const AddExistingToSpace: React.FC<IAddExistingToSpaceProps> = ({
    space,
    footerPrompt,
    emptySelectionButton,
    filterPlaceholder,
    roomsRenderer,
    dmsRenderer,
    spacesRenderer,
    onFinished,
}) => {
    const cli = useContext(MatrixClientContext);
    const msc3946ProcessDynamicPredecessor = useSettingValue("feature_dynamic_room_predecessors");
    const visibleRooms = useMemo(
        () =>
            cli
                ?.getVisibleRooms(msc3946ProcessDynamicPredecessor)
                .filter((r) => r.getMyMembership() === KnownMembership.Join) ?? [],
        [cli, msc3946ProcessDynamicPredecessor],
    );

    const scrollRef = useRef<AutoHideScrollbar<"div">>(null);
    const [scrollState, setScrollState] = useState<IScrollState>({
        // these are estimates which update as soon as it mounts
        scrollTop: 0,
        height: 600,
    });

    const [selectedToAdd, setSelectedToAdd] = useState(new Set<Room>());
    const [progress, setProgress] = useState<number | null>(null);
    const [error, setError] = useState(false);
    const [query, setQuery] = useState("");
    const lcQuery = query.toLowerCase().trim();

    const existingSubspacesSet = useMemo(() => new Set(SpaceStore.instance.getChildSpaces(space.roomId)), [space]);
    const existingRoomsSet = useMemo(() => new Set(SpaceStore.instance.getChildRooms(space.roomId)), [space]);

    const [spaces, rooms, dms] = useMemo(() => {
        let rooms = visibleRooms;

        if (lcQuery) {
            const matcher = new QueryMatcher<Room>(visibleRooms, {
                keys: ["name"],
                funcs: [(r) => filterBoolean([r.getCanonicalAlias(), ...r.getAltAliases()])],
                shouldMatchWordsOnly: false,
            });

            rooms = matcher.match(lcQuery);
        }

        const joinRule = space.getJoinRule();
        return sortRooms(rooms).reduce<[spaces: Room[], rooms: Room[], dms: Room[]]>(
            (arr, room) => {
                if (room.isSpaceRoom()) {
                    if (room !== space && !existingSubspacesSet.has(room)) {
                        arr[0].push(room);
                    }
                } else if (!existingRoomsSet.has(room)) {
                    if (!DMRoomMap.shared().getUserIdForRoomId(room.roomId)) {
                        arr[1].push(room);
                    } else if (joinRule !== "public") {
                        // Only show DMs for non-public spaces as they make very little sense in spaces other than "Just Me" ones.
                        arr[2].push(room);
                    }
                }
                return arr;
            },
            [[], [], []],
        );
    }, [visibleRooms, space, lcQuery, existingRoomsSet, existingSubspacesSet]);

    const addRooms = async (): Promise<void> => {
        setError(false);
        setProgress(0);

        let error = false;

        for (const room of selectedToAdd) {
            const via = calculateRoomVia(room);
            try {
                await SpaceStore.instance.addRoomToSpace(space, room.roomId, via).catch(async (e): Promise<void> => {
                    if (e.errcode === "M_LIMIT_EXCEEDED") {
                        await sleep(e.data.retry_after_ms);
                        await SpaceStore.instance.addRoomToSpace(space, room.roomId, via); // retry
                        return;
                    }

                    throw e;
                });
                setProgress((i) => (i ?? 0) + 1);
            } catch (e) {
                logger.error("Failed to add rooms to space", e);
                error = true;
                break;
            }
        }

        if (!error) {
            onFinished(true);
        } else {
            setError(error);
        }
    };

    const busy = progress !== null;

    let footer;
    if (error) {
        footer = (
            <>
                <ErrorIcon height="24px" width="24px" />

                <span className="mx_AddExistingToSpaceDialog_error">
                    <div className="mx_AddExistingToSpaceDialog_errorHeading">
                        {_t("space|add_existing_room_space|error_heading")}
                    </div>
                    <div className="mx_AddExistingToSpaceDialog_errorCaption">{_t("action|try_again")}</div>
                </span>

                <AccessibleButton className="mx_AddExistingToSpaceDialog_retryButton" onClick={addRooms}>
                    {_t("action|retry")}
                </AccessibleButton>
            </>
        );
    } else if (busy) {
        footer = (
            <span>
                <ProgressBar value={progress} max={selectedToAdd.size} />
                <div className="mx_AddExistingToSpaceDialog_progressText">
                    {_t("space|add_existing_room_space|progress_text", {
                        count: selectedToAdd.size,
                        progress,
                    })}
                </div>
            </span>
        );
    } else {
        let button = emptySelectionButton;
        if (!button || selectedToAdd.size > 0) {
            button = (
                <AccessibleButton kind="primary" disabled={selectedToAdd.size < 1} onClick={addRooms}>
                    {_t("action|add")}
                </AccessibleButton>
            );
        }

        footer = (
            <>
                <span>{footerPrompt}</span>

                {button}
            </>
        );
    }

    const onChange =
        !busy && !error
            ? (checked: boolean, room: Room) => {
                  if (checked) {
                      selectedToAdd.add(room);
                  } else {
                      selectedToAdd.delete(room);
                  }
                  setSelectedToAdd(new Set(selectedToAdd));
              }
            : undefined;

    // only count spaces when alone as they're shown on a separate modal all on their own
    const numSpaces = spacesRenderer && !dmsRenderer && !roomsRenderer ? spaces.length : 0;
    const numRooms = roomsRenderer ? rooms.length : 0;
    const numDms = dmsRenderer ? dms.length : 0;

    let noResults = true;
    if (numSpaces > 0 || numRooms > 0 || numDms > 0) {
        noResults = false;
    }

    const onScroll = (): void => {
        const body = scrollRef.current?.containerRef.current;
        if (!body) return;
        setScrollState({
            scrollTop: body.scrollTop,
            height: body.clientHeight,
        });
    };

    const wrappedRef = (body: HTMLDivElement | null): void => {
        if (!body) return;
        setScrollState({
            scrollTop: body.scrollTop,
            height: body.clientHeight,
        });
    };

    const roomsScrollState = getScrollState(scrollState, numRooms);
    const spacesScrollState = getScrollState(scrollState, numSpaces, numRooms);
    const dmsScrollState = getScrollState(scrollState, numDms, numSpaces, numRooms);

    return (
        <div className="mx_AddExistingToSpace">
            <SearchBox
                className="mx_textinput_icon mx_textinput_search"
                placeholder={filterPlaceholder}
                onSearch={setQuery}
                autoFocus={true}
            />
            <AutoHideScrollbar
                className="mx_AddExistingToSpace_content"
                onScroll={onScroll}
                wrappedRef={wrappedRef}
                ref={scrollRef}
            >
                {rooms.length > 0 && roomsRenderer
                    ? roomsRenderer(rooms, selectedToAdd, roomsScrollState, onChange)
                    : undefined}

                {spaces.length > 0 && spacesRenderer
                    ? spacesRenderer(spaces, selectedToAdd, spacesScrollState, onChange)
                    : null}

                {dms.length > 0 && dmsRenderer ? dmsRenderer(dms, selectedToAdd, dmsScrollState, onChange) : null}

                {noResults ? (
                    <span className="mx_AddExistingToSpace_noResults">{_t("common|no_results")}</span>
                ) : undefined}
            </AutoHideScrollbar>

            <div className="mx_AddExistingToSpace_footer">{footer}</div>
        </div>
    );
};

const defaultRendererFactory =
    (title: TranslationKey): Renderer =>
    (rooms, selectedToAdd, { scrollTop, height }, onChange) => (
        <div className="mx_AddExistingToSpace_section">
            <h3>{_t(title)}</h3>
            <LazyRenderList
                itemHeight={ROW_HEIGHT}
                items={rooms}
                scrollTop={scrollTop}
                height={height}
                renderItem={(room) => (
                    <Entry
                        key={room.roomId}
                        room={room}
                        checked={selectedToAdd.has(room)}
                        onChange={
                            onChange
                                ? (checked: boolean) => {
                                      onChange(checked, room);
                                  }
                                : undefined
                        }
                    />
                )}
            />
        </div>
    );

export const defaultRoomsRenderer = defaultRendererFactory(_td("common|rooms"));
export const defaultSpacesRenderer = defaultRendererFactory(_td("common|spaces"));
export const defaultDmsRenderer = defaultRendererFactory(_td("space|add_existing_room_space|dm_heading"));

interface ISubspaceSelectorProps {
    title: string;
    space: Room;
    value: Room;
    onChange(space: Room): void;
}

export const SubspaceSelector: React.FC<ISubspaceSelectorProps> = ({ title, space, value, onChange }) => {
    const options = useMemo(() => {
        return [
            space,
            ...SpaceStore.instance.getChildSpaces(space.roomId).filter((space) => {
                return space.currentState.maySendStateEvent(EventType.SpaceChild, space.client.getSafeUserId());
            }),
        ];
    }, [space]);

    let body;
    if (options.length > 1) {
        body = (
            <Dropdown
                id="mx_SpaceSelectDropdown"
                className="mx_SpaceSelectDropdown"
                onOptionChange={(key: string) => {
                    onChange(options.find((space) => space.roomId === key) || space);
                }}
                value={value.roomId}
                label={_t("space|add_existing_room_space|space_dropdown_label")}
            >
                {
                    options.map((space) => {
                        const classes = classNames({
                            mx_SubspaceSelector_dropdownOptionActive: space === value,
                        });
                        return (
                            <div key={space.roomId} className={classes}>
                                <RoomAvatar room={space} size="24px" />
                                {space.name || getDisplayAliasForRoom(space) || space.roomId}
                            </div>
                        );
                    }) as NonEmptyArray<ReactElement & { key: string }>
                }
            </Dropdown>
        );
    } else {
        body = (
            <div className="mx_SubspaceSelector_onlySpace">
                {space.name || getDisplayAliasForRoom(space) || space.roomId}
            </div>
        );
    }

    return (
        <div className="mx_SubspaceSelector">
            <RoomAvatar room={value} size="40px" />
            <div>
                <h1>{title}</h1>
                {body}
            </div>
        </div>
    );
};

const AddExistingToSpaceDialog: React.FC<IProps> = ({ space, onCreateRoomClick, onAddSubspaceClick, onFinished }) => {
    const [selectedSpace, setSelectedSpace] = useState(space);

    return (
        <BaseDialog
            title={
                <SubspaceSelector
                    title={_t("space|add_existing_room_space|space_dropdown_title")}
                    space={space}
                    value={selectedSpace}
                    onChange={setSelectedSpace}
                />
            }
            className="mx_AddExistingToSpaceDialog"
            contentId="mx_AddExistingToSpace"
            onFinished={onFinished}
            fixedWidth={false}
        >
            <MatrixClientContext.Provider value={space.client}>
                <AddExistingToSpace
                    space={space}
                    onFinished={onFinished}
                    footerPrompt={
                        <>
                            <div>{_t("space|add_existing_room_space|create")}</div>
                            <AccessibleButton
                                kind="link"
                                onClick={(ev: ButtonEvent) => {
                                    onCreateRoomClick(ev);
                                    onFinished();
                                }}
                            >
                                {_t("space|add_existing_room_space|create_prompt")}
                            </AccessibleButton>
                        </>
                    }
                    filterPlaceholder={_t("space|room_filter_placeholder")}
                    roomsRenderer={defaultRoomsRenderer}
                    spacesRenderer={() => (
                        <div className="mx_AddExistingToSpace_section">
                            <h3>{_t("common|spaces")}</h3>
                            <AccessibleButton
                                kind="link"
                                onClick={() => {
                                    onAddSubspaceClick();
                                    onFinished();
                                }}
                            >
                                {_t("space|add_existing_room_space|subspace_moved_note")}
                            </AccessibleButton>
                        </div>
                    )}
                    dmsRenderer={defaultDmsRenderer}
                />
            </MatrixClientContext.Provider>
        </BaseDialog>
    );
};

export default AddExistingToSpaceDialog;
