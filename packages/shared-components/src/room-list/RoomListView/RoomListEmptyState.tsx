/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";

import styles from "./RoomListView.module.css";

/**
 * Props for RoomListEmptyState component
 */
export interface RoomListEmptyStateProps {
    /** The title to display in the empty state */
    title: string;
    /** The description text to display */
    description?: string;
    /** Optional action element (e.g., a button) to display */
    action?: ReactNode;
}

/**
 * Empty state component for the room list.
 * Displays a message when no rooms are available.
 */
export const RoomListEmptyState: React.FC<RoomListEmptyStateProps> = ({ title, description, action }): JSX.Element => {
    return (
        <div className={styles.emptyState}>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
            {action}
        </div>
    );
};
