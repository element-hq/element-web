/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, useEffect, useState } from "react";

import { _t } from "../../../../languageHandler";
import Field from "../../elements/Field";
import TruncatedList from "../../elements/TruncatedList";

const INITIAL_LOAD_TILES = 20;
const LOAD_TILES_STEP_SIZE = 50;

interface IProps {
    children: React.ReactElement[];
    query: string;
    onChange(value: string): void;
}

const FilteredList: React.FC<IProps> = ({ children, query, onChange }) => {
    const [truncateAt, setTruncateAt] = useState<number>(INITIAL_LOAD_TILES);
    const [filteredChildren, setFilteredChildren] = useState<React.ReactElement[]>(children);

    useEffect(() => {
        let filteredChildren = children;
        if (query) {
            const lcQuery = query.toLowerCase();
            filteredChildren = children.filter((child) => child.key?.toString().toLowerCase().includes(lcQuery));
        }
        setFilteredChildren(filteredChildren);
        setTruncateAt(INITIAL_LOAD_TILES);
    }, [children, query]);

    const getChildren = (start: number, end: number): React.ReactElement[] => {
        return filteredChildren.slice(start, end);
    };

    const getChildCount = (): number => {
        return filteredChildren.length;
    };

    const createOverflowElement = (overflowCount: number, totalCount: number): JSX.Element => {
        const showMore = (): void => {
            setTruncateAt((num) => num + LOAD_TILES_STEP_SIZE);
        };

        return (
            <button className="mx_DevTools_button" onClick={showMore}>
                {_t("common|and_n_others", { count: overflowCount })}
            </button>
        );
    };

    return (
        <>
            <Field
                label={_t("common|filter_results")}
                autoFocus={true}
                size={64}
                type="text"
                autoComplete="off"
                value={query}
                onChange={(ev: ChangeEvent<HTMLInputElement>) => onChange(ev.target.value)}
                className="mx_TextInputDialog_input mx_DevTools_RoomStateExplorer_query"
                // force re-render so that autoFocus is applied when this component is re-used
                key={children?.[0]?.key ?? ""}
            />

            {filteredChildren.length < 1 ? (
                _t("common|no_results_found")
            ) : (
                <TruncatedList
                    getChildren={getChildren}
                    getChildCount={getChildCount}
                    truncateAt={truncateAt}
                    createOverflowElement={createOverflowElement}
                />
            )}
        </>
    );
};

export default FilteredList;
