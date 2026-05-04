/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventStatus } from "matrix-js-sdk/src/matrix";
import { BaseViewModel } from "@element-hq/web-shared-components";

import { _t } from "../../../../../languageHandler";

/** Presentation mode for the event-tile message status area. */
export enum MessageStatusMode {
    /** No message status should render. */
    None = "none",
    /** The current user's message has been sent. */
    SentReceipt = "sent_receipt",
    /** The current user's message is still sending. */
    SendingReceipt = "sending_receipt",
    /** The current user's message failed to send. */
    FailedReceipt = "failed_receipt",
    /** The current user's message is being encrypted before sending. */
    EncryptingReceipt = "encrypting_receipt",
    /** Regular read receipts should render. */
    ReadReceipts = "read_receipts",
}

/** Inputs used to derive message status presentation. */
export interface MessageStatusViewModelProps {
    /** Local send state for the event, when available. */
    messageState?: EventStatus;
    /** Whether the special sent receipt should be shown. */
    shouldShowSentReceipt: boolean;
    /** Whether the special sending receipt should be shown. */
    shouldShowSendingReceipt: boolean;
    /** Whether read receipts should be shown when no special receipt is active. */
    showReadReceipts: boolean;
}

/** Snapshot rendered by the event-tile message status component. */
export interface MessageStatusViewSnapshot {
    /** Current presentation mode for the message status area. */
    mode: MessageStatusMode;
    /** Accessible label for special receipt states. */
    label?: string;
}

/** View model for event-tile message status presentation. */
export class MessageStatusViewModel extends BaseViewModel<MessageStatusViewSnapshot, MessageStatusViewModelProps> {
    private static readonly computeSnapshot = (props: MessageStatusViewModelProps): MessageStatusViewSnapshot => {
        if (props.shouldShowSentReceipt || props.shouldShowSendingReceipt) {
            if (props.messageState === EventStatus.ENCRYPTING) {
                return {
                    mode: MessageStatusMode.EncryptingReceipt,
                    label: _t("timeline|send_state_encrypting"),
                };
            }

            if (!props.messageState || props.messageState === EventStatus.SENT) {
                return {
                    mode: MessageStatusMode.SentReceipt,
                    label: _t("timeline|send_state_sent"),
                };
            }

            if (props.messageState === EventStatus.NOT_SENT) {
                return {
                    mode: MessageStatusMode.FailedReceipt,
                    label: _t("timeline|send_state_failed"),
                };
            }

            return {
                mode: MessageStatusMode.SendingReceipt,
                label: _t("timeline|send_state_sending"),
            };
        }

        if (props.showReadReceipts) {
            return { mode: MessageStatusMode.ReadReceipts };
        }

        return { mode: MessageStatusMode.None };
    };

    public constructor(props: MessageStatusViewModelProps) {
        super(props, MessageStatusViewModel.computeSnapshot(props));
    }

    /** Updates the inputs used to derive message status presentation. */
    public setProps(props: MessageStatusViewModelProps): void {
        this.props = props;
        this.snapshot.set(MessageStatusViewModel.computeSnapshot(props));
    }
}
