/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";
import { type IBodyProps } from "./IBodyProps";

export default class MjolnirBody extends React.Component<IBodyProps> {
    private onAllowClick = (e: ButtonEvent): void => {
        e.preventDefault();
        e.stopPropagation();

        const key = `mx_mjolnir_render_${this.props.mxEvent.getRoomId()}__${this.props.mxEvent.getId()}`;
        localStorage.setItem(key, "true");
        this.props.onMessageAllowed?.();
    };

    public render(): React.ReactNode {
        return (
            <div className="mx_MjolnirBody">
                <i>
                    {_t(
                        "timeline|mjolnir|message_hidden",
                        {},
                        {
                            a: (sub) => (
                                <AccessibleButton kind="link_inline" onClick={this.onAllowClick}>
                                    {sub}
                                </AccessibleButton>
                            ),
                        },
                    )}
                </i>
            </div>
        );
    }
}
