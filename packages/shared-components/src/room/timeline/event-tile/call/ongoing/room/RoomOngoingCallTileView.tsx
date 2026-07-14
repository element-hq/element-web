/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import { useViewModel, type ViewModel } from "../../../../../../core/viewmodel";
import { TileContainer } from "../components/TileContainer/TileContainer";
import { CallIcon } from "../components/CallIcon/CallIcon";
import { CallType } from "../../common";
import { Flex } from "../../../../../../core/utils/Flex";
import commonStyles from "../common.module.css";
import styles from "./RoomOngoingCallTileView.module.css";
import { JoinButton } from "../components/JoinButton/JoinButton";
import { DurationView } from "../components/Duration/DurationView";
import { MemberAvatarView } from "../../../../../../core/MemberAvatar/MemberAvatarView";
import { FacePileView } from "../../../../../../core/FacePile/FacePileView";
import type { CommonOngoingCallTileViewAction, CommonOngoingCallTileViewSnapshot } from "../common";
import { useI18n } from "../../../../../../core/i18n/i18nContext";

export interface RoomOngoingCallTileViewSnapshot extends CommonOngoingCallTileViewSnapshot {
    /**
     * The total number of participants in this call.
     */
    totalParticipants: number;

    /**
     * Whether the user ignored this call.
     */
    isCallIgnored?: boolean;
}

export type RoomCallStartedTileViewModel = ViewModel<RoomOngoingCallTileViewSnapshot> & CommonOngoingCallTileViewAction;

interface Props {
    vm: RoomCallStartedTileViewModel;
}

/**
 * View that renders the tile content for an ongoing call in a room.
 */
export function RoomOngoingCallTileView(props: Props): React.ReactNode {
    const snapshot = useViewModel(props.vm);
    const { isJoinable, isJoined, isCallIgnored, callHasOtherParticipants, durationViewModel } = snapshot;
    const { translate: _t } = useI18n();
    return (
        <TileContainer>
            <Flex align="center" gap="var(--cpd-space-3x)" className={commonStyles.content}>
                <CallIcon callType={CallType.Video} />
                <Flex direction="column" className={commonStyles.content}>
                    <div className={commonStyles.title}>{_t("timeline|call_tile|ongoing|room|title")}</div>

                    {callHasOtherParticipants || isCallIgnored ? (
                        <CallJoinedOrIgnoredContent snapshot={snapshot} />
                    ) : (
                        <CallStartedContent snapshot={snapshot} />
                    )}
                </Flex>
                <Flex align="center" gap="var(--cpd-space-3x)" wrap="wrap-reverse">
                    {durationViewModel && <DurationView classNames="duration" vm={durationViewModel} />}
                    {!isJoined && (
                        <JoinButton
                            callType={CallType.Video}
                            disabled={!isJoinable}
                            join={(event) => {
                                props.vm.join(event);
                            }}
                        />
                    )}
                </Flex>
            </Flex>
        </TileContainer>
    );
}

/**
 * This is the content of the tile when the call has participants other than who started the call or
 * the call was ignored (by clicking decline button on the toast).
 */
function CallJoinedOrIgnoredContent({ snapshot }: { snapshot: RoomOngoingCallTileViewSnapshot }): React.ReactNode {
    const { facePileViewModel, totalParticipants } = snapshot;
    const { translate: _t } = useI18n();
    const joinedCount = totalParticipants;
    return (
        <Flex className={styles.subContainer} gap="6px" align="center">
            <FacePileView classNames={commonStyles.facepile} vm={facePileViewModel} />
            {_t("timeline|call_tile|ongoing|room|join_count", { joinedCount })}
        </Flex>
    );
}

/**
 * This is the content of the tile when the call has just started.
 */
function CallStartedContent({ snapshot }: { snapshot: RoomOngoingCallTileViewSnapshot }): React.ReactNode {
    const { memberAvatarViewModel, startedByDisplayName } = snapshot;
    const { translate: _t } = useI18n();
    return (
        <Flex className={styles.subContainer} gap="6px" align="center">
            <MemberAvatarView classNames={commonStyles.avatar} vm={memberAvatarViewModel} />
            <div className={styles.startedTextContainer}>
                {_t("timeline|call_tile|ongoing|common|call_started_by", { startedByDisplayName })}
            </div>
        </Flex>
    );
}
