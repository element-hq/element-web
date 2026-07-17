/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { VideoCallDeclinedSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import classnames from "classnames";

import { useViewModel, type ViewModel } from "../../../../../../core/viewmodel";
import { Flex } from "../../../../../../core/utils/Flex";
import styles from "../common.module.css";
import { useI18n } from "../../../../../../core/i18n/i18nContext";

export type RoomTombstoneCallTileViewSnapshot = {
    /**
     * Time when this call was started.
     */
    timestamp: string;
};

export type RoomTombstoneCallTileViewModel = ViewModel<RoomTombstoneCallTileViewSnapshot>;

export interface CallStartedTileViewProps {
    vm: RoomTombstoneCallTileViewModel;

    /**
     * Additional class names for this component.
     */
    className?: string;
}

/**
 * Renders the tombstone content for a call in a room.
 */
export function RoomTombstoneCallTileView({ vm, className }: CallStartedTileViewProps): React.ReactNode {
    const { translate: _t } = useI18n();
    const { timestamp } = useViewModel(vm);
    const classNames = classnames(className, styles.container);
    return (
        <Flex className={classNames} align="center" gap="var(--cpd-space-2x)">
            <VideoCallDeclinedSolidIcon className={styles.icon} width={20} height={20} />
            <div className={styles.title}>{_t("timeline|call_tile|tombstone|room|title")}</div>
            <div className={styles.time}>{timestamp}</div>
        </Flex>
    );
}
