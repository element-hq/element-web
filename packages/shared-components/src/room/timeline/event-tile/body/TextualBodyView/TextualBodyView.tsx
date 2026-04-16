/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, {
    cloneElement,
    isValidElement,
    type JSX,
    type MouseEventHandler,
    type ReactElement,
    type ReactNode,
    type Ref,
} from "react";
import classNames from "classnames";
import { Tooltip } from "@vector-im/compound-web";

import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import styles from "./TextualBody.module.css";

export const enum TextualBodyViewKind {
    TEXT = "TEXT",
    NOTICE = "NOTICE",
    EMOTE = "EMOTE",
    CAPTION = "CAPTION",
}

export const enum TextualBodyViewBodyWrapperKind {
    NONE = "NONE",
    LINK = "LINK",
    ACTION = "ACTION",
}

export interface TextualBodyViewSnapshot {
    /**
     * Optional id passed to the root message-body element.
     */
    id?: string;
    /**
     * Controls the layout and styling branch for the body.
     */
    kind: TextualBodyViewKind;
    /**
     * Optional outer wrapper applied around the rendered body content.
     */
    bodyWrapper?: TextualBodyViewBodyWrapperKind;
    /**
     * Href used when `bodyWrapper` is `LINK`.
     */
    bodyLinkHref?: string;
    /**
     * Accessible label used when `bodyWrapper` is `ACTION`.
     */
    bodyActionAriaLabel?: string;
    /**
     * Whether to render the edited marker.
     */
    showEditedMarker?: boolean;
    /**
     * Visible label for the edited marker.
     */
    editedMarkerText?: string;
    /**
     * Tooltip description for the edited marker.
     */
    editedMarkerTooltip?: string;
    /**
     * Optional tooltip caption for the edited marker.
     */
    editedMarkerCaption?: string;
    /**
     * Whether to render the pending-moderation marker.
     */
    showPendingModerationMarker?: boolean;
    /**
     * Visible label for the pending-moderation marker.
     */
    pendingModerationText?: string;
    /**
     * Sender label rendered for emote events.
     */
    emoteSenderName?: string;
}

export interface TextualBodyViewActions {
    /**
     * Capture-phase click handler attached to the root message-body container.
     */
    onRootClick?: MouseEventHandler<HTMLDivElement>;
    /**
     * Activation handler used when `bodyWrapper` is `ACTION`.
     */
    onBodyActionClick?: MouseEventHandler<HTMLElement>;
    /**
     * Click handler for the edited marker.
     */
    onEditedMarkerClick?: MouseEventHandler<HTMLButtonElement>;
    /**
     * Click handler for the emote sender.
     */
    onEmoteSenderClick?: MouseEventHandler<HTMLButtonElement>;
}

export type TextualBodyViewModel = ViewModel<TextualBodyViewSnapshot, TextualBodyViewActions>;

export type TextualBodyContentElement = HTMLDivElement | HTMLSpanElement;
export type TextualBodyContentRef = Ref<TextualBodyContentElement>;

interface TextualBodyViewProps {
    /**
     * The view model providing the layout state and event handlers.
     */
    vm: TextualBodyViewModel;
    /**
     * The message body element, typically `EventContentBodyView`.
     */
    body: ReactElement;
    /**
     * Optional ref to attach to the message body element.
     */
    bodyRef?: TextualBodyContentRef;
    /**
     * Optional URL preview subtree rendered after the body.
     */
    urlPreviews?: ReactNode;
    /**
     * Optional host-level class names.
     */
    className?: string;
}

/**
 * Re-clones the supplied body element so consumers can observe the rendered
 * body node via `bodyRef` without constraining the `body` prop shape.
 */
function attachBodyRef(body: ReactElement, bodyRef?: TextualBodyContentRef): ReactElement {
    if (!bodyRef || !isValidElement(body)) {
        return body;
    }

    return cloneElement(body as ReactElement<{ ref?: TextualBodyContentRef }>, { ref: bodyRef });
}

