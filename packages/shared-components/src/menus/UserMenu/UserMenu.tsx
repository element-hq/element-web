/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Avatar, Button, Menu, MenuItem, Separator, Text } from "@vector-im/compound-web";
import PopOutIcon from "@vector-im/compound-design-tokens/assets/web/icons/pop-out";
import classNames from "classnames";

import styles from "./UserMenu.module.css";
import { useViewModel, type ViewModel } from "../../viewmodel";

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
    const { userId, displayName, avatarUrl, expanded, open, manageAccountHref, actions } = useViewModel(vm);
    const trigger = (
        <button className={classNames(styles.triggerButton)} aria-label="User menu">
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
                title="User menu"
                trigger={trigger}
                onOpenChange={vm.setOpen}
                align="start"
                side="bottom"
                className={classNames(styles.container, className)}
            >
                <section className={styles.profile}>
                    <Avatar id={userId} name={displayName} type="round" size="88px" src={avatarUrl} />
                    <Text className={styles.displayname} type="heading" size="md" weight="semibold" as="span">
                        {displayName}
                    </Text>
                    <Text size="md" as="span" type="body">
                        {userId}
                    </Text>
                    {manageAccountHref && (
                        <Button as="a" size="sm" kind="tertiary" href={manageAccountHref} Icon={PopOutIcon}>
                            Manage account
                        </Button>
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
