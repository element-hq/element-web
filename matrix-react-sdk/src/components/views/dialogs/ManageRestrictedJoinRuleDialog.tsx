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

import React, { useMemo, useState } from "react";
import { Room } from "matrix-js-sdk/src/models/room";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import SearchBox from "../../structures/SearchBox";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import RoomAvatar from "../avatars/RoomAvatar";
import AccessibleButton from "../elements/AccessibleButton";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import StyledCheckbox from "../elements/StyledCheckbox";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { filterBoolean } from "../../../utils/arrays";

interface IProps {
    room: Room;
    selected?: string[];
    onFinished(rooms?: string[]): void;
}

const Entry: React.FC<{
    room: Room;
    checked: boolean;
    onChange(value: boolean): void;
}> = ({ room, checked, onChange }) => {
    const localRoom = room instanceof Room;

    let description;
    if (localRoom) {
        description = _t("%(count)s members", { count: room.getJoinedMemberCount() });
        const numChildRooms = SpaceStore.instance.getChildRooms(room.roomId).length;
        if (numChildRooms > 0) {
            description += " · " + _t("%(count)s rooms", { count: numChildRooms });
        }
    }

    return (
        <label className="mx_ManageRestrictedJoinRuleDialog_entry">
            <div>
                <div>
                    {localRoom ? (
                        <RoomAvatar room={room} height={20} width={20} />
                    ) : (
                        <RoomAvatar oobData={room} height={20} width={20} />
                    )}
                    <span className="mx_ManageRestrictedJoinRuleDialog_entry_name">{room.name}</span>
                </div>
                {description && (
                    <div className="mx_ManageRestrictedJoinRuleDialog_entry_description">{description}</div>
                )}
            </div>
            <StyledCheckbox
                onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
                checked={checked}
                disabled={!onChange}
            />
        </label>
    );
};

const addAllParents = (set: Set<Room>, room: Room): void => {
    const cli = room.client;
    const parents = Array.from(SpaceStore.instance.getKnownParents(room.roomId)).map((parentId) =>
        cli.getRoom(parentId),
    );

    parents.forEach((parent) => {
        if (!parent || set.has(parent)) return;
        set.add(parent);
        addAllParents(set, parent);
    });
};

const ManageRestrictedJoinRuleDialog: React.FC<IProps> = ({ room, selected = [], onFinished }) => {
    const cli = room.client;
    const [newSelected, setNewSelected] = useState(new Set<string>(selected));
    const [query, setQuery] = useState("");
    const lcQuery = query.toLowerCase().trim();

    const [spacesContainingRoom, otherEntries] = useMemo(() => {
        const parents = new Set<Room>();
        addAllParents(parents, room);
        return [
            Array.from(parents),
            filterBoolean(
                selected.map((roomId) => {
                    const room = cli.getRoom(roomId);
                    if (!room) {
                        return { roomId, name: roomId } as Room;
                    }
                    if (room.getMyMembership() !== "join" || !room.isSpaceRoom()) {
                        return room;
                    }
                }),
            ),
        ];
    }, [cli, selected, room]);

    const [filteredSpacesContainingRoom, filteredOtherEntries] = useMemo(
        () => [
            spacesContainingRoom.filter((r) => r.name.toLowerCase().includes(lcQuery)),
            otherEntries.filter((r) => r.name.toLowerCase().includes(lcQuery)),
        ],
        [spacesContainingRoom, otherEntries, lcQuery],
    );

    const onChange = (checked: boolean, room: Room): void => {
        if (checked) {
            newSelected.add(room.roomId);
        } else {
            newSelected.delete(room.roomId);
        }
        setNewSelected(new Set(newSelected));
    };

    let inviteOnlyWarning;
    if (newSelected.size < 1) {
        inviteOnlyWarning = (
            <div className="mx_ManageRestrictedJoinRuleDialog_section_info">
                {_t("You're removing all spaces. Access will default to invite only")}
            </div>
        );
    }

    return (
        <BaseDialog
            title={_t("Select spaces")}
            className="mx_ManageRestrictedJoinRuleDialog"
            onFinished={onFinished}
            fixedWidth={false}
        >
            <p>
                {_t(
                    "Decide which spaces can access this room. " +
                        "If a space is selected, its members can find and join <RoomName/>.",
                    {},
                    {
                        RoomName: () => <b>{room.name}</b>,
                    },
                )}
            </p>
            <MatrixClientContext.Provider value={cli}>
                <SearchBox
                    className="mx_textinput_icon mx_textinput_search"
                    placeholder={_t("Search spaces")}
                    onSearch={setQuery}
                    autoFocus={true}
                />
                <AutoHideScrollbar className="mx_ManageRestrictedJoinRuleDialog_content">
                    {filteredSpacesContainingRoom.length > 0 ? (
                        <div className="mx_ManageRestrictedJoinRuleDialog_section">
                            <h3>
                                {room.isSpaceRoom()
                                    ? _t("Spaces you know that contain this space")
                                    : _t("Spaces you know that contain this room")}
                            </h3>
                            {filteredSpacesContainingRoom.map((space) => {
                                return (
                                    <Entry
                                        key={space.roomId}
                                        room={space}
                                        checked={newSelected.has(space.roomId)}
                                        onChange={(checked: boolean) => {
                                            onChange(checked, space);
                                        }}
                                    />
                                );
                            })}
                        </div>
                    ) : undefined}

                    {filteredOtherEntries.length > 0 ? (
                        <div className="mx_ManageRestrictedJoinRuleDialog_section">
                            <h3>{_t("Other spaces or rooms you might not know")}</h3>
                            <div className="mx_ManageRestrictedJoinRuleDialog_section_info">
                                <div>{_t("These are likely ones other room admins are a part of.")}</div>
                            </div>
                            {filteredOtherEntries.map((space) => {
                                return (
                                    <Entry
                                        key={space.roomId}
                                        room={space}
                                        checked={newSelected.has(space.roomId)}
                                        onChange={(checked: boolean) => {
                                            onChange(checked, space);
                                        }}
                                    />
                                );
                            })}
                        </div>
                    ) : null}

                    {filteredSpacesContainingRoom.length + filteredOtherEntries.length < 1 ? (
                        <span className="mx_ManageRestrictedJoinRuleDialog_noResults">{_t("No results")}</span>
                    ) : undefined}
                </AutoHideScrollbar>

                <div className="mx_ManageRestrictedJoinRuleDialog_footer">
                    {inviteOnlyWarning}
                    <div className="mx_ManageRestrictedJoinRuleDialog_footer_buttons">
                        <AccessibleButton kind="primary_outline" onClick={() => onFinished()}>
                            {_t("Cancel")}
                        </AccessibleButton>
                        <AccessibleButton kind="primary" onClick={() => onFinished(Array.from(newSelected))}>
                            {_t("Confirm")}
                        </AccessibleButton>
                    </div>
                </div>
            </MatrixClientContext.Provider>
        </BaseDialog>
    );
};

export default ManageRestrictedJoinRuleDialog;
