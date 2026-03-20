/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MouseEvent, type MouseEventHandler } from "react";
import { type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    TextualBodyViewBodyWrapperKind,
    TextualBodyViewKind,
    type TextualBodyViewModel as TextualBodyViewModelInterface,
    type TextualBodyViewSnapshot,
} from "@element-hq/web-shared-components";

import { formatDate } from "../../DateUtils";
import { _t } from "../../languageHandler";

const CAPTION_MSG_TYPES = new Set<MsgType>([MsgType.Image, MsgType.File, MsgType.Audio, MsgType.Video]);

export interface TextualBodyViewModelProps {
    mxEvent: MatrixEvent;
    id?: string;
    highlightLink?: string;
    replacingEventId?: string;
    isSeeingThroughMessageHiddenForModeration?: boolean;
    onRootClick?: MouseEventHandler<HTMLDivElement>;
    onBodyActionClick?: MouseEventHandler<HTMLDivElement>;
    onEditedMarkerClick?: MouseEventHandler<HTMLButtonElement>;
    onEmoteSenderClick?: MouseEventHandler<HTMLButtonElement>;
}

type BodyWrapperSnapshot = Pick<TextualBodyViewSnapshot, "bodyWrapper" | "bodyLinkHref" | "bodyActionAriaLabel">;
type EditedMarkerSnapshot = Pick<
    TextualBodyViewSnapshot,
    "showEditedMarker" | "editedMarkerText" | "editedMarkerTooltip" | "editedMarkerCaption"
>;
type PendingModerationSnapshot = Pick<TextualBodyViewSnapshot, "showPendingModerationMarker" | "pendingModerationText">;
type EventDependentSnapshot = Pick<TextualBodyViewSnapshot, "kind" | "emoteSenderName"> &
    BodyWrapperSnapshot &
    EditedMarkerSnapshot &
    PendingModerationSnapshot;

