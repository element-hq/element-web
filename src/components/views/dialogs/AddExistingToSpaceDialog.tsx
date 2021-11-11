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

import React, { ReactNode, useContext, useMemo, useState } from "react";
import classNames from "classnames";
import { Room } from "matrix-js-sdk/src/models/room";
import { sleep } from "matrix-js-sdk/src/utils";
import { EventType } from "matrix-js-sdk/src/@types/event";

import { _t } from '../../../languageHandler';
import BaseDialog from "./BaseDialog";
import Dropdown from "../elements/Dropdown";
import SearchBox from "../../structures/SearchBox";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import RoomAvatar from "../avatars/RoomAvatar";
import { getDisplayAliasForRoom } from "../../../Rooms";
import AccessibleButton from "../elements/AccessibleButton";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import DMRoomMap from "../../../utils/DMRoomMap";
import { calculateRoomVia } from "../../../utils/permalinks/Permalinks";
import StyledCheckbox from "../elements/StyledCheckbox";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { sortRooms } from "../../../stores/room-list/algorithms/tag-sorting/RecentAlgorithm";
import ProgressBar from "../elements/ProgressBar";
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import QueryMatcher from "../../../autocomplete/QueryMatcher";
import TruncatedList from "../elements/TruncatedList";
import EntityTile from "../rooms/EntityTile";
import BaseAvatar from "../avatars/BaseAvatar";

import { logger } from "matrix-js-sdk/src/logger";

interface IProps {
    space: Room;
    onCreateRoomClick(): void;
    onAddSubspaceClick(): void;
    onFinished(added?: boolean): void;
}

export const Entry = ({ room, checked, onChange }) => {
    return <label className="mx_AddExistingToSpace_entry">
        { room?.isSpaceRoom()
            ? <RoomAvatar room={room} height={32} width={32} />
            : <DecoratedRoomAvatar room={room} avatarSize={32} />
        }
        <span className="mx_AddExistingToSpace_entry_name">{ room.name }</span>
        <StyledCheckbox
            onChange={onChange ? (e) => onChange(e.target.checked) : null}
            checked={checked}
            disabled={!onChange}
        />
    </label>;
};

