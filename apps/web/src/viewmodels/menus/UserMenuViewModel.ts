/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { _t, BaseViewModel, type UserMenuSnapshot, type UserMenuViewActions } from "@element-hq/web-shared-components";
import HomeSolidIcon from "@vector-im/compound-design-tokens/assets/web/icons/home-solid";
import DevicesIcon from "@vector-im/compound-design-tokens/assets/web/icons/devices";
import ChatProblemIcon from "@vector-im/compound-design-tokens/assets/web/icons/chat-problem";
import SettingsIcon from "@vector-im/compound-design-tokens/assets/web/icons/settings";
import LockIcon from "@vector-im/compound-design-tokens/assets/web/icons/lock";

import { OwnProfileStore } from "../../stores/OwnProfileStore";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import type { MatrixDispatcher } from "../../dispatcher/dispatcher";
import Modal from "../../Modal";
import { Action } from "../../dispatcher/actions";
import { UserTab } from "../../components/views/dialogs/UserTab";
import FeedbackDialog from "../../components/views/dialogs/FeedbackDialog";
import { shouldShowFeedback } from "../../utils/Feedback";
import { getHomePageUrl } from "../../utils/pages";
import SdkConfig from "../../SdkConfig";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";

// Matches maximum size of an avatar in the UserMenu
const AVATAR_PX = 88;

export class UserMenuViewModel extends BaseViewModel<UserMenuSnapshot, undefined> implements UserMenuViewActions {
    private get hasHomePage(): boolean {
        return !!getHomePageUrl(SdkConfig.get(), this.client);
    }

    public getActions(): UserMenuSnapshot["actions"] {
        return [
            this.hasHomePage
                ? {
                      label: _t("common|home"),
                      icon: HomeSolidIcon,
                      onSelect: () => {
                          this.setOpen(false);
                          this.dispatcher.dispatch({ action: Action.ViewHomePage });
                      },
                  }
                : null,
            {
                label: _t("user_menu|link_new_device"),
                icon: DevicesIcon,
                onSelect: () => {
                    this.setOpen(false);
                    this.dispatcher.dispatch({
                        action: Action.ViewUserSettings,
                        initialTabId: UserTab.SessionManager,
                        props: { showMsc4108QrCode: true },
                    });
                },
                onlyAuthenticated: true,
            },
            {
                label: _t("room_settings|security|title"),
                icon: LockIcon,
                onSelect: () => {
                    this.setOpen(false);
                    this.dispatcher.dispatch({
                        action: Action.ViewUserSettings,
                        initialTabId: UserTab.Security,
                    });
                },
                onlyAuthenticated: true,
            },
            shouldShowFeedback()
                ? {
                      label: _t("common|feedback"),
                      icon: ChatProblemIcon,
                      onSelect: () => {
                          this.setOpen(false);
                          Modal.createDialog(FeedbackDialog);
                      },
                  }
                : null,
            {
                label: _t("user_menu|settings"),
                icon: SettingsIcon,
                onSelect: () => {
                    this.setOpen(false);
                    this.dispatcher.dispatch({
                        action: Action.ViewUserSettings,
                    });
                },
            },
        ]
            .filter((item) => item !== null)
            .filter((item) => !this.client.isGuest() || !item.onlyAuthenticated)
            .map(({ onlyAuthenticated, ...item }) => item);
    }

    public constructor(
        private readonly dispatcher: MatrixDispatcher,
        private readonly client: MatrixClient,
        isPanelCollapsed: boolean,
        accountManagementEndpoint?: string,
    ) {
        const userId = client.getSafeUserId();
        const displayName = OwnProfileStore.instance.displayName || userId;
        const avatarUrl = OwnProfileStore.instance.getHttpAvatarUrl(AVATAR_PX) ?? undefined;

        super(undefined, {
            open: false,
            userId,
            displayName,
            avatarUrl,
            expanded: !isPanelCollapsed,
            actions: [],
        });
        if (client.isGuest()) {
            this.snapshot.merge({
                showAvatar: false,
                createAccount: this.onCreateAccount,
                signIn: this.onSignIn,
            });
        } else if (accountManagementEndpoint) {
            this.snapshot.merge({
                manageAccountHref: accountManagementEndpoint,
            });
        }
        OwnProfileStore.instance.on(UPDATE_EVENT, this.recalculateProfile);
    }

    public dispose(): void {
        OwnProfileStore.instance.off(UPDATE_EVENT, this.recalculateProfile);
        super.dispose();
    }

    public recalculateProfile = (): void => {
        const displayName = OwnProfileStore.instance.displayName || this.snapshot.current.userId;
        const avatarUrl = OwnProfileStore.instance.getHttpAvatarUrl(AVATAR_PX) ?? undefined;
        this.snapshot.merge({ displayName, avatarUrl });
    };
    public setOpen = (isOpen: boolean): void => {
        this.snapshot.merge({ open: isOpen, actions: isOpen ? this.getActions() : [] });
    };

    public setExpanded = (expanded: boolean): void => {
        this.snapshot.merge({ expanded });
    };

    private onCreateAccount = (): void => {
        this.setOpen(false);
        this.dispatcher.dispatch({ action: "start_registration" });
    };

    private onSignIn = (): void => {
        this.setOpen(false);
        this.dispatcher.dispatch({ action: "start_login" });
    };
}
