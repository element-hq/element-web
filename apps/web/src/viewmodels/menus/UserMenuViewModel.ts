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

import { SdkContextClass } from "../../contexts/SDKContext";
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
        if (this.client.isGuest()) {
            return [
                {
                    label: _t("action|sign_in"),
                    onSelect: () => {
                        this.setOpen(false);
                        this.dispatcher.dispatch({ action: "start_login" });
                    },
                },
                {
                    label: _t("action|create_account"),
                    onSelect: () => {
                        this.setOpen(false);
                        this.dispatcher.dispatch({ action: "start_registration" });
                    },
                },
                {
                    label: _t("user_menu|settings"),
                    onSelect: () => {
                        this.setOpen(false);
                        this.dispatcher.dispatch({ action: Action.ViewUserSettings });
                    },
                },
            ];
        }
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
        ].filter((item) => item !== null);
    }

    public constructor(
        private readonly dispatcher: MatrixDispatcher,
        private readonly client: MatrixClient,
        isPanelCollapsed: boolean,
    ) {
        const userId = client.getSafeUserId();
        const displayName = OwnProfileStore.instance.displayName || userId;
        const avatarUrl = OwnProfileStore.instance.getHttpAvatarUrl(AVATAR_PX) ?? undefined;
        const manageAccountHref = SdkContextClass.instance.oidcClientStore.accountManagementEndpoint;

        super(undefined, {
            open: false,
            userId,
            displayName,
            avatarUrl,
            manageAccountHref,
            expanded: isPanelCollapsed,
            actions: [],
        });
        this.snapshot.merge({ actions: this.getActions() });
        OwnProfileStore.instance.on(UPDATE_EVENT, this.recalculateProfile);
    }

    public dispose(): void {
        OwnProfileStore.instance.off(UPDATE_EVENT, this.recalculateProfile);
        super.dispose();
    }

    public recalculateProfile = (): void => {
        const displayName = OwnProfileStore.instance.displayName || this.snapshot.current.userId;
        const avatarUrl = OwnProfileStore.instance.getHttpAvatarUrl(AVATAR_PX) ?? undefined;
        const manageAccountHref = SdkContextClass.instance.oidcClientStore.accountManagementEndpoint;
        this.snapshot.merge({ displayName, avatarUrl, manageAccountHref });
    };
    public setOpen = (isOpen: boolean): void => {
        this.snapshot.merge({ open: isOpen });
    };

    public setExpanded = (expanded: boolean): void => {
        this.snapshot.merge({ expanded });
    };
}