interface IAddExistingToSpaceProps {
    space: Room;
    footerPrompt?: ReactNode;
    filterPlaceholder: string;
    emptySelectionButton?: ReactNode;
    onFinished(added: boolean): void;
    roomsRenderer?(
        rooms: Room[],
        selectedToAdd: Set<Room>,
        onChange: undefined | ((checked: boolean, room: Room) => void),
        truncateAt: number,
        overflowTile: (overflowCount: number, totalCount: number) => JSX.Element,
    ): ReactNode;
    spacesRenderer?(
        spaces: Room[],
        selectedToAdd: Set<Room>,
        onChange?: (checked: boolean, room: Room) => void,
    ): ReactNode;
    dmsRenderer?(
        dms: Room[],
        selectedToAdd: Set<Room>,
        onChange?: (checked: boolean, room: Room) => void,
    ): ReactNode;
}

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
    const visibleRooms = useMemo(() => cli.getVisibleRooms().filter(r => r.getMyMembership() === "join"), [cli]);

    const [selectedToAdd, setSelectedToAdd] = useState(new Set<Room>());
    const [progress, setProgress] = useState<number>(null);
    const [error, setError] = useState<Error>(null);
    const [query, setQuery] = useState("");
    const lcQuery = query.toLowerCase().trim();

    const existingSubspacesSet = useMemo(() => new Set(SpaceStore.instance.getChildSpaces(space.roomId)), [space]);
    const existingRoomsSet = useMemo(() => new Set(SpaceStore.instance.getChildRooms(space.roomId)), [space]);

    const [spaces, rooms, dms] = useMemo(() => {
        let rooms = visibleRooms;

        if (lcQuery) {
            const matcher = new QueryMatcher<Room>(visibleRooms, {
                keys: ["name"],
                funcs: [r => [r.getCanonicalAlias(), ...r.getAltAliases()].filter(Boolean)],
                shouldMatchWordsOnly: false,
            });

            rooms = matcher.match(lcQuery);
        }

        const joinRule = space.getJoinRule();
        return sortRooms(rooms).reduce((arr, room) => {
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
        }, [[], [], []]);
    }, [visibleRooms, space, lcQuery, existingRoomsSet, existingSubspacesSet]);

    const addRooms = async () => {
        setError(null);
        setProgress(0);

        let error;

        for (const room of selectedToAdd) {
            const via = calculateRoomVia(room);
            try {
                await SpaceStore.instance.addRoomToSpace(space, room.roomId, via).catch(async e => {
                    if (e.errcode === "M_LIMIT_EXCEEDED") {
                        await sleep(e.data.retry_after_ms);
                        return SpaceStore.instance.addRoomToSpace(space, room.roomId, via); // retry
                    }

                    throw e;
                });
                setProgress(i => i + 1);
            } catch (e) {
                logger.error("Failed to add rooms to space", e);
                setError(error = e);
                break;
            }
        }

        if (!error) {
            onFinished(true);
        }
    };

    const busy = progress !== null;

    let footer;
    if (error) {
        footer = <>
            <img
                src={require("../../../../res/img/element-icons/warning-badge.svg")}
                height="24"
                width="24"
                alt=""
            />

            <span className="mx_AddExistingToSpaceDialog_error">
                <div className="mx_AddExistingToSpaceDialog_errorHeading">{ _t("Not all selected were added") }</div>
                <div className="mx_AddExistingToSpaceDialog_errorCaption">{ _t("Try again") }</div>
            </span>

            <AccessibleButton className="mx_AddExistingToSpaceDialog_retryButton" onClick={addRooms}>
                { _t("Retry") }
            </AccessibleButton>
        </>;
    } else if (busy) {
        footer = <span>
            <ProgressBar value={progress} max={selectedToAdd.size} />
            <div className="mx_AddExistingToSpaceDialog_progressText">
                { _t("Adding rooms... (%(progress)s out of %(count)s)", {
                    count: selectedToAdd.size,
                    progress,
                }) }
            </div>
        </span>;
    } else {
        let button = emptySelectionButton;
        if (!button || selectedToAdd.size > 0) {
            button = <AccessibleButton kind="primary" disabled={selectedToAdd.size < 1} onClick={addRooms}>
                { _t("Add") }
            </AccessibleButton>;
        }

        footer = <>
            <span>
                { footerPrompt }
            </span>

            { button }
        </>;
    }

    const onChange = !busy && !error ? (checked: boolean, room: Room) => {
        if (checked) {
            selectedToAdd.add(room);
        } else {
            selectedToAdd.delete(room);
        }
        setSelectedToAdd(new Set(selectedToAdd));
    } : null;

    const [truncateAt, setTruncateAt] = useState(20);
    function overflowTile(overflowCount: number, totalCount: number): JSX.Element {
        const text = _t("and %(count)s others...", { count: overflowCount });
        return (
            <EntityTile
                className="mx_EntityTile_ellipsis"
                avatarJsx={
                    <BaseAvatar url={require("../../../../res/img/ellipsis.svg")} name="..." width={36} height={36} />
                }
                name={text}
                presenceState="online"
                suppressOnHover={true}
                onClick={() => setTruncateAt(totalCount)}
            />
        );
    }

    let noResults = true;
    if ((roomsRenderer && rooms.length > 0) ||
        (dmsRenderer && dms.length > 0) ||
        (!roomsRenderer && !dmsRenderer && spacesRenderer && spaces.length > 0) // only count spaces when alone
    ) {
        noResults = false;
    }

    return <div className="mx_AddExistingToSpace">
        <SearchBox
            className="mx_textinput_icon mx_textinput_search"
            placeholder={filterPlaceholder}
            onSearch={setQuery}
            autoFocus={true}
        />
        <AutoHideScrollbar className="mx_AddExistingToSpace_content">
            { rooms.length > 0 && roomsRenderer ? (
                roomsRenderer(rooms, selectedToAdd, onChange, truncateAt, overflowTile)
            ) : undefined }

            { spaces.length > 0 && spacesRenderer ? (
                spacesRenderer(spaces, selectedToAdd, onChange)
            ) : null }

            { dms.length > 0 && dmsRenderer ? (
                dmsRenderer(dms, selectedToAdd, onChange)
            ) : null }

            { noResults ? <span className="mx_AddExistingToSpace_noResults">
                { _t("No results") }
            </span> : undefined }
        </AutoHideScrollbar>

        <div className="mx_AddExistingToSpace_footer">
            { footer }
        </div>
    </div>;
};

export const defaultRoomsRenderer: IAddExistingToSpaceProps["roomsRenderer"] = (
    rooms, selectedToAdd, onChange, truncateAt, overflowTile,
) => (
    <div className="mx_AddExistingToSpace_section">
        <h3>{ _t("Rooms") }</h3>
        <TruncatedList
            truncateAt={truncateAt}
            createOverflowElement={overflowTile}
            getChildren={(start, end) => rooms.slice(start, end).map(room =>
                <Entry
                    key={room.roomId}
                    room={room}
                    checked={selectedToAdd.has(room)}
                    onChange={onChange ? (checked: boolean) => {
                        onChange(checked, room);
                    } : null}
                />,
            )}
            getChildCount={() => rooms.length}
        />
    </div>
);

