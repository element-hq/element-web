/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    type RoomListSectionHeaderActions,
    type RoomListSectionHeaderViewSnapshot,
} from "@element-hq/web-shared-components";

interface RoomListSectionHeaderViewModelProps {
    tag: string;
    title: string;
    onToggleExpanded: (isExpanded: boolean) => void;
}

export class RoomListSectionHeaderViewModel
    extends BaseViewModel<RoomListSectionHeaderViewSnapshot, RoomListSectionHeaderViewModelProps>
    implements RoomListSectionHeaderActions
{
    public constructor(props: RoomListSectionHeaderViewModelProps) {
        super(props, { id: props.tag, title: props.title, isExpanded: true });
    }

    public onClick = (): void => {
        const isExpanded = !this.snapshot.current.isExpanded;
        this.props.onToggleExpanded(isExpanded);
        this.snapshot.merge({ isExpanded });
    };
}
