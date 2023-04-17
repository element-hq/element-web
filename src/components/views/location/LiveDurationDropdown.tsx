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

import React, { ReactElement } from "react";

import { formatDuration } from "../../../DateUtils";
import { _t } from "../../../languageHandler";
import Dropdown from "../elements/Dropdown";
import { NonEmptyArray } from "../../../@types/common";

const DURATION_MS = {
    fifteenMins: 900000,
    oneHour: 3600000,
    eightHours: 28800000,
};

export const DEFAULT_DURATION_MS = DURATION_MS.fifteenMins;

interface Props {
    timeout: number;
    onChange: (timeout: number) => void;
}

const getLabel = (durationMs: number): string => {
    return _t("Share for %(duration)s", { duration: formatDuration(durationMs) });
};

const LiveDurationDropdown: React.FC<Props> = ({ timeout, onChange }) => {
    const options = Object.values(DURATION_MS).map((duration) => ({
        key: duration.toString(),
        duration,
        label: getLabel(duration),
    }));

    // timeout is not one of our default values
    // eg it was set by another client
    if (!Object.values(DURATION_MS).includes(timeout)) {
        options.push({
            key: timeout.toString(),
            duration: timeout,
            label: getLabel(timeout),
        });
    }

    const onOptionChange = (key: string): void => {
        // stringified value back to number
        onChange(+key);
    };

    return (
        <Dropdown
            id="live-duration"
            data-testid="live-duration-dropdown"
            label={getLabel(timeout)}
            value={timeout.toString()}
            onOptionChange={onOptionChange}
            className="mx_LiveDurationDropdown"
        >
            {
                options.map(({ key, label }) => (
                    <div data-testid={`live-duration-option-${key}`} key={key}>
                        {label}
                    </div>
                )) as NonEmptyArray<ReactElement & { key: string }>
            }
        </Dropdown>
    );
};

export default LiveDurationDropdown;
