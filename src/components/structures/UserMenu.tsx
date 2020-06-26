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
import { OwnProfileStore } from "../../stores/OwnProfileStore";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import BaseAvatar from '../views/avatars/BaseAvatar';
import classNames from "classnames";

interface IProps {
    isMinimized: boolean;
}

interface IState {
    menuDisplayed: boolean;
    isDarkTheme: boolean;
}

export default class UserMenu extends React.Component<IProps, IState> {
    private dispatcherRef: string;
    private themeWatcherRef: string;
    private buttonRef: React.RefObject<HTMLButtonElement> = createRef();

    constructor(props: IProps) {
        super(props);

        this.state = {
            menuDisplayed: false,
            isDarkTheme: this.isUserOnDarkTheme(),
        };

        OwnProfileStore.instance.on(UPDATE_EVENT, this.onProfileUpdate);
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
        OwnProfileStore.instance.off(UPDATE_EVENT, this.onProfileUpdate);
    }

    private isUserOnDarkTheme(): boolean {
        const theme = SettingsStore.getValue("theme");
        if (theme.startsWith("custom-")) {
            return getCustomTheme(theme.substring("custom-".length)).is_dark;
        }
        return theme === "dark";
    }

    private onProfileUpdate = async () => {
        // the store triggered an update, so force a layout update. We don't
        // have any state to store here for that to magically happen.
        this.forceUpdate();
    };

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

    private onCloseMenu = (ev: InputEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
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

    private renderContextMenu = (): React.ReactNode => {
        if (!this.state.menuDisplayed) return null;

        let hostingLink;
        const signupLink = getHostingLink("user-context-menu");
        if (signupLink) {
            hostingLink = (
                <div className="mx_UserMenu_contextMenu_header">
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
                        <span className="mx_IconizedContextMenu_icon mx_UserMenu_iconHome" />
                        <span>{_t("Home")}</span>
                    </AccessibleButton>
                </li>
            );
        }

        const elementRect = this.buttonRef.current.getBoundingClientRect();
        return (
            <ContextMenu
                chevronFace="none"
                left={elementRect.width + elementRect.left}
                top={elementRect.top + elementRect.height}
                onFinished={this.onCloseMenu}
            >
                <div className="mx_IconizedContextMenu mx_UserMenu_contextMenu">
                    <div className="mx_UserMenu_contextMenu_header">
                        <div className="mx_UserMenu_contextMenu_name">
                            <span className="mx_UserMenu_contextMenu_displayName">
                                {OwnProfileStore.instance.displayName}
                            </span>
                            <span className="mx_UserMenu_contextMenu_userId">
                                {MatrixClientPeg.get().getUserId()}
                            </span>
                        </div>
                        <div
                            className="mx_UserMenu_contextMenu_themeButton"
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
                                    <span className="mx_IconizedContextMenu_icon mx_UserMenu_iconBell" />
                                    <span>{_t("Notification settings")}</span>
                                </AccessibleButton>
                            </li>
                            <li>
                                <AccessibleButton onClick={(e) => this.onSettingsOpen(e, USER_SECURITY_TAB)}>
                                    <span className="mx_IconizedContextMenu_icon mx_UserMenu_iconLock" />
                                    <span>{_t("Security & privacy")}</span>
                                </AccessibleButton>
                            </li>
                            <li>
                                <AccessibleButton onClick={(e) => this.onSettingsOpen(e, null)}>
                                    <span className="mx_IconizedContextMenu_icon mx_UserMenu_iconSettings" />
                                    <span>{_t("All settings")}</span>
                                </AccessibleButton>
                            </li>
                            <li>
                                <AccessibleButton onClick={this.onShowArchived}>
                                    <span className="mx_IconizedContextMenu_icon mx_UserMenu_iconArchive" />
                                    <span>{_t("Archived rooms")}</span>
                                </AccessibleButton>
                            </li>
                            <li>
                                <AccessibleButton onClick={this.onProvideFeedback}>
                                    <span className="mx_IconizedContextMenu_icon mx_UserMenu_iconMessage" />
                                    <span>{_t("Feedback")}</span>
                                </AccessibleButton>
                            </li>
                        </ul>
                    </div>
                    <div className="mx_IconizedContextMenu_optionList">
                        <ul>
                            <li className="mx_UserMenu_contextMenu_redRow">
                                <AccessibleButton onClick={this.onSignOutClick}>
                                    <span className="mx_IconizedContextMenu_icon mx_UserMenu_iconSignOut" />
                                    <span>{_t("Sign out")}</span>
                                </AccessibleButton>
                            </li>
                        </ul>
                    </div>
                </div>
            </ContextMenu>
        );
    };

    public render() {
        const avatarSize = 32; // should match border-radius of the avatar

        let name = <span className="mx_UserMenu_userName">{OwnProfileStore.instance.displayName}</span>;
        let buttons = (
            <span className="mx_UserMenu_headerButtons">
                {/* masked image in CSS */}
            </span>
        );
        if (this.props.isMinimized) {
            name = null;
            buttons = null;
        }

        const classes = classNames({
            'mx_UserMenu': true,
            'mx_UserMenu_minimized': this.props.isMinimized,
        });

        return (
            <React.Fragment>
                <ContextMenuButton
                    className={classes}
                    onClick={this.onOpenMenuClick}
                    inputRef={this.buttonRef}
                    label={_t("Account settings")}
                    isExpanded={this.state.menuDisplayed}
                >
                    <div className="mx_UserMenu_row">
                        <span className="mx_UserMenu_userAvatarContainer">
                            <BaseAvatar
                                idName={MatrixClientPeg.get().getUserId()}
                                name={OwnProfileStore.instance.displayName || MatrixClientPeg.get().getUserId()}
                                url={OwnProfileStore.instance.getHttpAvatarUrl(avatarSize)}
                                width={avatarSize}
                                height={avatarSize}
                                resizeMethod="crop"
                                className="mx_UserMenu_userAvatar"
                            />
                        </span>
                        {name}
                        {buttons}
                    </div>
                    {this.renderContextMenu()}
                </ContextMenuButton>
            </React.Fragment>
        );
    }
}
