/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import styles from "./RoomListView.module.css";

/**
 * Loading skeleton component for the room list.
 * Displays a repeating skeleton pattern while rooms are being fetched.
 */
export const RoomListLoadingSkeleton: React.FC = (): JSX.Element => {
    return <div className={styles.skeleton} />;
};
