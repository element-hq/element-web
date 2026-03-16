/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type PropsWithChildren, useState } from "react";
import { Avatar, Button, Menu, Separator, Text } from "@vector-im/compound-web";
import PopOutIcon from "@vector-im/compound-design-tokens/assets/web/icons/pop-out";

import styles from "./QuickSettingsMenu.module.css";

export type QuickSettingsMenuViewProps = PropsWithChildren<{
    avatarUrl?: string;
    displayName: string;
    userId: string;
    manageAccountHref?: string;
}>;

export function QuickSettingsMenu({
    userId,
    displayName,
    avatarUrl,
    manageAccountHref,
    children,
}: QuickSettingsMenuViewProps): JSX.Element {
    const [open, isOpen] = useState(true);
    const trigger = (
        <button className={styles.triggerButton}>
            <Avatar id={userId} name={displayName} type="round" size="48px" src={avatarUrl} />
            <Text type="heading" size="sm" as="span" weight="semibold">
                {displayName}
            </Text>
        </button>
    );
    return (
        <>
            <Menu
                open={open}
                showTitle={false}
                title="Quick Settings"
                trigger={trigger}
                onOpenChange={isOpen}
                align="start"
                side="bottom"
                className={styles.container}
            >
                <section className={styles.profile}>
                    <Avatar id={userId} name={displayName} type="round" size="88px" src={avatarUrl} />
                    <Text type="heading" size="md" weight="semibold" as="span">
                        {displayName}
                    </Text>
                    <Text size="md" as="span" type="body">
                        {userId}
                    </Text>
                    {manageAccountHref && (
                        <Button as="a" kind="tertiary" href={manageAccountHref} Icon={PopOutIcon}>
                            Manage account
                        </Button>
                    )}
                </section>
                <Separator />
                <section className={styles.actions}>{children}</section>
            </Menu>
        </>
    );
}
