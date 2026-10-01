/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { AvatarStack } from "@vector-im/compound-web";

import { type MemberAvatarViewModel, MemberAvatarView } from "../MemberAvatar/MemberAvatarView";
import { useViewModel, type ViewModel } from "../viewmodel";

export interface FacePileViewSnapshot {
    /**
     * The sub vms for the member avatars.
     */
    memberAvatarViewModels: MemberAvatarViewModel[];
}

export type FacePileViewModel = ViewModel<FacePileViewSnapshot>;

export interface FacePileViewProps {
    vm: FacePileViewModel;

    /**
     * Additional class names for this component.
     */
    classNames?: string;
}

/**
 * View that renders a face pile view.
 */
export function FacePileView(props: FacePileViewProps): React.ReactNode {
    const { memberAvatarViewModels } = useViewModel(props.vm);
    if (memberAvatarViewModels.length === 0) return null;
    return (
        <AvatarStack className={props.classNames}>
            {memberAvatarViewModels.map((vm) => (
                <MemberAvatarView vm={vm} key={vm.getSnapshot().id} />
            ))}
        </AvatarStack>
    );
}
