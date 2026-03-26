/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactNode, type JSX, type MouseEventHandler, type PropsWithChildren } from "react";
import { Badge, H2, Link, Root as Form, Text, SettingsToggleInput } from "@vector-im/compound-web";
import LockIcon from "@vector-im/compound-design-tokens/assets/web/icons/lock-solid";
import LockOffIcon from "@vector-im/compound-design-tokens/assets/web/icons/lock-off";
import PublicIcon from "@vector-im/compound-design-tokens/assets/web/icons/public";
import NotificationsIcon from "@vector-im/compound-design-tokens/assets/web/icons/notifications-solid";
import UserAddIcon from "@vector-im/compound-design-tokens/assets/web/icons/user-add-solid";

import { type ViewModel } from "../../core/viewmodel/ViewModel";
import { Flex } from "../../core/utils/Flex";
import { useViewModel } from "../../core/viewmodel";
import styles from "./StartChatView.module.css";
import { useI18n } from "../../core/i18n/i18nContext";

export type StartChatType = "dm" | "private_room" | "public_room";

export interface StartChatViewSnapshot {
    /** The type of chat to start. */
    type: StartChatType;
    /** The name of the room */
    roomName: string;
    /** The name of the member in a DM */
    dmName?: string;
    /** Whether the room is encrypted. */
    isEncrypted: boolean;
    /** Whether the user can invite others to the room. */
    canInvite: boolean;
    /** Whether the room is a favourite of the user. */
    isFavourite: boolean;
}

export interface StartChatViewActions {
    /** Get the avatar component */
    getAvatar: () => ReactNode;
    /** Toggle favourite state of the room  */
    toggleFavourite: () => void;
    /** Click on notifications button */
    openNotifications: () => void;
    /** Click on invite button */
    invite: () => void;
}

/**
 * The view model for the component, combining its snapshot and actions.
 */
export type StartChatViewModel = ViewModel<StartChatViewSnapshot> & StartChatViewActions;

export interface StartChatViewProps {
    /** The view model for the component. */
    vm: StartChatViewModel;
}

/**
 * A component to display the details of a room being started, such as the name, avatar, and available actions.
 *
 * @example
 * ```
 * <StartChatView vm={vm} />
 * ```
 */
export function StartChatView({ vm }: StartChatViewProps): JSX.Element {
    const snapshot = useViewModel(vm);

    return (
        <Flex
            as="li"
            className={styles.container}
            direction="column"
            gap="var(--cpd-space-4x)"
            data-testid="start-chat-view"
        >
            {vm.getAvatar()}
            <Flex className={styles.content} direction="column" gap="var(--cpd-space-2x)">
                <H2 size="md" className={styles.title}>
                    {snapshot.roomName}
                </H2>
                <Flex direction="column" gap="var(--cpd-space-3x)">
                    <Description snapshot={snapshot} />
                    <Badges snapshot={snapshot} />
                </Flex>
            </Flex>
            <Actions snapshot={snapshot} vm={vm} />
        </Flex>
    );
}

/**
 * A small component to render the description text based on the type of room being started.
 */
function Description({ snapshot: { type, dmName, isEncrypted } }: { snapshot: StartChatViewSnapshot }): JSX.Element {
    const { translate: _t } = useI18n();

    let description: ReactNode;
    switch (type) {
        case "dm":
            description = (
                <>
                    <Text as="span">
                        {_t(
                            "room|start_chat|dm",
                            {},
                            {
                                dmName: (
                                    <Text Text as="span" weight="semibold">
                                        {dmName}
                                    </Text>
                                ),
                            },
                        )}
                    </Text>
                    {isEncrypted && <Text as="span">{_t("room|start_chat|dm_encrypted")}</Text>}
                </>
            );
            break;
        case "private_room":
            description = (
                <>
                    <Text as="span">{_t("room|start_chat|private_room")}</Text>
                    <Text as="span">{_t("room|start_chat|private_room_description")}</Text>
                </>
            );
            break;
        case "public_room":
            description = (
                <>
                    <Text as="span">{_t("room|start_chat|public_room")}</Text>
                    <Text as="span">{_t("room|start_chat|public_room_description")}</Text>
                </>
            );
    }

    return <Flex direction="column">{description}</Flex>;
}
/**
 * A small component to render the badges based on the type of room and encryption status.
 */
function Badges({ snapshot: { type, isEncrypted } }: { snapshot: StartChatViewSnapshot }): JSX.Element {
    const { translate: _t } = useI18n();
    const isPublicRoom = type === "public_room";

    return (
        <Flex gap="var(--cpd-space-2x)">
            {isPublicRoom && (
                <Badge kind="blue">
                    <PublicIcon width="1rem" height="1rem" />
                    {_t("common|public_room")}
                </Badge>
            )}
            {isEncrypted ? (
                <Badge kind="green">
                    <LockIcon width="1rem" height="1rem" />
                    {_t("common|encrypted")}
                </Badge>
            ) : (
                <Badge kind="blue">
                    <LockOffIcon width="1rem" height="1rem" />
                    {_t("common|not_encrypted")}
                </Badge>
            )}
        </Flex>
    );
}

interface ActionsProps {
    snapshot: StartChatViewSnapshot;
    vm: StartChatViewModel;
}

/**
 * A small component to render the available actions based on the type of room and user permissions.
 */
function Actions({ snapshot: { canInvite, isFavourite }, vm }: ActionsProps): JSX.Element {
    const { translate: _t } = useI18n();

    return (
        <Flex className={styles.actions} gap="var(--cpd-space-4x)" align="center">
            <Form onSubmit={(e) => vm.toggleFavourite()}>
                <SettingsToggleInput
                    name="favourite"
                    label={_t("room|start_chat|add_favourite")}
                    checked={isFavourite}
                    onChange={() => vm.toggleFavourite()}
                />
            </Form>
            {canInvite && (
                <Action Icon={<UserAddIcon width="20px" height="20px" />} onClick={() => vm.invite()}>
                    {_t("room|start_chat|invite")}
                </Action>
            )}
            <Action Icon={<NotificationsIcon width="20px" height="20px" />} onClick={() => vm.openNotifications()}>
                {_t("common|notifications")}
            </Action>
        </Flex>
    );
}

interface ActionProps {
    /** Icon to display alongside the text */
    Icon: ReactNode;
    /** Call when button is clicked */
    onClick: MouseEventHandler<HTMLAnchorElement>;
}

/**
 * A small component to render an action with an icon and text.
 */
function Action({ children, onClick, Icon }: PropsWithChildren<ActionProps>): JSX.Element {
    return (
        <Link kind="primary" onClick={onClick} className={styles.action} role="button">
            {Icon}
            <Text as="span" size="md" weight="medium">
                {children}
            </Text>
        </Link>
    );
}
