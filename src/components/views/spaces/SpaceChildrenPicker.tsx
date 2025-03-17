/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useMemo, useState } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import StyledRadioGroup from "../elements/StyledRadioGroup";
import QueryMatcher from "../../../autocomplete/QueryMatcher";
import SearchBox from "../../structures/SearchBox";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import { Entry } from "../dialogs/AddExistingToSpaceDialog";
import { filterBoolean } from "../../../utils/arrays";

enum Target {
    All = "All",
    Specific = "Specific",
    None = "None",
}

interface ISpecificChildrenPickerProps {
    filterPlaceholder: string;
    rooms: Room[];
    selected: Set<Room>;
    onChange(selected: boolean, room: Room): void;
}

const SpecificChildrenPicker: React.FC<ISpecificChildrenPickerProps> = ({
    filterPlaceholder,
    rooms,
    selected,
    onChange,
}) => {
    const [query, setQuery] = useState("");
    const lcQuery = query.toLowerCase().trim();

    const filteredRooms = useMemo(() => {
        if (!lcQuery) {
            return rooms;
        }

        const matcher = new QueryMatcher<Room>(rooms, {
            keys: ["name"],
            funcs: [(r) => filterBoolean([r.getCanonicalAlias(), ...r.getAltAliases()])],
            shouldMatchWordsOnly: false,
        });

        return matcher.match(lcQuery);
    }, [rooms, lcQuery]);

    return (
        <div className="mx_SpaceChildrenPicker">
            <SearchBox
                className="mx_textinput_icon mx_textinput_search"
                placeholder={filterPlaceholder}
                onSearch={setQuery}
                autoFocus={true}
            />
            <AutoHideScrollbar>
                {filteredRooms.map((room) => {
                    return (
                        <Entry
                            key={room.roomId}
                            room={room}
                            checked={selected.has(room)}
                            onChange={(checked) => {
                                onChange(checked, room);
                            }}
                        />
                    );
                })}
                {filteredRooms.length < 1 ? (
                    <span className="mx_SpaceChildrenPicker_noResults">{_t("common|no_results")}</span>
                ) : undefined}
            </AutoHideScrollbar>
        </div>
    );
};

interface IProps {
    space: Room;
    spaceChildren: Room[];
    selected: Set<Room>;
    noneLabel?: string;
    allLabel: string;
    specificLabel: string;
    onChange(rooms: Room[]): void;
}

const SpaceChildrenPicker: React.FC<IProps> = ({
    space,
    spaceChildren,
    selected,
    onChange,
    noneLabel,
    allLabel,
    specificLabel,
}) => {
    const [state, setState] = useState<string>(noneLabel ? Target.None : Target.All);

    useEffect(() => {
        if (state === Target.All) {
            onChange(spaceChildren);
        } else {
            onChange([]);
        }
    }, [onChange, state, spaceChildren]);

    return (
        <>
            <div className="mx_SpaceChildrenPicker">
                <StyledRadioGroup
                    name="roomsToLeave"
                    value={state}
                    onChange={setState}
                    definitions={[
                        {
                            value: Target.None,
                            label: noneLabel,
                        },
                        {
                            value: Target.All,
                            label: allLabel,
                        },
                        {
                            value: Target.Specific,
                            label: specificLabel,
                        },
                    ].filter((d) => d.label)}
                />
            </div>

            {state === Target.Specific && (
                <SpecificChildrenPicker
                    filterPlaceholder={_t("space|search_children", { spaceName: space.name })}
                    rooms={spaceChildren}
                    selected={selected}
                    onChange={(isSelected: boolean, room: Room) => {
                        if (isSelected) {
                            onChange([room, ...selected]);
                        } else {
                            onChange([...selected].filter((r) => r !== room));
                        }
                    }}
                />
            )}
        </>
    );
};

export default SpaceChildrenPicker;
