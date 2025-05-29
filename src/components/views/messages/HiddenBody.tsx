/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import { _t } from "../../../languageHandler";
import { type IBodyProps } from "./IBodyProps";

/**
 * A message hidden from the user pending moderation.
 *
 * Note: This component must not be used when the user is the author of the message
 * or has a sufficient powerlevel to see the message.
 */
const HiddenBody = ({ mxEvent, ref }: IBodyProps): JSX.Element => {
    let text;
    const visibility = mxEvent.messageVisibility();
    switch (visibility.visible) {
        case true:
            throw new Error("HiddenBody should only be applied to hidden messages");
        case false:
            if (visibility.reason) {
                text = _t("timeline|pending_moderation_reason", { reason: visibility.reason });
            } else {
                text = _t("timeline|pending_moderation");
            }
            break;
    }

    return (
        <span className="mx_HiddenBody" ref={ref}>
            {text}
        </span>
    );
};

export default HiddenBody;
