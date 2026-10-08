/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ViewModel } from "@element-hq/web-shared-components";

/** An email address entered by the user. */
export interface Email {
    /** The email address as typed. */
    text: string;
    /** Whether the address looks like a valid email. */
    isValid: boolean;
}

/** What the email invitation form submits when the user sends the invitations. */
export interface EmailInvitationFormResult {
    /** The email addresses to invite. */
    emails: string[];
    /** Whether the room join rule must change to "ask to join" before inviting. */
    hasToChangeJoinRule: boolean;
}

/** The state of the email invitation dialog. */
export interface EmailInvitationFormViewSnapshot {
    /** Whether invited guests can read the full chat history. */
    hasAccessToChatHistory: boolean;
    /** The email addresses to invite. */
    emails: Email[];
    /** True when every email is valid and, if needed, the join rule change is confirmed. */
    canSendInvitations: boolean;
    /** Whether the "copy link" button is shown. */
    canCopyLinkToClipboard: boolean;
    /** Whether the "copied" tooltip is shown after copying the link. */
    displayCopyTooltip: boolean;
    /** Whether the user agreed to change the room join rule to "ask to join". */
    isJoinRuleChangeConfirmed: boolean;
    /** Whether the room join rule must change to "ask to join" before guests can be invited. */
    isJoinRuleChangeRequired: boolean;
}

/** The actions the email invitation dialog can trigger. */
export interface EmailInvitationFormViewActions {
    /** Add an email address to the list. */
    addEmail(email: string): void;
    /** Remove the email address at `index`. */
    removeEmail(index: number): void;
    /** Submit the emails to invite and whether the join rule must change. */
    sendInvitations(): void;
    /** Copy the room link to the clipboard. */
    copyLinkToClipboard(): Promise<void>;
    /** Close the dialog. */
    closeDialog(): void;
    /** Toggle the confirmation of the join rule change. */
    toggleJoinRuleConfirmed(): void;
}

/** View model of the email invitation dialog. */
export type EmailInvitationFormViewModel = ViewModel<EmailInvitationFormViewSnapshot, EmailInvitationFormViewActions>;
