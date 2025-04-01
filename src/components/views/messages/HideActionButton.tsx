/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import React from "react";
import { VisibilityOffIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { RovingAccessibleButton } from "../../../accessibility/RovingTabIndex";
import { _t } from "../../../languageHandler";
import { useMediaVisible } from "../../../hooks/useMediaVisible";

interface IProps {
    /**
     * Matrix event that this action applies to.
     */
    mxEvent: MatrixEvent;
}

/**
 * Quick action button for marking a media event as hidden.
 */
export const HideActionButton: React.FC<IProps> = ({ mxEvent }) => {
    const [mediaIsVisible, setVisible] = useMediaVisible(mxEvent.getId()!);

    if (!mediaIsVisible) {
        return;
    }

    return (
        <RovingAccessibleButton
            className="mx_MessageActionBar_iconButton "
            title={_t("action|hide")}
            onClick={() => setVisible(false)}
            placement="left"
        >
            <VisibilityOffIcon />
        </RovingAccessibleButton>
    );
};
