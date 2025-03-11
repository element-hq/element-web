/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import React, { useCallback } from "react";
import classNames from "classnames";
import { VisibilityOffIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { RovingAccessibleButton } from "../../../accessibility/RovingTabIndex";
import { _t, _td } from "../../../languageHandler";
import { SettingLevel } from "../../../settings/SettingLevel";
import { useSettingsValueWithSetter } from "../../../hooks/useSettings";

interface IProps {
    mxEvent: MatrixEvent;
}

const HideActionButton: React.FC<IProps> = ({mxEvent}) => {
    const eventId = mxEvent.getId();
    let spinner: JSX.Element | undefined;
    const [events, setEventIds] = useSettingsValueWithSetter("showMediaEventIds", SettingLevel.DEVICE);
    const onClick = useCallback(() => {
        if (!eventId) {
            return;
        }
        setEventIds({
            ...events,
            [eventId]: false,
        });
    }, [eventId, events]);

    const classes = classNames({
        mx_MessageActionBar_iconButton: true,
        mx_MessageActionBar_downloadButton: true,
        mx_MessageActionBar_downloadSpinnerButton: !!spinner,
    });

    if (!eventId || events[eventId] === false) {
        return;
    }

    return (
        <RovingAccessibleButton
            className={classes}
            title={_t("action|hide")}
            onClick={onClick}
            disabled={!!spinner}
            placement="left"
        >
            <VisibilityOffIcon />
            {spinner}
        </RovingAccessibleButton>
    );
}

export default HideActionButton;