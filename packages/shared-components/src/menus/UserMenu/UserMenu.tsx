/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Avatar, Button, Link, Menu, MenuItem, Separator, Text } from "@vector-im/compound-web";
import {
    ChatProblemIcon,
    DevicesIcon,
    HomeSolidIcon,
    LockIcon,
    PopOutIcon,
    SettingsIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import classNames from "classnames";

import styles from "./UserMenu.module.css";
import { useViewModel, type ViewModel } from "../../core/viewmodel";
import { useI18n } from "../../core/i18n/i18nContext";

export interface UserMenuViewSnapshot {
    /**
     * Is the menu open or closed.
     */
    open: boolean;
    /**
     * Is the menu toggle expanded (avatar + displayname) or collapsed (avatar).
     */
    expanded: boolean;
    /**
     * Avatar URL for the user, if one is set.
     */
    avatarUrl?: string;
    /**
     * Should the avatar be visible.
     * @default true
     */
    showAvatar?: boolean;
    /**
     * Display name for the user.
     */
    displayName: string;
    /**
     * Matrix user ID for the user.
     */
    userId: string;
    /**
     * Account management URL if the user is using OIDC.
     */
    manageAccountHref?: string;
    /**
     * A set of actions that the user can perform from the menu.
     */
    actions: Partial<{
        createAccount: boolean;
        signIn: boolean;
        openHomePage: boolean;
        linkNewDevice: boolean;
        openSecurity: boolean;
        openFeedback: boolean;
        openSettings: boolean;
    }>;
}

export declare interface UserMenuViewActions {
    /**
     * Called when the menu is opened or closed.
     */
    setOpen: (open: boolean) => void;
    /**
     * Called to open the create new account view.
     */
    createAccount: () => void;
    /**
     * Called to open the sign in view.
     */
    signIn: () => void;
    /**
     * Called to change the view to the configured home page.
     */
    openHomePage: () => void;
    /**
     * Called to open the link new device flow.
     */
    linkNewDevice: () => void;
    /**
     * Called to open the security tab of the settings dialog.
     */
    openSecurity: () => void;
    /**
     * Called to open the feedback dialog.
     */
    openFeedback: () => void;
    /**
     * Called to open the settings dialog.
     */
    openSettings: () => void;
}

export type UserMenuViewProps = {
    vm: ViewModel<UserMenuViewSnapshot, UserMenuViewActions>;
    /**
     * Class name for the container
     */
    className?: string;
};

export function UserMenuView({ vm, className }: UserMenuViewProps): JSX.Element {
    const {
        userId,
        displayName,
        avatarUrl,
        expanded,
        open,
        manageAccountHref,
        actions,
        showAvatar = true,
    } = useViewModel(vm);
    const { translate: _t } = useI18n();
    const trigger = (
        <button className={classNames(styles.triggerButton)} aria-label={_t("menus|user_menu|title")}>
            <Avatar id={userId} name={displayName} type="round" size="36px" src={avatarUrl} />
            {expanded && (
                <Text type="heading" size="sm" as="span" weight="semibold">
                    {displayName}
                </Text>
            )}
        </button>
    );
    return (
        <Menu
            open={open}
            showTitle={false}
            title={_t("menus|user_menu|title")}
            trigger={trigger}
            onOpenChange={vm.setOpen}
            align="start"
            side="bottom"
            className={classNames(styles.container, className)}
        >
            <section className={styles.profile}>
                {showAvatar && <Avatar id={userId} name={displayName} type="round" size="88px" src={avatarUrl} />}
                <Text className={styles.displayname} type="heading" size="md" weight="semibold" as="span">
                    {displayName}
                </Text>
                <Text data-testid="userId" size="md" as="span" type="body">
                    {userId}
                </Text>
                {manageAccountHref && (
                    <Button as="a" size="sm" kind="tertiary" href={manageAccountHref} Icon={PopOutIcon}>
                        {_t("menus|user_menu|manage_account")}
                    </Button>
                )}
                {actions.createAccount && (
                    <Button
                        className={styles.createAccount}
                        size="sm"
                        as="button"
                        kind="primary"
                        onClick={vm.createAccount}
                    >
                        {_t("menus|user_menu|create_an_account")}
                    </Button>
                )}
                {actions.signIn && (
                    <Text as="span" weight="medium">
                        {_t("menus|user_menu|got_an_account")}
                        <Link as="button" onClick={vm.signIn}>
                            {_t("menus|user_menu|sign_in")}
                        </Link>
                    </Text>
                )}
            </section>
            <Separator />
            <section className={styles.actions}>
                {actions.openHomePage && (
                    <MenuItem Icon={HomeSolidIcon} label={_t("user_menu|open_home")} onSelect={vm.openHomePage} />
                )}
                {actions.linkNewDevice && (
                    <MenuItem Icon={DevicesIcon} label={_t("user_menu|link_new_device")} onSelect={vm.linkNewDevice} />
                )}
                {actions.openSecurity && (
                    <MenuItem Icon={LockIcon} label={_t("user_menu|open_security")} onSelect={vm.openSecurity} />
                )}
                {actions.openFeedback && (
                    <MenuItem Icon={ChatProblemIcon} label={_t("user_menu|open_feedback")} onSelect={vm.openFeedback} />
                )}
                {actions.openSettings && (
                    <MenuItem Icon={SettingsIcon} label={_t("user_menu|open_settings")} onSelect={vm.openSettings} />
                )}
            </section>
        </Menu>
    );
}
