/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type RoomMember, User, type Room } from "matrix-js-sdk/src/matrix";
import React, { type JSX, type ReactNode, useContext, useState } from "react";
import { MenuItem } from "@vector-im/compound-web";
import { ChatIcon, CheckIcon, MentionIcon, ShareIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import InviteIcon from "@vector-im/compound-design-tokens/assets/web/icons/user-add";

import { _t } from "../../../../languageHandler";
import { useUserInfoBasicOptionsSection } from "../../../viewmodels/right_panel/user_info/UserInfoBasicOptionsViewModel";
import { Container, type Member } from "../UserInfo";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { shouldShowComponent } from "../../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../../settings/UIFeature";
import { DirectoryMember, startDmOnFirstMessage } from "../../../../utils/direct-messages";

/**
 * Converts the member to a DirectoryMember and starts a DM with them.
 */
async function openDmForUser(matrixClient: MatrixClient, user: Member): Promise<void> {
    const avatarUrl = user instanceof User ? user.avatarUrl : user.getMxcAvatarUrl();
    const startDmUser = new DirectoryMember({
        user_id: user.userId,
        display_name: user.rawDisplayName,
        avatar_url: avatarUrl,
    });
    await startDmOnFirstMessage(matrixClient, [startDmUser]);
}

const MessageButton = ({ member }: { member: Member }): JSX.Element => {
    const cli = useContext(MatrixClientContext);
    const [busy, setBusy] = useState(false);

    return (
        <MenuItem
            role="button"
            onSelect={async (ev) => {
                ev.preventDefault();
                if (busy) return;
                setBusy(true);
                await openDmForUser(cli, member);
                setBusy(false);
            }}
            disabled={busy}
            label={_t("user_info|send_message")}
            Icon={ChatIcon}
        />
    );
};

export const UserInfoBasicOptions: React.FC<{
    isMe: boolean;
    member: User | RoomMember;
    room: Room;
    children?: ReactNode;
}> = ({ isMe, room, member, children }) => {
    const vm = useUserInfoBasicOptionsSection(room, member);

    let insertPillButton: JSX.Element | undefined;
    let inviteUserButton: JSX.Element | undefined;
    let readReceiptButton: JSX.Element | undefined;

    // Only allow the user to ignore the user if its not ourselves
    // same goes for jumping to read receipt
    if (!isMe) {
        readReceiptButton = (
            <MenuItem
                role="button"
                onSelect={async (ev) => {
                    ev.preventDefault();
                    vm.onReadReceiptButton();
                }}
                label={_t("user_info|jump_to_rr_button")}
                disabled={vm.readReceiptButtonDisabled}
                Icon={CheckIcon}
            />
        );

        if (vm.showInsertPillButton) {
            insertPillButton = (
                <MenuItem
                    role="button"
                    onSelect={async (ev) => {
                        ev.preventDefault();
                        vm.onInsertPillButton();
                    }}
                    label={_t("action|mention")}
                    Icon={MentionIcon}
                />
            );
        }

        if (vm.showInviteButton && shouldShowComponent(UIComponent.InviteUsers)) {
            inviteUserButton = (
                <MenuItem
                    role="button"
                    onSelect={async (ev) => {
                        ev.preventDefault();
                        vm.onInviteUserButton(ev);
                    }}
                    label={_t("action|invite")}
                    Icon={InviteIcon}
                />
            );
        }
    }

    const shareUserButton = (
        <MenuItem
            role="button"
            onSelect={async (ev) => {
                ev.preventDefault();
                vm.onShareUserClick();
            }}
            label={_t("user_info|share_button")}
            Icon={ShareIcon}
        />
    );

    const directMessageButton =
        isMe || !shouldShowComponent(UIComponent.CreateRooms) ? null : <MessageButton member={member} />;

    return (
        <Container>
            {children}
            {directMessageButton}
            {inviteUserButton}
            {readReceiptButton}
            {shareUserButton}
            {insertPillButton}
        </Container>
    );
};