export const defaultSpacesRenderer: IAddExistingToSpaceProps["spacesRenderer"] = (spaces, selectedToAdd, onChange) => (
    <div className="mx_AddExistingToSpace_section">
        { spaces.map(space => {
            return <Entry
                key={space.roomId}
                room={space}
                checked={selectedToAdd.has(space)}
                onChange={onChange ? (checked) => {
                    onChange(checked, space);
                } : null}
            />;
        }) }
    </div>
);

export const defaultDmsRenderer: IAddExistingToSpaceProps["dmsRenderer"] = (dms, selectedToAdd, onChange) => (
    <div className="mx_AddExistingToSpace_section">
        <h3>{ _t("Direct Messages") }</h3>
        { dms.map(room => {
            return <Entry
                key={room.roomId}
                room={room}
                checked={selectedToAdd.has(room)}
                onChange={onChange ? (checked: boolean) => {
                    onChange(checked, room);
                } : null}
            />;
        }) }
    </div>
);

interface ISubspaceSelectorProps {
    title: string;
    space: Room;
    value: Room;
    onChange(space: Room): void;
}

export const SubspaceSelector = ({ title, space, value, onChange }: ISubspaceSelectorProps) => {
    const options = useMemo(() => {
        return [space, ...SpaceStore.instance.getChildSpaces(space.roomId).filter(space => {
            return space.currentState.maySendStateEvent(EventType.SpaceChild, space.client.credentials.userId);
        })];
    }, [space]);

    let body;
    if (options.length > 1) {
        body = (
            <Dropdown
                id="mx_SpaceSelectDropdown"
                className="mx_SpaceSelectDropdown"
                onOptionChange={(key: string) => {
                    onChange(options.find(space => space.roomId === key) || space);
                }}
                value={value.roomId}
                label={_t("Space selection")}
            >
                { options.map((space) => {
                    const classes = classNames({
                        mx_SubspaceSelector_dropdownOptionActive: space === value,
                    });
                    return <div key={space.roomId} className={classes}>
                        <RoomAvatar room={space} width={24} height={24} />
                        { space.name || getDisplayAliasForRoom(space) || space.roomId }
                    </div>;
                }) }
            </Dropdown>
        );
    } else {
        body = (
            <div className="mx_SubspaceSelector_onlySpace">
                { space.name || getDisplayAliasForRoom(space) || space.roomId }
            </div>
        );
    }

    return <div className="mx_SubspaceSelector">
        <RoomAvatar room={value} height={40} width={40} />
        <div>
            <h1>{ title }</h1>
            { body }
        </div>
    </div>;
};

const AddExistingToSpaceDialog: React.FC<IProps> = ({ space, onCreateRoomClick, onAddSubspaceClick, onFinished }) => {
    const [selectedSpace, setSelectedSpace] = useState(space);

    return <BaseDialog
        title={(
            <SubspaceSelector
                title={_t("Add existing rooms")}
                space={space}
                value={selectedSpace}
                onChange={setSelectedSpace}
            />
        )}
        className="mx_AddExistingToSpaceDialog"
        contentId="mx_AddExistingToSpace"
        onFinished={onFinished}
        fixedWidth={false}
    >
        <MatrixClientContext.Provider value={space.client}>
            <AddExistingToSpace
                space={space}
                onFinished={onFinished}
                footerPrompt={<>
                    <div>{ _t("Want to add a new room instead?") }</div>
                    <AccessibleButton
                        kind="link"
                        onClick={() => {
                            onCreateRoomClick();
                            onFinished();
                        }}
                    >
                        { _t("Create a new room") }
                    </AccessibleButton>
                </>}
                filterPlaceholder={_t("Search for rooms")}
                roomsRenderer={defaultRoomsRenderer}
                spacesRenderer={() => (
                    <div className="mx_AddExistingToSpace_section">
                        <h3>{ _t("Spaces") }</h3>
                        <AccessibleButton
                            kind="link"
                            onClick={() => {
                                onAddSubspaceClick();
                                onFinished();
                            }}
                        >
                            { _t("Adding spaces has moved.") }
                        </AccessibleButton>
                    </div>
                )}
                dmsRenderer={defaultDmsRenderer}
            />
        </MatrixClientContext.Provider>
    </BaseDialog>;
};

export default AddExistingToSpaceDialog;

