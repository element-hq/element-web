/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { MsgType, type MatrixEvent, type RoomMember } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type SenderProfileViewActions,
    type SenderProfileViewModel as SenderProfileViewModelInterface,
    type SenderProfileViewSnapshot,
} from "@element-hq/web-shared-components";

import { _t } from "../../languageHandler";
import UserIdentifier from "../../customisations/UserIdentifier";
import { getUserNameColorClass } from "../../utils/FormattingUtils";

export interface SenderProfileViewModelProps {
    /**
     * Matrix event that is currently being rendered.
     */
    mxEvent: MatrixEvent;
    /**
     * Current sender member profile if available.
     */
    member?: RoomMember | null;
    /**
     * Optional click handler for the profile.
     */
    onClick?: SenderProfileViewActions["onClick"];
    /**
     * Whether to add a tooltip with disambiguated identity.
     */
    withTooltip?: boolean;
}

export class SenderProfileViewModel
    extends BaseViewModel<SenderProfileViewSnapshot, SenderProfileViewModelProps>
    implements SenderProfileViewModelInterface
{
    private static readonly computeSnapshot = (props: SenderProfileViewModelProps): SenderProfileViewSnapshot => {
        const { mxEvent, member, withTooltip } = props;

        const sender = mxEvent.getSender() ?? "";
        const displayName = member?.rawDisplayName || sender;
        const matrixId = member?.userId;
        const userIdentifier =
            matrixId &&
            (UserIdentifier.getDisplayUserIdentifier?.(matrixId, {
                withDisplayName: true,
                roomId: member?.roomId,
            }) ??
                matrixId);

        return {
            isVisible: mxEvent.getContent().msgtype !== MsgType.Emote,
            displayName,
            displayIdentifier: member?.disambiguate ? userIdentifier : undefined,
            title:
                withTooltip && userIdentifier
                    ? _t("timeline|disambiguated_profile", {
                          displayName,
                          matrixId: userIdentifier,
                      })
                    : undefined,
            colorClass: matrixId ? getUserNameColorClass(matrixId) : undefined,
            className: "mx_DisambiguatedProfile",
            emphasizeDisplayName: true,
        };
    };

    public constructor(props: SenderProfileViewModelProps) {
        super(props, SenderProfileViewModel.computeSnapshot(props));
    }

    public onClick(): void {
        this.props.onClick?.();
    }

    public setProps(newProps: Partial<SenderProfileViewModelProps>): void {
        this.props = { ...this.props, ...newProps };
        this.snapshot.set(SenderProfileViewModel.computeSnapshot(this.props));
    }
}
