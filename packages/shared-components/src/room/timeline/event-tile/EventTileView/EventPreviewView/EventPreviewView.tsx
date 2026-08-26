/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ComponentPropsWithoutRef, type JSX, type ReactNode } from "react";
import classNames from "classnames";
import { Tooltip } from "@vector-im/compound-web";

import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import styles from "./EventPreviewView.module.css";

export interface EventPreviewViewSnapshot {
    /**
     * Controls whether the preview should render.
     */
    isVisible: boolean;
    /**
     * Rendered preview content.
     */
    previewContent?: ReactNode;
    /**
     * Optional styled tooltip text for the preview content.
     */
    previewTooltip?: string;
}

export type EventPreviewViewModel = ViewModel<EventPreviewViewSnapshot>;

type EventPreviewViewProps = Omit<ComponentPropsWithoutRef<"span">, "children" | "title"> & {
    /**
     * The view model for the event preview.
     */
    vm: EventPreviewViewModel;
};

/**
 * Renders a compact preview of an event.
 */
export function EventPreviewView({ vm, className, ...props }: Readonly<EventPreviewViewProps>): JSX.Element {
    const { isVisible, previewContent, previewTooltip } = useViewModel(vm);

    if (!isVisible || !previewContent) {
        return <></>;
    }

    const preview = (
        <span {...props} className={classNames("mx_EventPreview", styles.eventPreview, className)}>
            {previewContent}
        </span>
    );

    if (!previewTooltip) {
        return preview;
    }

    return <Tooltip description={previewTooltip}>{preview}</Tooltip>;
}
