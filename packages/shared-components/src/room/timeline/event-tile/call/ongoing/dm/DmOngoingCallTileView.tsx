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
import { CallDirection, type CallType } from "../../common";
import { Flex } from "../../../../../../core/utils/Flex";
import commonStyles from "../common.module.css";
import { JoinButton } from "../components/JoinButton/JoinButton";
import { DurationView } from "../components/Duration/DurationView";
import { MemberAvatarView } from "../../../../../../core/MemberAvatar/MemberAvatarView";
import { type CommonOngoingCallTileViewSnapshot, type CommonOngoingCallTileViewAction } from "../common";
import { FacePileView } from "../../../../../../core/FacePile/FacePileView";
import { useI18n } from "../../../../../../core/i18n/i18nContext";

export interface DmOngoingCallTileViewSnapshot extends CommonOngoingCallTileViewSnapshot {
    callType: CallType;
}

export type DmOngoingCallTileViewModel = ViewModel<DmOngoingCallTileViewSnapshot> & CommonOngoingCallTileViewAction;

interface Props {
    vm: DmOngoingCallTileViewModel;
}

/**
 * View that renders the tile content for an ongoing call in a DM.
 */
export function DmOngoingCallTileView(props: Props): React.ReactNode {
    const snapshot = useViewModel(props.vm);
    const { callType, callDirection, isJoinable, isJoined, durationViewModel } = snapshot;
    let content: React.ReactNode;
    if (snapshot.callHasOtherParticipants) {
        content = <CallJoinedContent snapshot={snapshot} />;
    } else if (callDirection === CallDirection.Incoming) {
        content = <IncomingCallContent snapshot={snapshot} />;
    } else {
        content = <OutgoingCallContent snapshot={snapshot} />;
    }
    return (
        <TileContainer>
            <Flex align="center" gap="var(--cpd-space-3x)" className={commonStyles.content}>
                <CallIcon callType={callType} />
                <Flex gap="6px" align="center" className={commonStyles.content}>
                    {content}
                </Flex>
                <Flex align="center" gap="var(--cpd-space-3x)" wrap="wrap-reverse">
                    {durationViewModel && <DurationView classNames="duration" vm={durationViewModel} />}
                    {!isJoined && (
                        <JoinButton disabled={!isJoinable} callType={callType} join={(ev) => props.vm.join(ev)} />
                    )}
                </Flex>
            </Flex>
        </TileContainer>
    );
}

function IncomingCallContent({ snapshot }: { snapshot: DmOngoingCallTileViewSnapshot }): React.ReactNode {
    const { translate: _t } = useI18n();
    return (
        <>
            <MemberAvatarView classNames={commonStyles.avatar} vm={snapshot.memberAvatarViewModel} />
            <div className={commonStyles.title}>
                {_t("timeline|call_tile|ongoing|common|call_started_by", {
                    startedByDisplayName: snapshot.startedByDisplayName,
                })}
            </div>
        </>
    );
}

function OutgoingCallContent({ snapshot }: { snapshot: DmOngoingCallTileViewSnapshot }): React.ReactNode {
    const { translate: _t } = useI18n();
    return (
        <>
            <MemberAvatarView classNames={commonStyles.avatar} vm={snapshot.memberAvatarViewModel} />
            <div className={commonStyles.title}>{_t("timeline|call_tile|ongoing|dm|call_started")}</div>
        </>
    );
}

function CallJoinedContent({ snapshot }: { snapshot: DmOngoingCallTileViewSnapshot }): React.ReactNode {
    const { translate: _t } = useI18n();
    return (
        <>
            <FacePileView classNames={commonStyles.facepile} vm={snapshot.facePileViewModel} />
            <div className={commonStyles.title}>{_t("timeline|call_tile|ongoing|dm|title")}</div>
        </>
    );
}
