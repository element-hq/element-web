/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { ReactElement } from "react";
import classNames from "classnames";

import { Icon as CheckmarkIcon } from "../../../../res/img/element-icons/roomlist/checkmark.svg";
import Dropdown, { DropdownProps } from "./Dropdown";
import { NonEmptyArray } from "../../../@types/common";

export type FilterDropdownOption<FilterKeysType extends string> = {
    id: FilterKeysType;
    label: string;
    description?: string;
};
type FilterDropdownProps<FilterKeysType extends string> = Omit<DropdownProps, "children"> & {
    value: FilterKeysType;
    options: FilterDropdownOption<FilterKeysType>[];
    // A label displayed before the selected value
    // in the dropdown input
    selectedLabel?: string;
};

const getSelectedFilterOptionComponent =
    <FilterKeysType extends string>(options: FilterDropdownOption<FilterKeysType>[], selectedLabel?: string) =>
    (filterKey: FilterKeysType) => {
        const option = options.find(({ id }) => id === filterKey);
        if (!option) {
            return null;
        }
        if (selectedLabel) {
            return `${selectedLabel}: ${option.label}`;
        }
        return option.label;
    };

/**
 * Dropdown styled for list filtering
 */
export const FilterDropdown = <FilterKeysType extends string = string>({
    value,
    options,
    selectedLabel,
    className,
    ...restProps
}: FilterDropdownProps<FilterKeysType>): React.ReactElement<FilterDropdownProps<FilterKeysType>> => {
    return (
        <Dropdown
            {...restProps}
            value={value}
            className={classNames("mx_FilterDropdown", className)}
            getShortOption={getSelectedFilterOptionComponent<FilterKeysType>(options, selectedLabel)}
        >
            {
                options.map(({ id, label, description }) => (
                    <div className="mx_FilterDropdown_option" data-testid={`filter-option-${id}`} key={id}>
                        {id === value && <CheckmarkIcon className="mx_FilterDropdown_optionSelectedIcon" />}
                        <span className="mx_FilterDropdown_optionLabel">{label}</span>
                        {!!description && <span className="mx_FilterDropdown_optionDescription">{description}</span>}
                    </div>
                )) as NonEmptyArray<ReactElement & { key: string }>
            }
        </Dropdown>
    );
};
