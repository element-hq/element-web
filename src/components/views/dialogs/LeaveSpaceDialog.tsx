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

import { _t } from '../../../languageHandler';
import Dropdown from "../elements/Dropdown";
import DialogButtons from "../elements/DialogButtons";
import BaseDialog from "../dialogs/BaseDialog";
import { JoinRule } from "../settings/tabs/room/SecurityRoomSettingsTab";
import SpaceStore from "../../../stores/SpaceStore";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import { Entry } from "./AddExistingToSpaceDialog";
import SearchBox from "../../structures/SearchBox";
import QueryMatcher from "../../../autocomplete/QueryMatcher";

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
            autoComplete={true}
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

const LeaveRoomsPicker = ({ space, roomsToLeave, setRoomsToLeave }) => {
    const selected = useMemo(() => new Set(roomsToLeave), [roomsToLeave]);
    const spaceChildren = useMemo(() => SpaceStore.instance.getChildren(space.roomId), [space.roomId]);
    const [state, setState] = useState<RoomsToLeave>(RoomsToLeave.All);

    useEffect(() => {
        if (state === RoomsToLeave.All) {
            setRoomsToLeave(spaceChildren);
        } else {
            setRoomsToLeave([]);
        }
    }, [setRoomsToLeave, state, spaceChildren]);

    let captionSpan;
    switch (state) {
        case RoomsToLeave.All:
            captionSpan = _t("You will leave all subspaces and rooms in <spaceName/>.", {}, {
                spaceName: () => <b>{ space.name }</b>,
            });
            break;
        case RoomsToLeave.None:
            captionSpan = _t("You'll still be a part of all rooms and subspaces in <spaceName/> you've joined.", {}, {
                spaceName: () => <b>{ space.name }</b>,
            });
            break;
        case RoomsToLeave.Specific:
            captionSpan = <span>{ _t("Pick which rooms and subspaces you want to leave.") }</span>;
            break;
    }

    if (spaceChildren.length < 1) {
        return <div>
            BOLD:
            { _t("Are you sure you want to leave %(spaceName)s? " +
                "You won't be able to rejoin unless you are re-invited", { spaceName: space.name }) }
        </div>;
    }

    return <div className="mx_LeaveSpaceDialog_section">
        <Dropdown
            id="mx_LeaveSpaceDialog_leaveRoomPickerDropdown"
            onOptionChange={setState}
            value={state}
            label={_t("Choose which rooms you wish to leave")}
        >
            <div key={RoomsToLeave.All}>
                { _t("Leave all subspaces and rooms") }
            </div>
            <div key={RoomsToLeave.None}>
                { _t("Don't leave any") }
            </div>
            <div key={RoomsToLeave.Specific}>
                { _t("Leave specific rooms and subspaces") }
            </div>
        </Dropdown>
        { captionSpan }

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
            onlyAdminWarning = _t("You're the only admin of some of the rooms or subspaces you wish to leave. " +
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

            <LeaveRoomsPicker space={space} roomsToLeave={roomsToLeave} setRoomsToLeave={setRoomsToLeave} />

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
