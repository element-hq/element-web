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
import {USER_NOTIFICATIONS_TAB, USER_SECURITY_TAB} from "../views/dialogs/UserSettingsDialog";
import { OpenToTabPayload } from "../../dispatcher/payloads/OpenToTabPayload";
import RedesignFeedbackDialog from "../views/dialogs/RedesignFeedbackDialog";
import Modal from "../../Modal";
import LogoutDialog from "../views/dialogs/LogoutDialog";
import SettingsStore, {SettingLevel} from "../../settings/SettingsStore";
import {getCustomTheme} from "../../theme";
import {getHostingLink} from "../../utils/HostingLink";
import AccessibleButton, {ButtonEvent} from "../views/elements/AccessibleButton";
import SdkConfig from "../../SdkConfig";
import {getHomePageUrl} from "../../utils/pages";

interface IProps {
}

interface IState {
    user: User;
    menuDisplayed: boolean;
    isDarkTheme: boolean;
}

export default class UserMenuButton extends React.Component<IProps, IState> {
    private dispatcherRef: string;
    private themeWatcherRef: string;
    private buttonRef: React.RefObject<HTMLButtonElement> = createRef();

    constructor(props: IProps) {
        super(props);

        this.state = {
            menuDisplayed: false,
            user: MatrixClientPeg.get().getUser(MatrixClientPeg.get().getUserId()),
            isDarkTheme: this.isUserOnDarkTheme(),
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

    private get hasHomePage(): boolean {
        return !!getHomePageUrl(SdkConfig.get());
    }

    public componentDidMount() {
        this.dispatcherRef = defaultDispatcher.register(this.onAction);
        this.themeWatcherRef = SettingsStore.watchSetting("theme", null, this.onThemeChanged);
    }

    public componentWillUnmount() {
        if (this.themeWatcherRef) SettingsStore.unwatchSetting(this.themeWatcherRef);
        if (this.dispatcherRef) defaultDispatcher.unregister(this.dispatcherRef);
    }

    private isUserOnDarkTheme(): boolean {
        const theme = SettingsStore.getValue("theme");
        if (theme.startsWith("custom-")) {
            return getCustomTheme(theme.substring("custom-".length)).is_dark;
        }
        return theme === "dark";
    }

    private onThemeChanged = () => {
        this.setState({isDarkTheme: this.isUserOnDarkTheme()});
    };

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
        // Disable system theme matching if the user hits this button
        SettingsStore.setValue("use_system_theme", null, SettingLevel.DEVICE, false);

        const newTheme = this.state.isDarkTheme ? "light" : "dark";
        SettingsStore.setValue("theme", null, SettingLevel.DEVICE, newTheme); // set at same level as Appearance tab
    };

    private onSettingsOpen = (ev: ButtonEvent, tabId: string) => {
        ev.preventDefault();
        ev.stopPropagation();

        const payload: OpenToTabPayload = {action: Action.ViewUserSettings, initialTabId: tabId};
        defaultDispatcher.dispatch(payload);
        this.setState({menuDisplayed: false}); // also close the menu
    };

    private onShowArchived = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        // TODO: Archived room view (deferred)
        console.log("TODO: Show archived rooms");
    };

    private onProvideFeedback = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        Modal.createTrackedDialog('Report bugs & give feedback', '', RedesignFeedbackDialog);
        this.setState({menuDisplayed: false}); // also close the menu
    };

    private onSignOutClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        Modal.createTrackedDialog('Logout from LeftPanel', '', LogoutDialog);
        this.setState({menuDisplayed: false}); // also close the menu
    };

    private onHomeClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        defaultDispatcher.dispatch({action: 'view_home_page'});
    };

    public render() {
        let contextMenu;
        if (this.state.menuDisplayed) {
            let hostingLink;
            const signupLink = getHostingLink("user-context-menu");
            if (signupLink) {
                hostingLink = (
                    <div className="mx_UserMenuButton_contextMenu_header">
                        {_t(
                            "<a>Upgrade</a> to your own domain", {},
                            {
                                a: sub => (
                                    <a
                                        href={signupLink}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        tabIndex={-1}
                                    >{sub}</a>
                                ),
                            },
                        )}
                    </div>
                );
            }

            let homeButton = null;
            if (this.hasHomePage) {
                homeButton = (
                    <li>
                        <AccessibleButton onClick={this.onHomeClick}>
                            <img src={require("../../../res/img/feather-customised/home.svg")} width={16} />
                            <span>{_t("Home")}</span>
                        </AccessibleButton>
                    </li>
                );
            }

            const elementRect = this.buttonRef.current.getBoundingClientRect();
            contextMenu = (
                <ContextMenu
                    chevronFace="none"
                    left={elementRect.left}
                    top={elementRect.top + elementRect.height}
                    onFinished={this.onCloseMenu}
                >
                    <div className="mx_IconizedContextMenu mx_UserMenuButton_contextMenu">
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
                                title={this.state.isDarkTheme ? _t("Switch to light mode") : _t("Switch to dark mode")}
                            >
                                <img
                                    src={require("../../../res/img/feather-customised/sun.svg")}
                                    alt={_t("Switch theme")}
                                    width={16}
                                />
                            </div>
                        </div>
                        {hostingLink}
                        <div className="mx_IconizedContextMenu_optionList mx_IconizedContextMenu_optionList_notFirst">
                            <ul>
                                {homeButton}
                                <li>
                                    <AccessibleButton onClick={(e) => this.onSettingsOpen(e, USER_NOTIFICATIONS_TAB)}>
                                        <img src={require("../../../res/img/feather-customised/notifications.svg")} width={16} />
                                        <span>{_t("Notification settings")}</span>
                                    </AccessibleButton>
                                </li>
                                <li>
                                    <AccessibleButton onClick={(e) => this.onSettingsOpen(e, USER_SECURITY_TAB)}>
                                        <img src={require("../../../res/img/feather-customised/lock.svg")} width={16} />
                                        <span>{_t("Security & privacy")}</span>
                                    </AccessibleButton>
                                </li>
                                <li>
                                    <AccessibleButton onClick={(e) => this.onSettingsOpen(e, null)}>
                                        <img src={require("../../../res/img/feather-customised/settings.svg")} width={16} />
                                        <span>{_t("All settings")}</span>
                                    </AccessibleButton>
                                </li>
                                <li>
                                    <AccessibleButton onClick={this.onShowArchived}>
                                        <img src={require("../../../res/img/feather-customised/archive.svg")} width={16} />
                                        <span>{_t("Archived rooms")}</span>
                                    </AccessibleButton>
                                </li>
                                <li>
                                    <AccessibleButton onClick={this.onProvideFeedback}>
                                        <img src={require("../../../res/img/feather-customised/message-circle.svg")} width={16} />
                                        <span>{_t("Feedback")}</span>
                                    </AccessibleButton>
                                </li>
                            </ul>
                        </div>
                        <div className="mx_IconizedContextMenu_optionList">
                            <ul>
                                <li>
                                    <AccessibleButton onClick={this.onSignOutClick}>
                                        <img src={require("../../../res/img/feather-customised/sign-out.svg")} width={16} />
                                        <span>{_t("Sign out")}</span>
                                    </AccessibleButton>
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
        );
    }
}
