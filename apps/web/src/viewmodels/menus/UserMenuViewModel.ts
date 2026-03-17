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
            {
                label: _t("action|sign_in"),
                onSelect: () => {
                    this.setOpen(false);
                    this.dispatcher.dispatch({ action: "start_login" });
                },
                guest: true,
            },
            {
                label: _t("action|create_account"),
                onSelect: () => {
                    this.setOpen(false);
                    this.dispatcher.dispatch({ action: "start_registration" });
                },
                guest: true,
            },
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
                guest: false,
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
                guest: false,
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
                guest: false,
            },
        ]
            .filter((item) => item !== null)
            .filter((item) => {
                if (this.client.isGuest()) {
                    // Show all except hidden items to guests
                    return item.guest !== false;
                }
                // Show all except guest-only items to everyone else.
                return item.guest !== true;
            });
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
            manageAccountHref: accountManagementEndpoint,
            expanded: !isPanelCollapsed,
            actions: [],
        });
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
}
