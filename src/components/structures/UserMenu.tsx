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

import React, { createRef } from "react";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { ActionPayload } from "../../dispatcher/payloads";
import { Action } from "../../dispatcher/actions";
import { _t } from "../../languageHandler";
import { ContextMenuButton } from "./ContextMenu";
import {USER_NOTIFICATIONS_TAB, USER_SECURITY_TAB} from "../views/dialogs/UserSettingsDialog";
import { OpenToTabPayload } from "../../dispatcher/payloads/OpenToTabPayload";
import FeedbackDialog from "../views/dialogs/FeedbackDialog";
import Modal from "../../Modal";
import LogoutDialog from "../views/dialogs/LogoutDialog";
import SettingsStore from "../../settings/SettingsStore";
import {getCustomTheme} from "../../theme";
import {getHostingLink} from "../../utils/HostingLink";
import AccessibleButton, {ButtonEvent} from "../views/elements/AccessibleButton";
import SdkConfig from "../../SdkConfig";
import {getHomePageUrl} from "../../utils/pages";
import { OwnProfileStore } from "../../stores/OwnProfileStore";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import BaseAvatar from '../views/avatars/BaseAvatar';
import classNames from "classnames";
import AccessibleTooltipButton from "../views/elements/AccessibleTooltipButton";
import { SettingLevel } from "../../settings/SettingLevel";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../views/context_menus/IconizedContextMenu";
import { CommunityPrototypeStore } from "../../stores/CommunityPrototypeStore";
import * as fbEmitter from "fbemitter";
import GroupFilterOrderStore from "../../stores/GroupFilterOrderStore";
import { showCommunityInviteDialog } from "../../RoomInvite";
import dis from "../../dispatcher/dispatcher";
import { RightPanelPhases } from "../../stores/RightPanelStorePhases";
import ErrorDialog from "../views/dialogs/ErrorDialog";
import EditCommunityPrototypeDialog from "../views/dialogs/EditCommunityPrototypeDialog";
import {UIFeature} from "../../settings/UIFeature";

interface IProps {
    isMinimized: boolean;
}

type PartialDOMRect = Pick<DOMRect, "width" | "left" | "top" | "height">;

interface IState {
    contextMenuPosition: PartialDOMRect;
    isDarkTheme: boolean;
}

export default class UserMenu extends React.Component<IProps, IState> {
    private dispatcherRef: string;
    private themeWatcherRef: string;
    private buttonRef: React.RefObject<HTMLButtonElement> = createRef();
    private tagStoreRef: fbEmitter.EventSubscription;

    constructor(props: IProps) {
        super(props);

        this.state = {
            contextMenuPosition: null,
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
        this.tagStoreRef = GroupFilterOrderStore.addListener(this.onTagStoreUpdate);
    }

    public componentWillUnmount() {
        if (this.themeWatcherRef) SettingsStore.unwatchSetting(this.themeWatcherRef);
        if (this.dispatcherRef) defaultDispatcher.unregister(this.dispatcherRef);
        OwnProfileStore.instance.off(UPDATE_EVENT, this.onProfileUpdate);
        this.tagStoreRef.remove();
    }

    private onTagStoreUpdate = () => {
        this.forceUpdate(); // we don't have anything useful in state to update
    };

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

        if (this.state.contextMenuPosition) {
            this.setState({contextMenuPosition: null});
        } else {
            if (this.buttonRef.current) this.buttonRef.current.click();
        }
    };

