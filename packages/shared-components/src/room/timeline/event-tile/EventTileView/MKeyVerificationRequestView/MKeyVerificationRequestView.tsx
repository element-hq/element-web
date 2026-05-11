/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import classNames from "classnames";
import React, { type JSX } from "react";
import { LockSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import { EventTileBubble } from "../EventTileBubble";
import styles from "./MKeyVerificationRequestView.module.css";

export interface MKeyVerificationRequestViewSnapshot {
    /**
     * Main title text for the verification request.
     */
    title: string;
    /**
     * Label for the other user involved in the request.
     */
    subtitle: string;
    /**
     * Optional timestamp element rendered in the EventTileBubble footer slot.
     */
    timestamp?: JSX.Element;
}

export type MKeyVerificationRequestViewModel = ViewModel<MKeyVerificationRequestViewSnapshot>;

export interface MKeyVerificationRequestViewProps {
    /**
     * ViewModel providing the current verification request snapshot.
     */
    vm: MKeyVerificationRequestViewModel;
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
 * Renders a timeline bubble describing a key verification request message.
 */
export function MKeyVerificationRequestView({
    vm,
    className,
    ref,
}: Readonly<MKeyVerificationRequestViewProps>): JSX.Element {
    const { title, subtitle, timestamp } = useViewModel(vm);

    return (
        <EventTileBubble
            icon={<LockSolidIcon />}
            className={classNames(styles.content, className)}
            title={title}
            subtitle={subtitle}
            ref={ref}
        >
            {timestamp}
        </EventTileBubble>
    );
}
