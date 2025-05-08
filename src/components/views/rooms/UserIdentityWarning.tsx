/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type Room, type RoomMember } from "matrix-js-sdk/src/matrix";
import { Button, Separator } from "@vector-im/compound-web";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import MemberAvatar from "../avatars/MemberAvatar";
import {
    useUserIdentityWarningViewModel,
    type ViolationPrompt,
} from "../../viewmodels/rooms/UserIdentityWarningViewModel.tsx";
import { type ButtonEvent } from "../elements/AccessibleButton.tsx";

interface UserIdentityWarningProps {
    /**
     * The current room being viewed.
     */
    room: Room;
    /**
     * The ID of the room being viewed.  This is used to ensure that the
     * component's state and references are cleared when the room changes.
     */
    key: string;
}

/**
 * Displays a banner warning when there is an issue with a user's identity.
 *
 * Warns when an unverified user's identity was reset, and gives the user a
 * button to acknowledge the change.
 */
export const UserIdentityWarning: React.FC<UserIdentityWarningProps> = ({ room }) => {
    const { currentPrompt, dispatchAction } = useUserIdentityWarningViewModel(room, room.roomId);

    if (!currentPrompt) return null;

    const [title, action] = getTitleAndAction(currentPrompt);

    const onButtonClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        if (currentPrompt.type === "VerificationViolation") {
            dispatchAction({ type: "WithdrawVerification", userId: currentPrompt.member.userId });
        } else {
            dispatchAction({ type: "PinUserIdentity", userId: currentPrompt.member.userId });
        }
    };
    return warningBanner(
        currentPrompt.type === "VerificationViolation",
        memberAvatar(currentPrompt.member),
        title,
        action,
        onButtonClick,
    );
};

function getTitleAndAction(prompt: ViolationPrompt): [title: React.ReactNode, action: string] {
    let title: React.ReactNode;
    let action: string;
    if (prompt.type === "VerificationViolation") {
        if (prompt.member.rawDisplayName === prompt.member.userId) {
            title = _t(
                "encryption|verified_identity_changed_no_displayname",
                { userId: prompt.member.userId },
                {
                    a: substituteATag,
                    b: substituteBTag,
                },
            );
        } else {
            title = _t(
                "encryption|verified_identity_changed",
                { displayName: prompt.member.rawDisplayName, userId: prompt.member.userId },
                {
                    a: substituteATag,
                    b: substituteBTag,
                },
            );
        }
        action = _t("encryption|withdraw_verification_action");
    } else {
        if (prompt.member.rawDisplayName === prompt.member.userId) {
            title = _t(
                "encryption|pinned_identity_changed_no_displayname",
                { userId: prompt.member.userId },
                {
                    a: substituteATag,
                    b: substituteBTag,
                },
            );
        } else {
            title = _t(
                "encryption|pinned_identity_changed",
                { displayName: prompt.member.rawDisplayName, userId: prompt.member.userId },
                {
                    a: substituteATag,
                    b: substituteBTag,
                },
            );
        }
        action = _t("action|dismiss");
    }
    return [title, action];
}

function warningBanner(
    isCritical: boolean,
    avatar: React.ReactNode,
    title: React.ReactNode,
    action: string,
    onButtonClick: (ev: ButtonEvent) => void,
): React.ReactNode {
    return (
        <div className={classNames("mx_UserIdentityWarning", { critical: isCritical })}>
            <Separator />
            <div className="mx_UserIdentityWarning_row">
                {avatar}
                <span className={classNames("mx_UserIdentityWarning_main", { critical: isCritical })}>{title}</span>
                <Button kind="secondary" size="sm" onClick={onButtonClick}>
                    {action}
                </Button>
            </div>
        </div>
    );
}
function memberAvatar(member: RoomMember): React.ReactNode {
    return <MemberAvatar member={member} title={member.userId} size="30px" />;
}

function substituteATag(sub: string): React.ReactNode {
    return (
        <a href="https://element.io/help#encryption18" target="_blank" rel="noreferrer noopener">
            {sub}
        </a>
    );
}

function substituteBTag(sub: string): React.ReactNode {
    return <b>{sub}</b>;
}
