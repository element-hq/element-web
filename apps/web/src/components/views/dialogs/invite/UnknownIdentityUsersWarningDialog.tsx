/*
 Copyright 2026 Element Creations Ltd.

 SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useCallback } from "react";
import { CheckIcon, CloseIcon, UserAddSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Button, PageHeader } from "@vector-im/compound-web";

import { InviteKind } from "../InviteDialogTypes.ts";
import { type Member } from "../../../../utils/direct-messages.ts";
import BaseDialog from "../BaseDialog.tsx";
import { type ScreenName } from "../../../../PosthogTrackers.ts";
import { DMRoomTile } from "./DMRoomTile.tsx";
import { _t } from "../../../../languageHandler.tsx";

interface Props {
    /** Callback that will be called when the 'Continue' or 'Invite' button is clicked. */
    onContinue: () => void;

    /** Callback that will be called when the 'Cancel' button is clicked. Unused unless {@link kind} is {@link InviteKind.Dm}. */
    onCancel: () => void;

    /** Callback that will be called when the 'Remove' button is clicked. Unused unless {@link kind} is {@link InviteKind.Invite}. */
    onRemove: () => void;

    /** Optional Posthog ScreenName to supply during the lifetime of this dialog. */
    screenName: ScreenName | undefined;

    /** The type of invite dialog: whether we are starting a new DM, or inviting users to an existing room */
    kind: InviteKind.Dm | InviteKind.Invite;

    /** The users whose identities we don't know */
    users: Member[];
}

/**
 * Part of the invite dialog: a screen that appears if there are any users whose cryptographic identity we don't know,
 * to confirm that they are the right users.
 *
 * Figma: https://www.figma.com/design/chAcaQAluTuRg6BsG4Npc0/-3163--Inviting-Unknown-People?node-id=150-17719&t=ISAikbnj97LM4NwT-0
 */
const UnknownIdentityUsersWarningDialog: React.FC<Props> = (props) => {
    const userListItem = useCallback((u: Member) => <DMRoomTile member={u} key={u.userId} />, []);

    let title: string;
    let headerText: string;
    let buttons: JSX.Element;

    if (props.kind == InviteKind.Invite) {
        title = _t("invite|confirm_unknown_users|invite_title");
        headerText = _t("invite|confirm_unknown_users|invite_subtitle");
        buttons = inviteButtons({
            onInvite: props.onContinue,
            onRemove: props.onRemove,
        });
    } else {
        title =
            props.users.length == 1
                ? _t("invite|confirm_unknown_users|start_chat_title_one_user")
                : _t("invite|confirm_unknown_users|start_chat_title_multiple_users");

        headerText =
            props.users.length == 1
                ? _t("invite|confirm_unknown_users|start_chat_subtitle_one_user")
                : _t("invite|confirm_unknown_users|start_chat_subtitle_multiple_users");

        buttons = dmButtons({
            onCancel: props.onCancel,
            onContinue: props.onContinue,
        });
    }

    return (
        <BaseDialog
            onFinished={props.onCancel}
            className="mx_UnknownIdentityUsersWarningDialog"
            screenName={props.screenName}
        >
            <div className="mx_UnknownIdentityUsersWarningDialog_headerContainer">
                <PageHeader Icon={UserAddSolidIcon} heading={title}>
                    <p>{headerText}</p>
                </PageHeader>
            </div>

            <ul className="mx_UnknownIdentityUsersWarningDialog_userList" data-testid="userlist">
                {props.users.map(userListItem)}
            </ul>

            <div className="mx_UnknownIdentityUsersWarningDialog_buttons">{buttons}</div>
        </BaseDialog>
    );
};

function dmButtons(props: { onContinue: () => void; onCancel: () => void }): JSX.Element {
    return (
        <>
            <Button size="lg" kind="secondary" onClick={props.onCancel}>
                {_t("action|cancel")}
            </Button>
            <Button size="lg" kind="primary" onClick={props.onContinue}>
                {_t("action|continue")}
            </Button>
        </>
    );
}

function inviteButtons(props: { onInvite: () => void; onRemove: () => void }): JSX.Element {
    return (
        <>
            <Button size="lg" kind="secondary" onClick={props.onRemove} Icon={CloseIcon}>
                {_t("action|remove")}
            </Button>
            <Button size="lg" kind="primary" onClick={props.onInvite} Icon={CheckIcon}>
                {_t("action|invite")}
            </Button>
        </>
    );
}

export default UnknownIdentityUsersWarningDialog;
