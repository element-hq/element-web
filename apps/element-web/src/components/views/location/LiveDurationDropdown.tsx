/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement } from "react";

import { formatDuration } from "../../../DateUtils";
import { _t } from "../../../languageHandler";
import Dropdown from "../elements/Dropdown";
import { type NonEmptyArray } from "../../../@types/common";

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
    return _t("location_sharing|live_share_button", { duration: formatDuration(durationMs) });
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
