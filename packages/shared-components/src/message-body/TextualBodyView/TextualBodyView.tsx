/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type MouseEventHandler, type ReactNode } from "react";
import classNames from "classnames";
import { Tooltip } from "@vector-im/compound-web";

import { type ViewModel, useViewModel } from "../../viewmodel";
import styles from "./TextualBodyView.module.css";

export type TextualBodyKind = "text" | "notice" | "caption" | "emote";

export interface TextualBodyViewSnapshot {
    /**
     * Optional id for the root message body element.
     */
    id?: string;
    /**
     * Visual variant of the message body.
     */
    kind: TextualBodyKind;
    /**
     * Main message body content.
     */
    body: ReactNode;
    /**
     * Optional message widgets (for example: URL previews).
     */
    widgets?: ReactNode;
    /**
     * Optional sender name for emote messages.
     */
    emoteSender?: string;
    /**
     * Optional accessible label for the emote sender button.
     */
    emoteSenderLabel?: string;
    /**
     * Edited marker text, for example `(edited)`.
     */
    editedMarkerText?: string;
    /**
     * Edited marker accessible label.
     */
    editedMarkerLabel?: string;
    /**
     * Edited marker tooltip description.
     */
    editedMarkerDescription?: string;
    /**
     * Edited marker tooltip caption.
     */
    editedMarkerCaption?: string;
    /**
     * Pending moderation marker text, wrapped in parentheses by the view.
     */
    pendingModerationText?: string;
}

export interface TextualBodyViewActions {
    /**
     * Invoked when the message body container is clicked.
     */
    onBodyClick?: MouseEventHandler<HTMLDivElement>;
    /**
     * Invoked when the edited marker is clicked.
     */
    onEditedMarkerClick?: MouseEventHandler<HTMLButtonElement>;
    /**
     * Invoked when the emote sender button is clicked.
     */
    onEmoteSenderClick?: MouseEventHandler<HTMLButtonElement>;
}

export type TextualBodyViewModel = ViewModel<TextualBodyViewSnapshot, TextualBodyViewActions>;

interface TextualBodyViewProps {
    vm: TextualBodyViewModel;
    className?: string;
}

function rootClassNameForKind(kind: TextualBodyKind): string {
    switch (kind) {
        case "text":
        case "caption":
            return classNames("mx_MTextBody", styles.textBody);
        case "notice":
            return classNames("mx_MNoticeBody", styles.noticeBody);
        case "emote":
            return classNames("mx_MEmoteBody", styles.emoteBody);
    }
}

function renderEditedMarker({
    editedMarkerText,
    editedMarkerLabel,
    editedMarkerDescription,
    editedMarkerCaption,
    onEditedMarkerClick,
}: {
    editedMarkerText: string;
    editedMarkerLabel?: string;
    editedMarkerDescription?: string;
    editedMarkerCaption?: string;
    onEditedMarkerClick?: MouseEventHandler<HTMLButtonElement>;
}): JSX.Element {
    const marker = (
        <span className={classNames("mx_EventTile_edited", styles.marker, styles.editedMarker)}>
            <button
                type="button"
                className={styles.editedMarkerButton}
                onClick={onEditedMarkerClick}
                aria-label={editedMarkerLabel ?? editedMarkerText}
            >
                {editedMarkerText}
            </button>
        </span>
    );

    if (!editedMarkerDescription && !editedMarkerCaption) {
        return marker;
    }

    return (
        <Tooltip
            description={editedMarkerDescription ?? editedMarkerLabel ?? editedMarkerText}
            caption={editedMarkerCaption}
        >
            {marker}
        </Tooltip>
    );
}

function rootClassName(kind: TextualBodyKind, className?: string): string {
    return classNames(
        rootClassNameForKind(kind),
        {
            mx_EventTile_content: kind !== "caption",
            mx_EventTile_caption: kind === "caption",
            [styles.rootContent]: true,
        },
        className,
    );
}

export function TextualBodyView({ vm, className }: Readonly<TextualBodyViewProps>): JSX.Element {
    const {
        id,
        kind,
        body,
        widgets,
        emoteSender,
        emoteSenderLabel,
        editedMarkerText,
        editedMarkerLabel,
        editedMarkerDescription,
        editedMarkerCaption,
        pendingModerationText,
    } = useViewModel(vm);

    let renderedBody = body;
    if (editedMarkerText || pendingModerationText) {
        renderedBody = (
            <div dir="auto" className={classNames("mx_EventTile_annotated", styles.annotated)}>
                {renderedBody}
                {editedMarkerText &&
                    renderEditedMarker({
                        editedMarkerText,
                        editedMarkerLabel,
                        editedMarkerDescription,
                        editedMarkerCaption,
                        onEditedMarkerClick: vm.onEditedMarkerClick,
                    })}
                {pendingModerationText && (
                    <span className={classNames("mx_EventTile_pendingModeration", styles.marker)}>
                        ({pendingModerationText})
                    </span>
                )}
            </div>
        );
    }

    if (kind === "emote") {
        return (
            <div id={id} className={rootClassName(kind, className)} onClickCapture={vm.onBodyClick} dir="auto">
                *&nbsp;
                {emoteSender && (
                    <button
                        type="button"
                        className={classNames("mx_MEmoteBody_sender", styles.emoteSenderButton)}
                        onClick={vm.onEmoteSenderClick}
                        aria-label={emoteSenderLabel ?? emoteSender}
                    >
                        {emoteSender}
                    </button>
                )}
                {emoteSender && <>&nbsp;</>}
                {renderedBody}
                {widgets}
            </div>
        );
    }

    return (
        <div id={id} className={rootClassName(kind, className)} onClickCapture={vm.onBodyClick}>
            {renderedBody}
            {widgets}
        </div>
    );
}
