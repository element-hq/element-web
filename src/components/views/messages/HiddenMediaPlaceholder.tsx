/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type MouseEventHandler } from "react";
import { VisibilityOnIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";

interface IProps {
    kind: "m.image" | "m.video";
    onClick: MouseEventHandler<HTMLButtonElement>;
}

const HiddenMediaPlaceholder: React.FunctionComponent<IProps> = (props) => {
    return (
        <button onClick={props.onClick} className="mx_HiddenMediaPlaceholder">
            <div>
                <VisibilityOnIcon />
                <span>
                    {props.kind === "m.image" ? _t("timeline|m.image|show_image") : _t("timeline|m.video|show_video")}
                </span>
            </div>
        </button>
    );
};

export default HiddenMediaPlaceholder;
