/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import * as React from "react";

import { ALTERNATE_KEY_NAME } from "../../accessibility/KeyboardShortcuts";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { type ActionPayload } from "../../dispatcher/payloads";
import { IS_MAC, Key } from "../../Keyboard";
import { _t } from "../../languageHandler";
import AccessibleButton from "../views/elements/AccessibleButton";
import { Action } from "../../dispatcher/actions";

interface IProps {
    isMinimized: boolean;
}

export default class RoomSearch extends React.PureComponent<IProps> {
    private dispatcherRef?: string;

    public componentDidMount(): void {
        this.dispatcherRef = defaultDispatcher.register(this.onAction);
    }

    public componentWillUnmount(): void {
        defaultDispatcher.unregister(this.dispatcherRef);
    }

    private openSpotlight(): void {
        defaultDispatcher.fire(Action.OpenSpotlight);
    }

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === "focus_room_filter") {
            this.openSpotlight();
        }
    };

    public render(): React.ReactNode {
        const classes = classNames(
            {
                mx_RoomSearch: true,
                mx_RoomSearch_minimized: this.props.isMinimized,
            },
            "mx_RoomSearch_spotlightTrigger",
        );

        const icon = <div className="mx_RoomSearch_icon" />;

        const shortcutPrompt = (
            <kbd className="mx_RoomSearch_shortcutPrompt">
                {IS_MAC ? "⌘ K" : _t(ALTERNATE_KEY_NAME[Key.CONTROL]) + " K"}
            </kbd>
        );

        return (
            <AccessibleButton onClick={this.openSpotlight} className={classes} aria-label={_t("action|search")}>
                {icon}
                {!this.props.isMinimized && (
                    <div className="mx_RoomSearch_spotlightTriggerText">{_t("action|search")}</div>
                )}
                {shortcutPrompt}
            </AccessibleButton>
        );
    }
}