/**
 * Renders a textual message body for timeline events.
 *
 * The view supports text, notice, emote, and caption layouts, optional
 * link or action wrappers, edited and moderation markers, and appended
 * URL previews.
 */
export function TextualBodyView({
    vm,
    body,
    bodyRef,
    urlPreviews,
    className,
}: Readonly<TextualBodyViewProps>): JSX.Element {
    const {
        id,
        kind,
        bodyWrapper = TextualBodyViewBodyWrapperKind.NONE,
        bodyLinkHref,
        bodyActionAriaLabel,
        showEditedMarker,
        editedMarkerText,
        editedMarkerTooltip,
        editedMarkerCaption,
        showPendingModerationMarker,
        pendingModerationText,
        emoteSenderName,
    } = useViewModel(vm);

    const rootClasses = classNames(className, styles.root, {
        [styles.text]: kind === TextualBodyViewKind.TEXT,
        [styles.notice]: kind === TextualBodyViewKind.NOTICE,
        [styles.emote]: kind === TextualBodyViewKind.EMOTE,
        [styles.caption]: kind === TextualBodyViewKind.CAPTION,
    });

    let renderedBody: ReactNode = attachBodyRef(body, bodyRef);
    const onEditedMarkerClick: MouseEventHandler<HTMLButtonElement> | undefined = vm.onEditedMarkerClick
        ? (event): void => {
              event.preventDefault();
              event.stopPropagation();
              vm.onEditedMarkerClick?.(event);
          }
        : undefined;

    const markers: ReactNode[] = [];
    if (showEditedMarker) {
        const editedMarkerButton = (
            <button
                type="button"
                className={classNames(styles.annotation, styles.editedMarker)}
                onClick={onEditedMarkerClick}
                data-textual-body-edited-marker=""
            >
                <span>{editedMarkerText}</span>
            </button>
        );

        markers.push(
            editedMarkerTooltip ? (
                <Tooltip
                    key="edited-marker"
                    description={editedMarkerTooltip}
                    caption={editedMarkerCaption}
                    isTriggerInteractive={true}
                >
                    {editedMarkerButton}
                </Tooltip>
            ) : (
                React.cloneElement(editedMarkerButton, { key: "edited-marker" })
            ),
        );
    }

    if (showPendingModerationMarker) {
        markers.push(
            <span key="pending-moderation-marker" className={styles.annotation} data-textual-body-pending-moderation="">
                {pendingModerationText}
            </span>,
        );
    }

    if (bodyWrapper === TextualBodyViewBodyWrapperKind.LINK && bodyLinkHref) {
        renderedBody = (
            <a href={bodyLinkHref} className={styles.bodyLink}>
                {renderedBody}
            </a>
        );
    } else if (bodyWrapper === TextualBodyViewBodyWrapperKind.ACTION) {
        renderedBody = (
            <button
                type="button"
                aria-label={bodyActionAriaLabel}
                className={styles.bodyAction}
                onClick={vm.onBodyActionClick}
            >
                {renderedBody}
            </button>
        );
    }

    if (markers.length > 0) {
        const annotatedClasses = classNames(styles.annotated, {
            [styles.annotatedInline]: kind === TextualBodyViewKind.EMOTE,
        });

        renderedBody =
            kind === TextualBodyViewKind.EMOTE ? (
                <span dir="auto" className={annotatedClasses}>
                    {renderedBody}
                    {markers}
                </span>
            ) : (
                <div dir="auto" className={annotatedClasses}>
                    {renderedBody}
                    {markers}
                </div>
            );
    }

    if (kind === TextualBodyViewKind.EMOTE) {
        return (
            <div id={id} className={rootClasses} onClickCapture={vm.onRootClick} dir="auto">
                *&nbsp;
                <button type="button" className={styles.emoteSender} onClick={vm.onEmoteSenderClick}>
                    {emoteSenderName}
                </button>
                &nbsp;
                {renderedBody}
                {urlPreviews}
            </div>
        );
    }

    return (
        <div id={id} className={rootClasses} onClickCapture={vm.onRootClick}>
            {renderedBody}
            {urlPreviews}
        </div>
    );
}
