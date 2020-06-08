/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import * as React from "react";
import {User} from "matrix-js-sdk/src/models/user";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { ActionPayload } from "../../dispatcher/payloads";
import { Action } from "../../dispatcher/actions";
import { createRef } from "react";
import { _t } from "../../languageHandler";
import {ContextMenu, ContextMenuButton} from "./ContextMenu";

interface IProps {
}

interface IState {
    user: User;
    menuDisplayed: boolean;
}

export default class UserMenuButton extends React.Component<IProps, IState> {
    private dispatcherRef: string;
    private buttonRef: React.RefObject<HTMLButtonElement> = createRef();

    constructor(props: IProps) {
        super(props);

        this.state = {
            menuDisplayed: false,
            user: MatrixClientPeg.get().getUser(MatrixClientPeg.get().getUserId()),
        };
    }

    private get displayName(): string {
        if (MatrixClientPeg.get().isGuest()) {
            return _t("Guest");
        } else if (this.state.user) {
            return this.state.user.displayName;
        } else {
            return MatrixClientPeg.get().getUserId();
        }
    }

    public componentDidMount() {
        this.dispatcherRef = defaultDispatcher.register(this.onAction);
    }

    private onAction = (ev: ActionPayload) => {
        if (ev.action !== Action.ToggleUserMenu) return; // not interested

        // For accessibility
        if (this.buttonRef.current) this.buttonRef.current.click();
    };

    private onOpenMenuClick = (ev: InputEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.setState({menuDisplayed: true});
    };

    private onCloseMenu = () => {
        this.setState({menuDisplayed: false});
    };

    private onSwitchThemeClick = () => {
        console.log("TODO: Switch theme");
    };

    private onSettingsOpen = (ev: React.MouseEvent, tabRef: string) => {
        ev.preventDefault();
        ev.stopPropagation();

        console.log("TODO: Open settings", tabRef);
    };

    private onShowArchived = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        console.log("TODO: Show archived rooms");
    };

    private onProvideFeedback = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        console.log("TODO: Show feedback");
    };

    private onSignOutClick = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        console.log("TODO: Sign out");
    };

    public render() {
        let contextMenu;
        if (this.state.menuDisplayed) {
            const elementRect = this.buttonRef.current.getBoundingClientRect();
            contextMenu = (
                <ContextMenu
                    chevronFace="none"
                    left={elementRect.left}
                    top={elementRect.top + elementRect.height}
                    onFinished={this.onCloseMenu}
                >
                    <div className="mx_UserMenuButton_contextMenu">
                        <div className="mx_UserMenuButton_contextMenu_header">
                            <div className="mx_UserMenuButton_contextMenu_name">
                                <span className="mx_UserMenuButton_contextMenu_displayName">
                                    {this.displayName}
                                </span>
                                <span className="mx_UserMenuButton_contextMenu_userId">
                                    {MatrixClientPeg.get().getUserId()}
                                </span>
                            </div>
                            <div
                                className="mx_UserMenuButton_contextMenu_themeButton"
                                onClick={this.onSwitchThemeClick}
                                title={_t("Switch to dark mode")}
                            >
                                <img
                                    src={require("../../../res/img/feather-customised/sun.svg")}
                                    alt={_t("Switch theme")}
                                    width={16}
                                />
                            </div>
                        </div>
                        <div className="mx_UserMenuButton_contextMenu_header">
                            TODO: Upgrade prompt
                        </div>
                        <div className="mx_UserMenuButton_contextMenu_optionList">
                            <ul>
                                <li>
                                    <a href={"#"} onClick={(e) => this.onSettingsOpen(e, 'notifications')}>
                                        <img src={require("../../../res/img/feather-customised/notifications.svg")} width={16} />
                                        <span>{_t("Notification settings")}</span>
                                    </a>
                                </li>
                                <li>
                                    <a href={"#"} onClick={(e) => this.onSettingsOpen(e, 'security')}>
                                        <img src={require("../../../res/img/feather-customised/lock.svg")} width={16} />
                                        <span>{_t("Security & privacy")}</span>
                                    </a>
                                </li>
                                <li>
                                    <a href={"#"} onClick={(e) => this.onSettingsOpen(e, 'all')}>
                                        <img src={require("../../../res/img/feather-customised/settings.svg")} width={16} />
                                        <span>{_t("All settings")}</span>
                                    </a>
                                </li>
                                <li>
                                    <a href={"#"} onClick={this.onShowArchived}>
                                        <img src={require("../../../res/img/feather-customised/archive.svg")} width={16} />
                                        <span>{_t("Archived rooms")}</span>
                                    </a>
                                </li>
                                <li>
                                    <a href={"#"} onClick={this.onShowArchived}>
                                        <img src={require("../../../res/img/feather-customised/message-circle.svg")} width={16} />
                                        <span>{_t("Feedback")}</span>
                                    </a>
                                </li>
                            </ul>
                        </div>
                        <div className="mx_UserMenuButton_contextMenu_optionList">
                            <ul>
                                <li>
                                    <a href={"#"} onClick={(e) => this.onSettingsOpen(e, 'notifications')}>
                                        <img src={require("../../../res/img/feather-customised/sign-out.svg")} width={16} />
                                        <span>{_t("Sign out")}</span>
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                </ContextMenu>
            );
        }

        return (
            <React.Fragment>
                <ContextMenuButton
                    className="mx_UserMenuButton"
                    onClick={this.onOpenMenuClick}
                    inputRef={this.buttonRef}
                    label={_t("Account settings")}
                    isExpanded={this.state.menuDisplayed}
                >
                    <img src={require("../../../res/img/feather-customised/more-horizontal.svg")} alt="..." width={14} />
                </ContextMenuButton>
                {contextMenu}
            </React.Fragment>
        )
    }
}
