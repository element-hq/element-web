/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { BaseViewModel, type FacePileViewSnapshot } from "@element-hq/web-shared-components";
import { type MatrixClient, type RoomMember } from "matrix-js-sdk/src/matrix";

import { MemberAvatarViewModel } from "./MemberAvatarViewModel";

interface Props {
    /**
     * The size of each avatar in the face-pile in pixels, eg: 20.
     */
    size: number;
    /**
     * List of room-members from which to render the face-pile..
     */
    members: RoomMember[];

    /**
     * MatrixClient object to access js-sdk.
     */
    cli: MatrixClient;
}

/**
 * View model for rendering face-piles.
 */
export class FacePileViewModel extends BaseViewModel<FacePileViewSnapshot, Props> {
    private viewModelMap: Set<MemberAvatarViewModel> = new Set();

    public constructor(props: Props) {
        super(props, { memberAvatarViewModels: [] });
        this.computeSnapshot();
    }

    private computeSnapshot(): void {
        for (const vm of this.viewModelMap.values()) {
            vm.dispose();
        }
        this.viewModelMap = new Set();
        const members = this.props.members.slice(0, 3);
        for (const member of members) {
            const vm = this.disposables.track(
                new MemberAvatarViewModel({ size: this.props.size, member, cli: this.props.cli }),
            );
            this.viewModelMap.add(vm);
        }
        this.snapshot.set({ memberAvatarViewModels: Array.from(this.viewModelMap.values()) });
    }

    /**
     * Update the room-members from which the face-pile is rendered.
     * @param newMembers The list of new room members
     */
    public updateMembers(newMembers: RoomMember[]): void {
        this.props.members = newMembers;
        this.computeSnapshot();
    }
}
