/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEventHandler, type FormEventHandler, useCallback, useState } from "react";
import { SettingsToggleInput, Form, Button } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";
import StyledLiveBeaconIcon from "../beacon/StyledLiveBeaconIcon";
import Heading from "../typography/Heading";

interface Props {
    onSubmit: () => void;
}

export const EnableLiveShare: React.FC<Props> = ({ onSubmit }) => {
    const [isEnabled, setEnabled] = useState(false);

    const onEnabledChanged = useCallback<ChangeEventHandler<HTMLInputElement>>(
        (e) => setEnabled(e.target.checked),
        [setEnabled],
    );

    const onSubmitForm = useCallback<FormEventHandler>(
        (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            if (isEnabled) {
                onSubmit();
            }
        },
        [isEnabled, onSubmit],
    );

    return (
        <div data-testid="location-picker-enable-live-share" className="mx_EnableLiveShare">
            <StyledLiveBeaconIcon className="mx_EnableLiveShare_icon" />
            <Heading className="mx_EnableLiveShare_heading" size="3">
                {_t("location_sharing|live_enable_heading")}
            </Heading>
            <p className="mx_EnableLiveShare_description">{_t("location_sharing|live_enable_description")}</p>
            <Form.Root onSubmit={onSubmitForm}>
                <SettingsToggleInput
                    name="enable-live-share-toggle"
                    checked={isEnabled}
                    onChange={onEnabledChanged}
                    label={_t("location_sharing|live_toggle_label")}
                />
                <Button className="mx_EnableLiveShare_button" kind="primary" disabled={!isEnabled}>
                    {_t("action|ok")}
                </Button>
            </Form.Root>
        </div>
    );
};
