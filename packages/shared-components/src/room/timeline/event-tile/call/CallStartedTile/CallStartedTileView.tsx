/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { VideoCallSolidIcon, VoiceCallSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import classnames from "classnames";

import { useViewModel, type ViewModel } from "../../../../../core/viewmodel";
import { Flex } from "../../../../../core/utils/Flex";
import styles from "../common/CallTileView.module.css";
import { useI18n } from "../../../../../core/i18n/i18nContext";
import { type CallTileViewSnapshot, CallType } from "../common/types";

export type CallStartedTileViewModel = ViewModel<CallTileViewSnapshot>;

export interface CallStartedTileViewProps {
    vm: CallStartedTileViewModel;
    className?: string;
}

function getIconForCallType(type: CallType): React.ReactNode {
    switch (type) {
        case CallType.Video:
            return <VideoCallSolidIcon className={styles.icon} width={20} height={20} />;
        case CallType.Voice:
            return <VoiceCallSolidIcon className={styles.icon} width={20} height={20} />;
    }
}

/**
 * View for a timeline tile that indicates the start of an element call.
 */
export function CallStartedTileView({ vm, className }: CallStartedTileViewProps): React.ReactNode {
    const { translate: _t } = useI18n();
    const { type, timestamp } = useViewModel(vm);
    const classNames = classnames(className, styles.container);
    return (
        <Flex className={classNames} align="center" gap="var(--cpd-space-2x)">
            {getIconForCallType(type)}
            <div className={styles.title}>
                {type === CallType.Voice
                    ? _t("timeline|call_tile|voice_call_title")
                    : _t("timeline|call_tile|video_call_title")}
            </div>

            <div className={styles.time}>{timestamp}</div>
        </Flex>
    );
}
