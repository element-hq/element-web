/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type HTMLProps } from "react";
import { Tooltip } from "@vector-im/compound-web";

import { _t } from "../../../../languageHandler";
import StyledCheckbox, { CheckboxStyle } from "../../elements/StyledCheckbox";

interface Props extends Omit<HTMLProps<HTMLDivElement>, "className"> {
    selectedDeviceCount: number;
    isAllSelected: boolean;
    isSelectDisabled?: boolean;
    toggleSelectAll: () => void;
    children?: React.ReactNode;
}

const FilteredDeviceListHeader: React.FC<Props> = ({
    selectedDeviceCount,
    isAllSelected,
    isSelectDisabled,
    toggleSelectAll,
    children,
    ...rest
}) => {
    const checkboxLabel = isAllSelected ? _t("common|deselect_all") : _t("common|select_all");
    return (
        <div className="mx_FilteredDeviceListHeader" {...rest}>
            {!isSelectDisabled && (
                <Tooltip label={checkboxLabel} placement="top" isTriggerInteractive={false}>
                    <StyledCheckbox
                        kind={CheckboxStyle.Solid}
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        id="device-select-all-checkbox"
                        data-testid="device-select-all-checkbox"
                        aria-label={checkboxLabel}
                    />
                </Tooltip>
            )}
            <span className="mx_FilteredDeviceListHeader_label">
                {selectedDeviceCount > 0
                    ? _t("settings|sessions|n_sessions_selected", { count: selectedDeviceCount })
                    : _t("settings|sessions|title")}
            </span>
            {children}
        </div>
    );
};

export default FilteredDeviceListHeader;
