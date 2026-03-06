/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MouseEvent, type MouseEventHandler, type ReactNode } from "react";
import { MsgType } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type TextualBodyKind,
    type TextualBodyViewModel as TextualBodyViewModelInterface,
    type TextualBodyViewSnapshot,
} from "@element-hq/web-shared-components";

import { formatDate } from "../../DateUtils";
import { _t } from "../../languageHandler";

export interface TextualBodyViewModelProps {
    /**
     * Optional id applied to the root message body element.
     */
    id?: string;
    /**
     * Matrix message type used to derive the textual body variant.
     */
    msgType?: string;
    /**
     * Rendered message body content.
     */
    body: ReactNode;
    /**
     * Optional widgets rendered after the message body, such as link previews.
     */
    widgets?: ReactNode;
    /**
     * Sender label displayed for emote messages.
     */
    emoteSender?: string;
    /**
     * Event id of the replacement event when the message has been edited.
     */
    replacingEventId?: string;
    /**
     * Timestamp of the replacement event used in the edited marker tooltip.
     */
    replacingEventDate?: Date;
    /**
     * Whether the current user can see a message that is hidden for other users.
     */
    isSeeingThroughMessageHiddenForModeration?: boolean;
    /**
     * Moderation reason shown when the message is pending moderation.
     */
    pendingModerationReason?: string;
    /**
     * Click handler for body links and other delegated body interactions.
     */
    onBodyClick?: MouseEventHandler<HTMLDivElement>;
    /**
     * Click handler for the edited marker.
     */
    onEditedMarkerClick?: MouseEventHandler<HTMLButtonElement>;
    /**
     * Click handler for the emote sender label.
     */
    onEmoteSenderClick?: MouseEventHandler<HTMLButtonElement>;
}

type EditedSnapshotFields = Pick<
    TextualBodyViewSnapshot,
    "editedMarkerText" | "editedMarkerLabel" | "editedMarkerDescription" | "editedMarkerCaption"
>;

function getKind(msgType?: string): TextualBodyKind {
    switch (msgType) {
        case MsgType.Notice:
            return "notice";
        case MsgType.Emote:
            return "emote";
        case MsgType.Image:
        case MsgType.File:
        case MsgType.Audio:
        case MsgType.Video:
            return "caption";
        default:
            return "text";
    }
}

function getEditedSnapshotFields(replacingEventId?: string, replacingEventDate?: Date): EditedSnapshotFields {
    if (!replacingEventId) {
        return {
            editedMarkerText: undefined,
            editedMarkerLabel: undefined,
            editedMarkerDescription: undefined,
            editedMarkerCaption: undefined,
        };
    }

    const date = replacingEventDate ? formatDate(replacingEventDate) : undefined;

    return {
        editedMarkerText: `(${_t("common|edited")})`,
        editedMarkerLabel: _t("timeline|edits|tooltip_label", { date }),
        editedMarkerDescription: _t("timeline|edits|tooltip_title", { date }),
        editedMarkerCaption: _t("timeline|edits|tooltip_sub"),
    };
}

function getPendingModerationText(
    isSeeingThroughMessageHiddenForModeration?: boolean,
    pendingModerationReason?: string,
): string | undefined {
    if (!isSeeingThroughMessageHiddenForModeration) {
        return undefined;
    }

    if (pendingModerationReason) {
        return _t("timeline|pending_moderation_reason", { reason: pendingModerationReason });
    }

    return _t("timeline|pending_moderation");
}

export class TextualBodyViewModel
    extends BaseViewModel<TextualBodyViewSnapshot, TextualBodyViewModelProps>
    implements TextualBodyViewModelInterface
{
    private static readonly computeSnapshot = (props: TextualBodyViewModelProps): TextualBodyViewSnapshot => ({
        id: props.id,
        kind: getKind(props.msgType),
        body: props.body,
        widgets: props.widgets,
        emoteSender: props.emoteSender,
        emoteSenderLabel: props.emoteSender,
        pendingModerationText: getPendingModerationText(
            props.isSeeingThroughMessageHiddenForModeration,
            props.pendingModerationReason,
        ),
        ...getEditedSnapshotFields(props.replacingEventId, props.replacingEventDate),
    });

    public constructor(props: TextualBodyViewModelProps) {
        super(props, TextualBodyViewModel.computeSnapshot(props));
    }

    public setId(id?: string): void {
        if (this.props.id === id) return;

        this.props = { ...this.props, id };
        this.snapshot.merge({ id });
    }

    public setMessageContent({
        msgType,
        body,
        emoteSender,
    }: Pick<TextualBodyViewModelProps, "msgType" | "body" | "emoteSender">): void {
        if (this.props.msgType === msgType && this.props.body === body && this.props.emoteSender === emoteSender) {
            return;
        }

        this.props = {
            ...this.props,
            msgType,
            body,
            emoteSender,
        };

        const nextKind = getKind(msgType);
        const updates: Partial<TextualBodyViewSnapshot> = {};

        if (this.snapshot.current.kind !== nextKind) {
            updates.kind = nextKind;
        }
        if (this.snapshot.current.body !== body) {
            updates.body = body;
        }
        if (this.snapshot.current.emoteSender !== emoteSender) {
            updates.emoteSender = emoteSender;
            updates.emoteSenderLabel = emoteSender;
        }

        if (Object.keys(updates).length > 0) {
            this.snapshot.merge(updates);
        }
    }

    public setWidgets(widgets?: ReactNode): void {
        if (this.props.widgets === widgets) return;

        this.props = { ...this.props, widgets };
        this.snapshot.merge({ widgets });
    }

    public setEditedState(replacingEventId?: string, replacingEventDate?: Date): void {
        if (
            this.props.replacingEventId === replacingEventId &&
            this.props.replacingEventDate?.getTime() === replacingEventDate?.getTime()
        ) {
            return;
        }

        this.props = {
            ...this.props,
            replacingEventId,
            replacingEventDate,
        };

        this.snapshot.merge(getEditedSnapshotFields(replacingEventId, replacingEventDate));
    }

    public setPendingModeration(
        isSeeingThroughMessageHiddenForModeration?: boolean,
        pendingModerationReason?: string,
    ): void {
        if (
            this.props.isSeeingThroughMessageHiddenForModeration === isSeeingThroughMessageHiddenForModeration &&
            this.props.pendingModerationReason === pendingModerationReason
        ) {
            return;
        }

        this.props = {
            ...this.props,
            isSeeingThroughMessageHiddenForModeration,
            pendingModerationReason,
        };

        this.snapshot.merge({
            pendingModerationText: getPendingModerationText(
                isSeeingThroughMessageHiddenForModeration,
                pendingModerationReason,
            ),
        });
    }

    public setHandlers({
        onBodyClick,
        onEditedMarkerClick,
        onEmoteSenderClick,
    }: Pick<TextualBodyViewModelProps, "onBodyClick" | "onEditedMarkerClick" | "onEmoteSenderClick">): void {
        this.props = {
            ...this.props,
            onBodyClick,
            onEditedMarkerClick,
            onEmoteSenderClick,
        };
    }

    public onBodyClick = (event: MouseEvent<HTMLDivElement>): void => {
        this.props.onBodyClick?.(event);
    };

    public onEditedMarkerClick = (event: MouseEvent<HTMLButtonElement>): void => {
        this.props.onEditedMarkerClick?.(event);
    };

    public onEmoteSenderClick = (event: MouseEvent<HTMLButtonElement>): void => {
        this.props.onEmoteSenderClick?.(event);
    };
}
