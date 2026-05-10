/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import {
    VideoCallDeclinedSolidIcon,
    VoiceCallDeclinedSolidIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import classnames from "classnames";

import { useViewModel, type ViewModel } from "../../../../../core/viewmodel";
import { Flex } from "../../../../../core/utils/Flex";
import styles from "../common/CallTileView.module.css";
import { useI18n } from "../../../../../core/i18n/i18nContext";
import { type CallTileViewSnapshot, CallType } from "../common/types";

export type CallDeclinedTileViewModel = ViewModel<CallTileViewSnapshot>;

export interface CallDeclinedTileViewProps {
    vm: CallDeclinedTileViewModel;
    className?: string;
}

function getIconForCallType(type: CallType): React.ReactNode {
    switch (type) {
        case CallType.Video:
            return <VideoCallDeclinedSolidIcon className={styles.icon} width={20} height={20} />;
        case CallType.Voice:
            return <VoiceCallDeclinedSolidIcon className={styles.icon} width={20} height={20} />;
    }
}

/**
 * View for a timeline tile that indicates that a call was declined.
 */
export function CallDeclinedTileView({ vm, className }: CallDeclinedTileViewProps): React.ReactNode {
    const { translate: _t } = useI18n();
    const { type, timestamp, isCallDeclinedByUs } = useViewModel(vm);
    const classNames = classnames(className, styles.container);
    return (
        <Flex className={classNames} align="center" gap="var(--cpd-space-2x)">
            {getIconForCallType(type)}
            <div className={styles.title}>
                {isCallDeclinedByUs
                    ? _t("timeline|call_tile|declined|call_declined_by_us")
                    : _t("timeline|call_tile|declined|call_declined")}
            </div>
            <div className={styles.time}>{timestamp}</div>
        </Flex>
    );
}
