/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import {
    VideoCallSolidIcon,
    VideoCallDeclinedSolidIcon,
    VideoCallMissedSolidIcon,
    VideoCallOutgoingSolidIcon,
    VoiceCallDeclinedSolidIcon,
    VoiceCallMissedSolidIcon,
    VoiceCallOutgoingSolidIcon,
    VoiceCallSolidIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import classnames from "classnames";

import { useViewModel, type ViewModel } from "../../../../../../core/viewmodel";
import { Flex } from "../../../../../../core/utils/Flex";
import styles from "../common.module.css";
import { useI18n } from "../../../../../../core/i18n/i18nContext";
import { CallDirection, CallType } from "../../common";
import { type RoomTombstoneCallTileViewSnapshot } from "../room/RoomTombstoneCallTileView";

export interface DmTombstoneCallTileViewSnapshot extends RoomTombstoneCallTileViewSnapshot {
    /**
     * What type of call this tile needs to render for.
     */
    type: CallType;

    /**
     * Whether this is an incoming or outgoing call.
     */
    callDirection: CallDirection;

    /**
     * Whether this call was declined.
     */
    isCallDeclined: boolean;

    /**
     * Whether we picked up: the local user joined the call. An incoming call
     * that was neither answered nor declined was missed.
     */
    answered: boolean;
    /**
     * Why the call never connected, when the callee side reported it
     * (MSC4075 invite progress), e.g. "unreachable (SIP 404)".
     */
    failureReason?: string | null;
}

export type DmTombstoneCallTileViewModel = ViewModel<DmTombstoneCallTileViewSnapshot>;

export interface DmTombstoneCallTileViewProps {
    vm: DmTombstoneCallTileViewModel;

    /**
     * Additional class names for this component.
     */
    className?: string;
}

type IconVariant = "normal" | "declined" | "missed" | "outgoing";

const icons: Record<CallType, Record<IconVariant, React.ComponentType<React.SVGAttributes<SVGElement>>>> = {
    [CallType.Video]: {
        normal: VideoCallSolidIcon,
        declined: VideoCallDeclinedSolidIcon,
        missed: VideoCallMissedSolidIcon,
        outgoing: VideoCallOutgoingSolidIcon,
    },
    [CallType.Voice]: {
        normal: VoiceCallSolidIcon,
        declined: VoiceCallDeclinedSolidIcon,
        missed: VoiceCallMissedSolidIcon,
        outgoing: VoiceCallOutgoingSolidIcon,
    },
};

function getIconVariant(snapshot: DmTombstoneCallTileViewSnapshot): IconVariant {
    const { callDirection, isCallDeclined, failureReason, answered } = snapshot;
    if (isCallDeclined || failureReason) return "declined";
    if (callDirection === CallDirection.Outgoing) return "outgoing";
    return answered ? "normal" : "missed";
}

/**
 * Renders the tombstone content for a tile in a DM.
 */
export function DmTombstoneCallTileView({ vm, className }: DmTombstoneCallTileViewProps): React.ReactNode {
    const snapshot = useViewModel(vm);
    const { type, timestamp, isCallDeclined, failureReason } = snapshot;
    const classNames = classnames(className, styles.container);
    const Icon = icons[type][getIconVariant(snapshot)];
    return (
        <Flex className={classNames} align="center" gap="var(--cpd-space-2x)">
            <Icon className={styles.icon} width={20} height={20} />
            <div className={styles.title}>
                {isCallDeclined ? (
                    <DeclinedContent snapshot={snapshot} />
                ) : failureReason ? (
                    <FailedContent reason={failureReason} />
                ) : (
                    <NormalContent snapshot={snapshot} />
                )}
            </div>

            <div className={styles.time}>{timestamp}</div>
        </Flex>
    );
}

function NormalContent(props: { snapshot: DmTombstoneCallTileViewSnapshot }): React.ReactNode {
    const { type, callDirection, answered } = props.snapshot;
    const { translate: _t } = useI18n();
    const voice = type === CallType.Voice;
    if (callDirection === CallDirection.Outgoing)
        return voice ? _t("timeline|call_tile|outgoing|voice") : _t("timeline|call_tile|outgoing|video");
    if (answered) return voice ? _t("timeline|call_tile|incoming|voice") : _t("timeline|call_tile|incoming|video");
    return voice ? _t("timeline|call_tile|missed|voice") : _t("timeline|call_tile|missed|video");
}

function FailedContent(props: { reason: string }): React.ReactNode {
    const { translate: _t } = useI18n();
    return _t("timeline|call_tile|call_failed", { reason: props.reason });
}

function DeclinedContent(props: { snapshot: DmTombstoneCallTileViewSnapshot }): React.ReactNode {
    const { callDirection } = props.snapshot;
    const { translate: _t } = useI18n();
    return callDirection === CallDirection.Incoming
        ? _t("timeline|call_tile|declined|call_declined_by_us")
        : _t("timeline|call_tile|declined|call_declined");
}
