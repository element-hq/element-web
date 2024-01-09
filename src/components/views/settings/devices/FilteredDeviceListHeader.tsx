/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React, { HTMLProps } from "react";
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
                <Tooltip label={checkboxLabel} side="top" isTriggerInteractive={false}>
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
