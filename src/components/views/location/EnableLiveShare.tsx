/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState } from "react";

import { _t } from "../../../languageHandler";
import StyledLiveBeaconIcon from "../beacon/StyledLiveBeaconIcon";
import AccessibleButton from "../elements/AccessibleButton";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import Heading from "../typography/Heading";

interface Props {
    onSubmit: () => void;
}

export const EnableLiveShare: React.FC<Props> = ({ onSubmit }) => {
    const [isEnabled, setEnabled] = useState(false);
    return (
        <div data-testid="location-picker-enable-live-share" className="mx_EnableLiveShare">
            <StyledLiveBeaconIcon className="mx_EnableLiveShare_icon" />
            <Heading className="mx_EnableLiveShare_heading" size="3">
                {_t("location_sharing|live_enable_heading")}
            </Heading>
            <p className="mx_EnableLiveShare_description">{_t("location_sharing|live_enable_description")}</p>
            <LabelledToggleSwitch
                data-testid="enable-live-share-toggle"
                value={isEnabled}
                onChange={setEnabled}
                label={_t("location_sharing|live_toggle_label")}
            />
            <AccessibleButton
                data-testid="enable-live-share-submit"
                className="mx_EnableLiveShare_button"
                element="button"
                kind="primary"
                onClick={onSubmit}
                disabled={!isEnabled}
            >
                {_t("action|ok")}
            </AccessibleButton>
        </div>
    );
};
