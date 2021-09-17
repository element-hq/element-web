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

import React, { useEffect, useMemo, useState } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { JoinRule } from "matrix-js-sdk/src/@types/partials";

import { _t } from '../../../languageHandler';
import DialogButtons from "../elements/DialogButtons";
import BaseDialog from "../dialogs/BaseDialog";
import SpaceStore from "../../../stores/SpaceStore";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import { Entry } from "./AddExistingToSpaceDialog";
import SearchBox from "../../structures/SearchBox";
import QueryMatcher from "../../../autocomplete/QueryMatcher";
import StyledRadioGroup from "../elements/StyledRadioGroup";

enum RoomsToLeave {
    All = "All",
    Specific = "Specific",
    None = "None",
}

const SpaceChildPicker = ({ filterPlaceholder, rooms, selected, onChange }) => {
    const [query, setQuery] = useState("");
    const lcQuery = query.toLowerCase().trim();

    const filteredRooms = useMemo(() => {
        if (!lcQuery) {
            return rooms;
        }

        const matcher = new QueryMatcher<Room>(rooms, {
            keys: ["name"],
            funcs: [r => [r.getCanonicalAlias(), ...r.getAltAliases()].filter(Boolean)],
            shouldMatchWordsOnly: false,
        });

        return matcher.match(lcQuery);
    }, [rooms, lcQuery]);

    return <div className="mx_LeaveSpaceDialog_section">
        <SearchBox
            className="mx_textinput_icon mx_textinput_search"
            placeholder={filterPlaceholder}
            onSearch={setQuery}
            autoFocus={true}
        />
        <AutoHideScrollbar className="mx_LeaveSpaceDialog_content">
            { filteredRooms.map(room => {
                return <Entry
                    key={room.roomId}
                    room={room}
                    checked={selected.has(room)}
                    onChange={(checked) => {
                        onChange(checked, room);
                    }}
                />;
            }) }
            { filteredRooms.length < 1 ? <span className="mx_LeaveSpaceDialog_noResults">
                { _t("No results") }
            </span> : undefined }
        </AutoHideScrollbar>
    </div>;
};

const LeaveRoomsPicker = ({ space, spaceChildren, roomsToLeave, setRoomsToLeave }) => {
    const selected = useMemo(() => new Set(roomsToLeave), [roomsToLeave]);
    const [state, setState] = useState<string>(RoomsToLeave.None);

    useEffect(() => {
        if (state === RoomsToLeave.All) {
            setRoomsToLeave(spaceChildren);
        } else {
            setRoomsToLeave([]);
        }
    }, [setRoomsToLeave, state, spaceChildren]);

    return <div className="mx_LeaveSpaceDialog_section">
        <StyledRadioGroup
            name="roomsToLeave"
            value={state}
            onChange={setState}
            definitions={[
                {
                    value: RoomsToLeave.None,
                    label: _t("Don't leave any"),
                }, {
                    value: RoomsToLeave.All,
                    label: _t("Leave all rooms and spaces"),
                }, {
                    value: RoomsToLeave.Specific,
                    label: _t("Leave specific rooms and spaces"),
                },
            ]}
        />

        { state === RoomsToLeave.Specific && (
            <SpaceChildPicker
                filterPlaceholder={_t("Search %(spaceName)s", { spaceName: space.name })}
                rooms={spaceChildren}
                selected={selected}
                onChange={(selected: boolean, room: Room) => {
                    if (selected) {
                        setRoomsToLeave([room, ...roomsToLeave]);
                    } else {
                        setRoomsToLeave(roomsToLeave.filter(r => r !== room));
                    }
                }}
            />
        ) }
    </div>;
};

interface IProps {
    space: Room;
    onFinished(leave: boolean, rooms?: Room[]): void;
}

const isOnlyAdmin = (room: Room): boolean => {
    return !room.getJoinedMembers().some(member => {
        return member.userId !== room.client.credentials.userId && member.powerLevelNorm === 100;
    });
};

const LeaveSpaceDialog: React.FC<IProps> = ({ space, onFinished }) => {
    const spaceChildren = useMemo(() => SpaceStore.instance.getChildren(space.roomId), [space.roomId]);
    const [roomsToLeave, setRoomsToLeave] = useState<Room[]>([]);

    let rejoinWarning;
    if (space.getJoinRule() !== JoinRule.Public) {
        rejoinWarning = _t("You won't be able to rejoin unless you are re-invited.");
    }

    let onlyAdminWarning;
    if (isOnlyAdmin(space)) {
        onlyAdminWarning = _t("You're the only admin of this space. " +
            "Leaving it will mean no one has control over it.");
    } else {
        const numChildrenOnlyAdminIn = roomsToLeave.filter(isOnlyAdmin).length;
        if (numChildrenOnlyAdminIn > 0) {
            onlyAdminWarning = _t("You're the only admin of some of the rooms or spaces you wish to leave. " +
                "Leaving them will leave them without any admins.");
        }
    }

    return <BaseDialog
        title={_t("Leave %(spaceName)s", { spaceName: space.name })}
        className="mx_LeaveSpaceDialog"
        contentId="mx_LeaveSpaceDialog"
        onFinished={() => onFinished(false)}
        fixedWidth={false}
    >
        <div className="mx_Dialog_content" id="mx_LeaveSpaceDialog">
            <p>
                { _t("Are you sure you want to leave <spaceName/>?", {}, {
                    spaceName: () => <b>{ space.name }</b>,
                }) }
                &nbsp;
                { rejoinWarning }
            </p>

            { spaceChildren.length > 0 && <LeaveRoomsPicker
                space={space}
                spaceChildren={spaceChildren}
                roomsToLeave={roomsToLeave}
                setRoomsToLeave={setRoomsToLeave}
            /> }

            { onlyAdminWarning && <div className="mx_LeaveSpaceDialog_section_warning">
                { onlyAdminWarning }
            </div> }
        </div>
        <DialogButtons
            primaryButton={_t("Leave space")}
            onPrimaryButtonClick={() => onFinished(true, roomsToLeave)}
            hasCancel={true}
            onCancel={onFinished}
        />
    </BaseDialog>;
};

export default LeaveSpaceDialog;