    private onOpenMenuClick = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        const target = ev.target as HTMLButtonElement;
        this.setState({contextMenuPosition: target.getBoundingClientRect()});
    };

    private onContextMenu = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.setState({
            contextMenuPosition: {
                left: ev.clientX,
                top: ev.clientY,
                width: 20,
                height: 0,
            },
        });
    };

    private onCloseMenu = () => {
        this.setState({contextMenuPosition: null});
    };

    private onSwitchThemeClick = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

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
        this.setState({contextMenuPosition: null}); // also close the menu
    };

    private onShowArchived = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        // TODO: Archived room view: https://github.com/vector-im/element-web/issues/14038
        // Note: You'll need to uncomment the button too.
        console.log("TODO: Show archived rooms");
    };

    private onProvideFeedback = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        Modal.createTrackedDialog('Feedback Dialog', '', FeedbackDialog);
        this.setState({contextMenuPosition: null}); // also close the menu
    };

    private onSignOutClick = async (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        const cli = MatrixClientPeg.get();
        if (!cli || !cli.isCryptoEnabled() || !(await cli.exportRoomKeys())?.length) {
            // log out without user prompt if they have no local megolm sessions
            dis.dispatch({action: 'logout'});
        } else {
            Modal.createTrackedDialog('Logout from LeftPanel', '', LogoutDialog);
        }

        this.setState({contextMenuPosition: null}); // also close the menu
    };

    private onSignInClick = () => {
        dis.dispatch({ action: 'start_login' });
        this.setState({contextMenuPosition: null}); // also close the menu
    };

    private onRegisterClick = () => {
        dis.dispatch({ action: 'start_registration' });
        this.setState({contextMenuPosition: null}); // also close the menu
    };

    private onHomeClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        defaultDispatcher.dispatch({action: 'view_home_page'});
        this.setState({contextMenuPosition: null}); // also close the menu
    };

    private onCommunitySettingsClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        Modal.createTrackedDialog('Edit Community', '', EditCommunityPrototypeDialog, {
            communityId: CommunityPrototypeStore.instance.getSelectedCommunityId(),
        });
        this.setState({contextMenuPosition: null}); // also close the menu
    };

    private onCommunityMembersClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        // We'd ideally just pop open a right panel with the member list, but the current
        // way the right panel is structured makes this exceedingly difficult. Instead, we'll
        // switch to the general room and open the member list there as it should be in sync
        // anyways.
        const chat = CommunityPrototypeStore.instance.getSelectedCommunityGeneralChat();
        if (chat) {
            dis.dispatch({
                action: 'view_room',
                room_id: chat.roomId,
            }, true);
            dis.dispatch({action: Action.SetRightPanelPhase, phase: RightPanelPhases.RoomMemberList});
        } else {
            // "This should never happen" clauses go here for the prototype.
            Modal.createTrackedDialog('Failed to find general chat', '', ErrorDialog, {
                title: _t('Failed to find the general chat for this community'),
                description: _t("Failed to find the general chat for this community"),
            });
        }
        this.setState({contextMenuPosition: null}); // also close the menu
    };

    private onCommunityInviteClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        showCommunityInviteDialog(CommunityPrototypeStore.instance.getSelectedCommunityId());
        this.setState({contextMenuPosition: null}); // also close the menu
    };

    private renderContextMenu = (): React.ReactNode => {
        if (!this.state.contextMenuPosition) return null;

        const prototypeCommunityName = CommunityPrototypeStore.instance.getSelectedCommunityName();

        let topSection;
        const signupLink = getHostingLink("user-context-menu");
        if (MatrixClientPeg.get().isGuest()) {
            topSection = (
                <div className="mx_UserMenu_contextMenu_header mx_UserMenu_contextMenu_guestPrompts">
                    {_t("Got an account? <a>Sign in</a>", {}, {
                        a: sub => (
                            <AccessibleButton kind="link" onClick={this.onSignInClick}>
                                {sub}
                            </AccessibleButton>
                        ),
                    })}
                    {_t("New here? <a>Create an account</a>", {}, {
                        a: sub => (
                            <AccessibleButton kind="link" onClick={this.onRegisterClick}>
                                {sub}
                            </AccessibleButton>
                        ),
                    })}
                </div>
            )
        } else if (signupLink) {
            topSection = (
                <div className="mx_UserMenu_contextMenu_header mx_UserMenu_contextMenu_hostingLink">
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
                <IconizedContextMenuOption
                    iconClassName="mx_UserMenu_iconHome"
                    label={_t("Home")}
                    onClick={this.onHomeClick}
                />
            );
        }

        let feedbackButton;
        if (SettingsStore.getValue(UIFeature.Feedback)) {
            feedbackButton = <IconizedContextMenuOption
                iconClassName="mx_UserMenu_iconMessage"
                label={_t("Feedback")}
                onClick={this.onProvideFeedback}
            />;
        }

        let primaryHeader = (
            <div className="mx_UserMenu_contextMenu_name">
                <span className="mx_UserMenu_contextMenu_displayName">
                    {OwnProfileStore.instance.displayName}
                </span>
                <span className="mx_UserMenu_contextMenu_userId">
                    {MatrixClientPeg.get().getUserId()}
                </span>
            </div>
        );
        let primaryOptionList = (
            <React.Fragment>
                <IconizedContextMenuOptionList>
                    {homeButton}
                    <IconizedContextMenuOption
                        iconClassName="mx_UserMenu_iconBell"
                        label={_t("Notification settings")}
                        onClick={(e) => this.onSettingsOpen(e, USER_NOTIFICATIONS_TAB)}
                    />
                    <IconizedContextMenuOption
                        iconClassName="mx_UserMenu_iconLock"
                        label={_t("Security & privacy")}
                        onClick={(e) => this.onSettingsOpen(e, USER_SECURITY_TAB)}
                    />
                    <IconizedContextMenuOption
                        iconClassName="mx_UserMenu_iconSettings"
                        label={_t("All settings")}
                        onClick={(e) => this.onSettingsOpen(e, null)}
                    />
                    {/* <IconizedContextMenuOption
                        iconClassName="mx_UserMenu_iconArchive"
                        label={_t("Archived rooms")}
                        onClick={this.onShowArchived}
                    /> */}
                    { feedbackButton }
                </IconizedContextMenuOptionList>
                <IconizedContextMenuOptionList red>
                    <IconizedContextMenuOption
                        iconClassName="mx_UserMenu_iconSignOut"
                        label={_t("Sign out")}
                        onClick={this.onSignOutClick}
                    />
                </IconizedContextMenuOptionList>
            </React.Fragment>
        );
        let secondarySection = null;

        if (prototypeCommunityName) {
            const communityId = CommunityPrototypeStore.instance.getSelectedCommunityId();
            primaryHeader = (
                <div className="mx_UserMenu_contextMenu_name">
                    <span className="mx_UserMenu_contextMenu_displayName">
                        {prototypeCommunityName}
                    </span>
                </div>
            );
            let settingsOption;
            let inviteOption;
            if (CommunityPrototypeStore.instance.canInviteTo(communityId)) {
                inviteOption = (
                    <IconizedContextMenuOption
                        iconClassName="mx_UserMenu_iconInvite"
                        label={_t("Invite")}
                        onClick={this.onCommunityInviteClick}
                    />
                );
            }
            if (CommunityPrototypeStore.instance.isAdminOf(communityId)) {
                settingsOption = (
                    <IconizedContextMenuOption
                        iconClassName="mx_UserMenu_iconSettings"
                        label={_t("Settings")}
                        aria-label={_t("Community settings")}
                        onClick={this.onCommunitySettingsClick}
                    />
                );
            }
            primaryOptionList = (
                <IconizedContextMenuOptionList>
                    {settingsOption}
                    <IconizedContextMenuOption
                        iconClassName="mx_UserMenu_iconMembers"
                        label={_t("Members")}
                        onClick={this.onCommunityMembersClick}
                    />
                    {inviteOption}
                </IconizedContextMenuOptionList>
            );
            secondarySection = (
                <React.Fragment>
                    <hr />
                    <div className="mx_UserMenu_contextMenu_header">
                        <div className="mx_UserMenu_contextMenu_name">
                            <span className="mx_UserMenu_contextMenu_displayName">
                                {OwnProfileStore.instance.displayName}
                            </span>
                            <span className="mx_UserMenu_contextMenu_userId">
                                {MatrixClientPeg.get().getUserId()}
                            </span>
                        </div>
                    </div>
                    <IconizedContextMenuOptionList>
                        <IconizedContextMenuOption
                            iconClassName="mx_UserMenu_iconSettings"
                            label={_t("Settings")}
                            aria-label={_t("User settings")}
                            onClick={(e) => this.onSettingsOpen(e, null)}
                        />
                        { feedbackButton }
                    </IconizedContextMenuOptionList>
                    <IconizedContextMenuOptionList red>
                        <IconizedContextMenuOption
                            iconClassName="mx_UserMenu_iconSignOut"
                            label={_t("Sign out")}
                            onClick={this.onSignOutClick}
                        />
                    </IconizedContextMenuOptionList>
                </React.Fragment>
            )
        } else if (MatrixClientPeg.get().isGuest()) {
            primaryOptionList = (
                <React.Fragment>
                    <IconizedContextMenuOptionList>
                        { homeButton }
                        <IconizedContextMenuOption
                            iconClassName="mx_UserMenu_iconSettings"
                            label={_t("Settings")}
                            onClick={(e) => this.onSettingsOpen(e, null)}
                        />
                        { feedbackButton }
                    </IconizedContextMenuOptionList>
                </React.Fragment>
            );
        }

        const classes = classNames({
            "mx_UserMenu_contextMenu": true,
            "mx_UserMenu_contextMenu_prototype": !!prototypeCommunityName,
        });

        return <IconizedContextMenu
            // numerical adjustments to overlap the context menu by just over the width of the
            // menu icon and make it look connected
            left={this.state.contextMenuPosition.width + this.state.contextMenuPosition.left - 10}
            top={this.state.contextMenuPosition.top + this.state.contextMenuPosition.height + 8}
            onFinished={this.onCloseMenu}
            className={classes}
        >
            <div className="mx_UserMenu_contextMenu_header">
                {primaryHeader}
                <AccessibleTooltipButton
                    className="mx_UserMenu_contextMenu_themeButton"
                    onClick={this.onSwitchThemeClick}
                    title={this.state.isDarkTheme ? _t("Switch to light mode") : _t("Switch to dark mode")}
                >
                    <img
                        src={require("../../../res/img/element-icons/roomlist/dark-light-mode.svg")}
                        alt={_t("Switch theme")}
                        width={16}
                    />
                </AccessibleTooltipButton>
            </div>
            {topSection}
            {primaryOptionList}
            {secondarySection}
        </IconizedContextMenu>;
    };

    public render() {
        const avatarSize = 32; // should match border-radius of the avatar

        const userId = MatrixClientPeg.get().getUserId();
        const displayName = OwnProfileStore.instance.displayName || userId;
        const avatarUrl = OwnProfileStore.instance.getHttpAvatarUrl(avatarSize);

        const prototypeCommunityName = CommunityPrototypeStore.instance.getSelectedCommunityName();

        let isPrototype = false;
        let menuName = _t("User menu");
        let name = <span className="mx_UserMenu_userName">{displayName}</span>;
        let buttons = (
            <span className="mx_UserMenu_headerButtons">
                {/* masked image in CSS */}
            </span>
        );
        if (prototypeCommunityName) {
            name = (
                <div className="mx_UserMenu_doubleName">
                    <span className="mx_UserMenu_userName">{prototypeCommunityName}</span>
                    <span className="mx_UserMenu_subUserName">{displayName}</span>
                </div>
            );
            menuName = _t("Community and user menu");
            isPrototype = true;
        } else if (SettingsStore.getValue("feature_communities_v2_prototypes")) {
            name = (
                <div className="mx_UserMenu_doubleName">
                    <span className="mx_UserMenu_userName">{_t("Home")}</span>
                    <span className="mx_UserMenu_subUserName">{displayName}</span>
                </div>
            );
            isPrototype = true;
        }
        if (this.props.isMinimized) {
            name = null;
            buttons = null;
        }

        const classes = classNames({
            'mx_UserMenu': true,
            'mx_UserMenu_minimized': this.props.isMinimized,
            'mx_UserMenu_prototype': isPrototype,
        });

        return (
            <React.Fragment>
                <ContextMenuButton
                    className={classes}
                    onClick={this.onOpenMenuClick}
                    inputRef={this.buttonRef}
                    label={menuName}
                    isExpanded={!!this.state.contextMenuPosition}
                    onContextMenu={this.onContextMenu}
                >
                    <div className="mx_UserMenu_row">
                        <span className="mx_UserMenu_userAvatarContainer">
                            <BaseAvatar
                                idName={userId}
                                name={displayName}
                                url={avatarUrl}
                                width={avatarSize}
                                height={avatarSize}
                                resizeMethod="crop"
                                className="mx_UserMenu_userAvatar"
                            />
                        </span>
                        {name}
                        {buttons}
                    </div>
                </ContextMenuButton>
                {this.renderContextMenu()}
            </React.Fragment>
        );
    }
}
