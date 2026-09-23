/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { VideoCallSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import { EventTileBubble } from "../EventTileBubble";

export interface MJitsiWidgetEventViewSnapshot {
    /**
     * Whether the event has enough context to render.
     */
    isVisible: boolean;
    /**
     * Main title text for the Jitsi widget event.
     */
    title: string;
    /**
     * Optional join prompt shown below the title.
     */
    subtitle: string | null;
    /**
     * Optional timestamp element rendered in the EventTileBubble footer slot.
     */
    timestamp?: JSX.Element;
}

export type MJitsiWidgetEventViewModel = ViewModel<MJitsiWidgetEventViewSnapshot>;

export interface MJitsiWidgetEventViewProps {
    /**
     * ViewModel providing the current Jitsi widget event snapshot.
     */
    vm: MJitsiWidgetEventViewModel;
    /**
     * Optional CSS classes passed through to EventTileBubble.
     */
    className?: string;
    /**
     * Optional Ref forwarded to the root DOM element.
     */
    ref?: React.RefObject<HTMLDivElement>;
}

/**
 * Renders a timeline bubble describing a Jitsi widget state event.
 */
export function MJitsiWidgetEventView({
    vm,
    className,
    ref,
}: Readonly<MJitsiWidgetEventViewProps>): JSX.Element | null {
    const { isVisible, title, subtitle, timestamp } = useViewModel(vm);

    if (!isVisible) return null;

    return (
        <EventTileBubble
            icon={<VideoCallSolidIcon color="var(--cpd-color-icon-primary)" />}
            className={className}
            title={title}
            subtitle={subtitle || undefined}
            ref={ref}
        >
            {timestamp}
        </EventTileBubble>
    );
}