export class TextualBodyViewModel
    extends BaseViewModel<TextualBodyViewSnapshot, TextualBodyViewModelProps>
    implements TextualBodyViewModelInterface
{
    private static computeKind(mxEvent: MatrixEvent): TextualBodyViewKind {
        const msgtype = mxEvent.getContent().msgtype as MsgType | undefined;
        if (msgtype === MsgType.Notice) {
            return TextualBodyViewKind.NOTICE;
        }
        if (msgtype === MsgType.Emote) {
            return TextualBodyViewKind.EMOTE;
        }
        if (msgtype && CAPTION_MSG_TYPES.has(msgtype)) {
            return TextualBodyViewKind.CAPTION;
        }
        return TextualBodyViewKind.TEXT;
    }

    private static getStarterLink(mxEvent: MatrixEvent): string | undefined {
        const content = mxEvent.getContent();
        const starterLink = content.data?.["org.matrix.neb.starter_link"];
        return typeof starterLink === "string" ? starterLink : undefined;
    }

    private static computeBodyWrapperSnapshot(props: TextualBodyViewModelProps): BodyWrapperSnapshot {
        if (props.highlightLink) {
            return {
                bodyWrapper: TextualBodyViewBodyWrapperKind.LINK,
                bodyLinkHref: props.highlightLink,
                bodyActionAriaLabel: undefined,
            };
        }

        if (TextualBodyViewModel.getStarterLink(props.mxEvent)) {
            return {
                bodyWrapper: TextualBodyViewBodyWrapperKind.ACTION,
                bodyLinkHref: undefined,
                bodyActionAriaLabel: undefined,
            };
        }

        return {
            bodyWrapper: TextualBodyViewBodyWrapperKind.NONE,
            bodyLinkHref: undefined,
            bodyActionAriaLabel: undefined,
        };
    }

    private static computeEditedMarkerSnapshot(props: TextualBodyViewModelProps): EditedMarkerSnapshot {
        if (!props.replacingEventId) {
            return {
                showEditedMarker: false,
                editedMarkerText: undefined,
                editedMarkerTooltip: undefined,
                editedMarkerCaption: undefined,
            };
        }

        const date = props.mxEvent.replacingEventDate();
        const dateString = date && formatDate(date);

        return {
            showEditedMarker: true,
            editedMarkerText: `(${_t("common|edited")})`,
            editedMarkerTooltip: _t("timeline|edits|tooltip_title", { date: dateString }),
            editedMarkerCaption: _t("timeline|edits|tooltip_sub"),
        };
    }

    private static computePendingModerationSnapshot(props: TextualBodyViewModelProps): PendingModerationSnapshot {
        if (!props.isSeeingThroughMessageHiddenForModeration) {
            return {
                showPendingModerationMarker: false,
                pendingModerationText: undefined,
            };
        }

        const visibility = props.mxEvent.messageVisibility();
        switch (visibility.visible) {
            case true:
                throw new Error(
                    "TextualBodyViewModel pending moderation marker should only be applied to hidden messages",
                );
            case false: {
                const text = visibility.reason
                    ? _t("timeline|pending_moderation_reason", { reason: visibility.reason })
                    : _t("timeline|pending_moderation");

                return {
                    showPendingModerationMarker: true,
                    pendingModerationText: `(${text})`,
                };
            }
        }
    }

    private static computeEventDependentSnapshot(props: TextualBodyViewModelProps): EventDependentSnapshot {
        return {
            kind: TextualBodyViewModel.computeKind(props.mxEvent),
            emoteSenderName: props.mxEvent.sender?.name ?? props.mxEvent.getSender() ?? undefined,
            ...TextualBodyViewModel.computeBodyWrapperSnapshot(props),
            ...TextualBodyViewModel.computeEditedMarkerSnapshot(props),
            ...TextualBodyViewModel.computePendingModerationSnapshot(props),
        };
    }

    private static computeSnapshot(props: TextualBodyViewModelProps): TextualBodyViewSnapshot {
        return {
            id: props.id,
            ...TextualBodyViewModel.computeEventDependentSnapshot(props),
        };
    }

    public constructor(props: TextualBodyViewModelProps) {
        super(props, TextualBodyViewModel.computeSnapshot(props));
    }

    public setId(id?: string): void {
        if (this.props.id === id) return;
        this.props = { ...this.props, id };
        this.snapshot.merge({ id });
    }

    public setEvent(mxEvent: MatrixEvent): void {
        if (this.props.mxEvent === mxEvent) return;
        this.props = { ...this.props, mxEvent };
        const nextSnapshot = TextualBodyViewModel.computeEventDependentSnapshot(this.props);
        const updates: Partial<TextualBodyViewSnapshot> = {};

        for (const [key, value] of Object.entries(nextSnapshot)) {
            const snapshotKey = key as keyof TextualBodyViewSnapshot;
            if (this.snapshot.current[snapshotKey] !== value) {
                updates[snapshotKey] = value as TextualBodyViewSnapshot[keyof TextualBodyViewSnapshot];
            }
        }

        if (Object.keys(updates).length > 0) {
            this.snapshot.merge(updates);
        }
    }

    public setHighlightLink(highlightLink?: string): void {
        if (this.props.highlightLink === highlightLink) return;
        this.props = { ...this.props, highlightLink };
        const nextSnapshot = TextualBodyViewModel.computeBodyWrapperSnapshot(this.props);
        const updates: Partial<TextualBodyViewSnapshot> = {};

        if (this.snapshot.current.bodyWrapper !== nextSnapshot.bodyWrapper) {
            updates.bodyWrapper = nextSnapshot.bodyWrapper;
        }
        if (this.snapshot.current.bodyLinkHref !== nextSnapshot.bodyLinkHref) {
            updates.bodyLinkHref = nextSnapshot.bodyLinkHref;
        }
        if (this.snapshot.current.bodyActionAriaLabel !== nextSnapshot.bodyActionAriaLabel) {
            updates.bodyActionAriaLabel = nextSnapshot.bodyActionAriaLabel;
        }

        if (Object.keys(updates).length > 0) {
            this.snapshot.merge(updates);
        }
    }

    public setReplacingEventId(replacingEventId?: string): void {
        if (this.props.replacingEventId === replacingEventId) return;
        this.props = { ...this.props, replacingEventId };
        const nextSnapshot = TextualBodyViewModel.computeEditedMarkerSnapshot(this.props);
        const updates: Partial<TextualBodyViewSnapshot> = {};

        if (this.snapshot.current.showEditedMarker !== nextSnapshot.showEditedMarker) {
            updates.showEditedMarker = nextSnapshot.showEditedMarker;
        }
        if (this.snapshot.current.editedMarkerText !== nextSnapshot.editedMarkerText) {
            updates.editedMarkerText = nextSnapshot.editedMarkerText;
        }
        if (this.snapshot.current.editedMarkerTooltip !== nextSnapshot.editedMarkerTooltip) {
            updates.editedMarkerTooltip = nextSnapshot.editedMarkerTooltip;
        }
        if (this.snapshot.current.editedMarkerCaption !== nextSnapshot.editedMarkerCaption) {
            updates.editedMarkerCaption = nextSnapshot.editedMarkerCaption;
        }

        if (Object.keys(updates).length > 0) {
            this.snapshot.merge(updates);
        }
    }

    public setIsSeeingThroughMessageHiddenForModeration(isSeeingThroughMessageHiddenForModeration?: boolean): void {
        if (this.props.isSeeingThroughMessageHiddenForModeration === isSeeingThroughMessageHiddenForModeration) return;
        this.props = {
            ...this.props,
            isSeeingThroughMessageHiddenForModeration,
        };
        const nextSnapshot = TextualBodyViewModel.computePendingModerationSnapshot(this.props);
        const updates: Partial<TextualBodyViewSnapshot> = {};

        if (this.snapshot.current.showPendingModerationMarker !== nextSnapshot.showPendingModerationMarker) {
            updates.showPendingModerationMarker = nextSnapshot.showPendingModerationMarker;
        }
        if (this.snapshot.current.pendingModerationText !== nextSnapshot.pendingModerationText) {
            updates.pendingModerationText = nextSnapshot.pendingModerationText;
        }

        if (Object.keys(updates).length > 0) {
            this.snapshot.merge(updates);
        }
    }

    public setHandlers({
        onRootClick,
        onBodyActionClick,
        onEditedMarkerClick,
        onEmoteSenderClick,
    }: Pick<
        TextualBodyViewModelProps,
        "onRootClick" | "onBodyActionClick" | "onEditedMarkerClick" | "onEmoteSenderClick"
    >): void {
        if (
            this.props.onRootClick === onRootClick &&
            this.props.onBodyActionClick === onBodyActionClick &&
            this.props.onEditedMarkerClick === onEditedMarkerClick &&
            this.props.onEmoteSenderClick === onEmoteSenderClick
        ) {
            return;
        }

        this.props = {
            ...this.props,
            onRootClick,
            onBodyActionClick,
            onEditedMarkerClick,
            onEmoteSenderClick,
        };
    }

    public readonly onRootClick = (event: MouseEvent<HTMLDivElement>): void => {
        this.props.onRootClick?.(event);
    };

    public readonly onBodyActionClick = (event: MouseEvent<HTMLDivElement>): void => {
        this.props.onBodyActionClick?.(event);
    };

    public readonly onEditedMarkerClick = (event: MouseEvent<HTMLButtonElement>): void => {
        this.props.onEditedMarkerClick?.(event);
    };

    public readonly onEmoteSenderClick = (event: MouseEvent<HTMLButtonElement>): void => {
        this.props.onEmoteSenderClick?.(event);
    };
}
