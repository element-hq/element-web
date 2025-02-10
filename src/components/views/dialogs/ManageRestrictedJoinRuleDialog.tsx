/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useMemo, useState } from "react";
import { Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

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
        description = _t("common|n_members", { count: room.getJoinedMemberCount() });
        const numChildRooms = SpaceStore.instance.getChildRooms(room.roomId).length;
        if (numChildRooms > 0) {
            description += " · " + _t("common|n_rooms", { count: numChildRooms });
        }
    }

    return (
        <label className="mx_ManageRestrictedJoinRuleDialog_entry">
            <div>
                <div>
                    {localRoom ? <RoomAvatar room={room} size="20px" /> : <RoomAvatar oobData={room} size="20px" />}
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

    const [spacesContainingRoom, otherJoinedSpaces, otherEntries] = useMemo(() => {
        const parents = new Set<Room>();
        addAllParents(parents, room);

        return [
            Array.from(parents),
            SpaceStore.instance.spacePanelSpaces.filter((s) => !parents.has(s)),
            filterBoolean(
                selected.map((roomId) => {
                    const room = cli.getRoom(roomId);
                    if (!room) {
                        return { roomId, name: roomId } as Room;
                    }
                    if (room.getMyMembership() !== KnownMembership.Join || !room.isSpaceRoom()) {
                        return room;
                    }
                }),
            ),
        ];
    }, [cli, selected, room]);

    const [filteredSpacesContainingRoom, filteredOtherJoinedSpaces, filteredOtherEntries] = useMemo(
        () => [
            spacesContainingRoom.filter((r) => r.name.toLowerCase().includes(lcQuery)),
            otherJoinedSpaces.filter((r) => r.name.toLowerCase().includes(lcQuery)),
            otherEntries.filter((r) => r.name.toLowerCase().includes(lcQuery)),
        ],
        [spacesContainingRoom, otherJoinedSpaces, otherEntries, lcQuery],
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
                {_t("room_settings|security|join_rule_restricted_dialog_empty_warning")}
            </div>
        );
    }

    const totalResults =
        filteredSpacesContainingRoom.length + filteredOtherJoinedSpaces.length + filteredOtherEntries.length;
    return (
        <BaseDialog
            title={_t("room_settings|security|join_rule_restricted_dialog_title")}
            className="mx_ManageRestrictedJoinRuleDialog"
            onFinished={onFinished}
            fixedWidth={false}
        >
            <p>
                {_t(
                    "room_settings|security|join_rule_restricted_dialog_description",
                    {},
                    {
                        RoomName: () => <strong>{room.name}</strong>,
                    },
                )}
            </p>
            <MatrixClientContext.Provider value={cli}>
                <SearchBox
                    className="mx_textinput_icon mx_textinput_search"
                    placeholder={_t("room_settings|security|join_rule_restricted_dialog_filter_placeholder")}
                    onSearch={setQuery}
                    autoFocus={true}
                />
                <AutoHideScrollbar className="mx_ManageRestrictedJoinRuleDialog_content">
                    {filteredSpacesContainingRoom.length > 0 ? (
                        <div className="mx_ManageRestrictedJoinRuleDialog_section">
                            <h3>
                                {room.isSpaceRoom()
                                    ? _t("room_settings|security|join_rule_restricted_dialog_heading_space")
                                    : _t("room_settings|security|join_rule_restricted_dialog_heading_room")}
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
                            <h3>{_t("room_settings|security|join_rule_restricted_dialog_heading_other")}</h3>
                            <div className="mx_ManageRestrictedJoinRuleDialog_section_info">
                                <div>{_t("room_settings|security|join_rule_restricted_dialog_heading_unknown")}</div>
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

                    {filteredOtherJoinedSpaces.length > 0 ? (
                        <div className="mx_ManageRestrictedJoinRuleDialog_section">
                            <h3>{_t("room_settings|security|join_rule_restricted_dialog_heading_known")}</h3>
                            {filteredOtherJoinedSpaces.map((space) => {
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

                    {totalResults < 1 ? (
                        <span className="mx_ManageRestrictedJoinRuleDialog_noResults">{_t("common|no_results")}</span>
                    ) : undefined}
                </AutoHideScrollbar>

                <div className="mx_ManageRestrictedJoinRuleDialog_footer">
                    {inviteOnlyWarning}
                    <div className="mx_ManageRestrictedJoinRuleDialog_footer_buttons">
                        <AccessibleButton kind="primary_outline" onClick={() => onFinished()}>
                            {_t("action|cancel")}
                        </AccessibleButton>
                        <AccessibleButton kind="primary" onClick={() => onFinished(Array.from(newSelected))}>
                            {_t("action|confirm")}
                        </AccessibleButton>
                    </div>
                </div>
            </MatrixClientContext.Provider>
        </BaseDialog>
    );
};

export default ManageRestrictedJoinRuleDialog;
