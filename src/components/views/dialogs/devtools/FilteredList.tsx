/*
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React, { ChangeEvent, useEffect, useState } from "react";

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
                {_t("and %(count)s others...", { count: overflowCount })}
            </button>
        );
    };

    return (
        <>
            <Field
                label={_t("Filter results")}
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
                _t("No results found")
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
