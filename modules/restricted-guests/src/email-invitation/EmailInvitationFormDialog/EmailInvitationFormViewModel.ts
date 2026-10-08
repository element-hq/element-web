/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { BaseViewModel } from "@element-hq/web-shared-components";
import { copyPlainTextToClipboard, emailLooksValid } from "@element-hq/element-web-shared-utils";
import type {
    EmailInvitationFormResult,
    EmailInvitationFormViewActions,
    EmailInvitationFormViewSnapshot,
} from "./types";
import type { Api, HistoryVisibility, JoinRule, Room } from "@element-hq/element-web-module-api";
import type { ModuleConfig } from "../../config";

/**
 * Whether new members can read the messages sent before they joined.
 */
function isHistoryShared(historyVisibility: HistoryVisibility): boolean {
    return historyVisibility === "shared" || historyVisibility === "world_readable";
}

interface EmailInvitationFormViewModelProps {
    /** Module API */
    api: Api;
    /** The room to invite guests to */
    room: Room;
    /** Module configuration */
    config: ModuleConfig;
    /** The invite link to copy to the clipboard */
    inviteLink?: string;
    /** Close the dialog without sending the invitations */
    closeDialog: () => void;
    /** Called with the emails to invite and whether the join rule must change, when the user sends the invitations. */
    onSubmit: (result: EmailInvitationFormResult) => void;
}

/**
 * View model of the email invitation form.
 * Keeps the list of emails, checks that they are valid and that the join rule change is confirmed when needed,
 * and follows the room join rule while the dialog is open.
 */
export class EmailInvitationFormViewModel
    extends BaseViewModel<EmailInvitationFormViewSnapshot, EmailInvitationFormViewModelProps>
    implements EmailInvitationFormViewActions
{
    private copyTooltipTimeout?: ReturnType<typeof setTimeout>;

    public constructor(props: EmailInvitationFormViewModelProps) {
        super(props, {
            emails: [],
            canSendInvitations: false,
            hasAccessToChatHistory: isHistoryShared(props.room.historyVisibility.value),
            canCopyLinkToClipboard: Boolean(props.inviteLink),
            displayCopyTooltip: false,
            isJoinRuleChangeConfirmed: false,
            isJoinRuleChangeRequired: props.room.joinRule.value !== "knock",
        });

        // Listen to join rule change
        const onJoinRuleChange = (joinRule: JoinRule): void => {
            this.snapshot.merge({ isJoinRuleChangeRequired: joinRule !== "knock" });
        };
        props.room.joinRule.watch(onJoinRuleChange);
        // Watching refreshes the join rule, which may have changed while nobody was watching
        onJoinRuleChange(props.room.joinRule.value);
        this.disposables.track(() => props.room.joinRule.unwatch(onJoinRuleChange));

        // Listen to history visibility change, guests can read past messages when history is shared
        const onHistoryVisibilityChange = (historyVisibility: HistoryVisibility): void => {
            this.snapshot.merge({ hasAccessToChatHistory: isHistoryShared(historyVisibility) });
        };
        props.room.historyVisibility.watch(onHistoryVisibilityChange);
        // Watching refreshes the history visibility, which may have changed while nobody was watching
        onHistoryVisibilityChange(props.room.historyVisibility.value);
        this.disposables.track(() => props.room.historyVisibility.unwatch(onHistoryVisibilityChange));

        // Clean tooltip timeout
        this.disposables.track(() => clearTimeout(this.copyTooltipTimeout));
    }

    /**
     * Determines if the user can send invitations based on the current state of the view model.
     * The user can send invitations if:
     * - There is at least one valid email in the emails array.
     * - If a join rule change is required, it must be confirmed by the user.
     *
     * @returns {boolean} True if the user can send invitations, false otherwise.
     */
    private get canSendInvitations(): boolean {
        const { emails, isJoinRuleChangeRequired, isJoinRuleChangeConfirmed } = this.snapshot.current;
        const hasValidEmails = emails.length > 0 && emails.every((email) => email.isValid);
        return hasValidEmails && (!isJoinRuleChangeRequired || isJoinRuleChangeConfirmed);
    }

    public addEmail(email: string): void {
        const newEmail = { text: email, isValid: emailLooksValid(email) };
        this.snapshot.merge({ emails: this.snapshot.current.emails.concat(newEmail) });
        this.snapshot.merge({ canSendInvitations: this.canSendInvitations });
    }

    public removeEmail(index: number): void {
        const newEmails = this.snapshot.current.emails.filter((_, i) => i !== index);
        this.snapshot.merge({ emails: newEmails });
        this.snapshot.merge({ canSendInvitations: this.canSendInvitations });
    }

    public sendInvitations = (): void => {
        if (!this.snapshot.current.canSendInvitations) return;

        const hasToChangeJoinRule =
            this.snapshot.current.isJoinRuleChangeRequired && this.snapshot.current.isJoinRuleChangeConfirmed;

        this.props.onSubmit({
            emails: this.snapshot.current.emails.map((email) => email.text),
            hasToChangeJoinRule,
        });
    };

    public toggleJoinRuleConfirmed = (): void => {
        const isJoinRuleChangeConfirmed = !this.snapshot.current.isJoinRuleChangeConfirmed;
        this.snapshot.merge({ isJoinRuleChangeConfirmed });
        this.snapshot.merge({ canSendInvitations: this.canSendInvitations });
    };

    public copyLinkToClipboard = async (): Promise<void> => {
        clearTimeout(this.copyTooltipTimeout);
        // If the invite link is not available, do nothing
        if (!this.props.inviteLink) return;

        // Copy the invite link to the clipboard
        await copyPlainTextToClipboard(this.props.inviteLink);
        // Display the tooltip for 5 seconds
        this.snapshot.merge({ displayCopyTooltip: true });
        this.copyTooltipTimeout = setTimeout(() => this.snapshot.merge({ displayCopyTooltip: false }), 5000);
    };

    public closeDialog = (): void => {
        this.props.closeDialog();
    };
}
