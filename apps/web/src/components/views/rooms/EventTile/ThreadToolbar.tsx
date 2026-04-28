/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useMemo, useRef, type JSX } from "react";
import { ActionBarView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { ThreadListActionBarViewModel } from "../../../../viewmodels/room/ThreadListActionBarViewModel";
import type { ThreadListActionBarViewModelProps } from "../../../../viewmodels/room/ThreadListActionBarViewModel";

type ThreadToolbarProps = {
    onViewInRoomClick: (anchor: HTMLElement | null) => void;
    onCopyLinkClick: (anchor: HTMLElement | null) => void | Promise<void>;
};

function buildThreadToolbarViewModelProps({
    onViewInRoomClick,
    onCopyLinkClick,
}: ThreadToolbarProps): ThreadListActionBarViewModelProps {
    return {
        onViewInRoomClick,
        onCopyLinkClick,
    };
}

export function ThreadToolbar({ onViewInRoomClick, onCopyLinkClick }: Readonly<ThreadToolbarProps>): JSX.Element {
    const threadToolbarViewModelProps = useMemo(
        () => buildThreadToolbarViewModelProps({ onViewInRoomClick, onCopyLinkClick }),
        [onViewInRoomClick, onCopyLinkClick],
    );
    const vm = useCreateAutoDisposedViewModel(() => new ThreadListActionBarViewModel(threadToolbarViewModelProps));
    const renderedViewModelPropsRef = useRef(threadToolbarViewModelProps);

    if (renderedViewModelPropsRef.current !== threadToolbarViewModelProps) {
        renderedViewModelPropsRef.current = threadToolbarViewModelProps;
        vm.setProps(threadToolbarViewModelProps);
    }

    return <ActionBarView vm={vm} className="mx_ThreadActionBar" />;
}
