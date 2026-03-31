/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Avatar, Button, Link, Menu, MenuItem, Separator, Text } from "@vector-im/compound-web";
import PopOutIcon from "@vector-im/compound-design-tokens/assets/web/icons/pop-out";
import classNames from "classnames";

import styles from "./UserMenu.module.css";
import { useViewModel, type ViewModel } from "../../core/viewmodel";
import { useI18n } from "../../core/i18n/i18nContext";

type Icon = React.ForwardRefExoticComponent<
    Omit<React.SVGProps<SVGSVGElement>, "ref" | "children"> & React.RefAttributes<SVGSVGElement>
>;

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
     * Hide the avatar if the user is a guest. Defaults to true
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
    actions: {
        /**
         * Optional menu icon.
         */
        icon?: Icon;
        /**
         * Human-readable label.
         */
        label: string;
        /**
         * Callback to perform when the action is selected.
         */
        onSelect: () => void;
    }[];
    /**
     * Optional action to create an account.
     */
    createAccount?: () => void;
    /**
     * Optional action to sign in.
     */
    signIn?: () => void;
}

export declare interface UserMenuViewActions {
    /**
     * Called when the menu is opened or closed.
     */
    setOpen: (open: boolean) => void;
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
        showAvatar,
        createAccount,
        signIn,
    } = useViewModel(vm);
    const { translate: _t } = useI18n();
    const trigger = (
        <button className={classNames(styles.triggerButton)} aria-label={_t("menus|user_menu|title")}>
            <Avatar id={userId} name={displayName} type="round" size="36px" src={avatarUrl} />
            {expanded ? (
                <Text type="heading" size="sm" as="span" weight="semibold">
                    {displayName}
                </Text>
            ) : null}
        </button>
    );
    return (
        <>
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
                    {showAvatar !== false && (
                        <Avatar id={userId} name={displayName} type="round" size="88px" src={avatarUrl} />
                    )}
                    <Text className={styles.displayname} type="heading" size="md" weight="semibold" as="span">
                        {displayName}
                    </Text>
                    <Text size="md" as="span" type="body">
                        {userId}
                    </Text>
                    {manageAccountHref && (
                        <Button as="a" size="sm" kind="tertiary" href={manageAccountHref} Icon={PopOutIcon}>
                            {_t("menus|user_menu|manage_account")}
                        </Button>
                    )}
                    {createAccount && (
                        <Button
                            className={styles.createAccount}
                            size="sm"
                            as="button"
                            kind="primary"
                            onClick={createAccount}
                        >
                            {_t("menus|user_menu|create_an_account")}
                        </Button>
                    )}
                    {signIn && (
                        <Text as="span" weight="medium">
                            {_t("menus|user_menu|got_an_account")}
                            <Link as="button" onClick={signIn}>
                                {_t("menus|user_menu|sign_in")}
                            </Link>
                        </Text>
                    )}
                </section>
                <Separator />
                <section className={styles.actions}>
                    {actions.map((action) => (
                        <MenuItem
                            key={action.label}
                            Icon={action.icon}
                            label={action.label}
                            onSelect={action.onSelect}
                        />
                    ))}
                </section>
            </Menu>
        </>
    );
}
