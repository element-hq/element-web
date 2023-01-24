/*
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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

import classNames from "classnames";
import * as React from "react";

import { ALTERNATE_KEY_NAME } from "../../accessibility/KeyboardShortcuts";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { ActionPayload } from "../../dispatcher/payloads";
import { IS_MAC, Key } from "../../Keyboard";
import { _t } from "../../languageHandler";
import Modal from "../../Modal";
import SpotlightDialog from "../views/dialogs/spotlight/SpotlightDialog";
import AccessibleButton from "../views/elements/AccessibleButton";

interface IProps {
    isMinimized: boolean;
}

export default class RoomSearch extends React.PureComponent<IProps> {
    private readonly dispatcherRef: string;

    public constructor(props: IProps) {
        super(props);

        this.dispatcherRef = defaultDispatcher.register(this.onAction);
    }

    public componentWillUnmount(): void {
        defaultDispatcher.unregister(this.dispatcherRef);
    }

    private openSpotlight(): void {
        Modal.createDialog(SpotlightDialog, {}, "mx_SpotlightDialog_wrapper", false, true);
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
            <AccessibleButton onClick={this.openSpotlight} className={classes}>
                {icon}
                {!this.props.isMinimized && <div className="mx_RoomSearch_spotlightTriggerText">{_t("Search")}</div>}
                {shortcutPrompt}
            </AccessibleButton>
        );
    }
}
