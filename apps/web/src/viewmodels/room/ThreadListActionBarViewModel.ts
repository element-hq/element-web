/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    ActionBarAction,
    type ActionBarViewActions,
    type ActionBarViewSnapshot,
} from "@element-hq/web-shared-components";

export interface ThreadListActionBarViewModelProps {
    onViewInRoomClick?: (anchor: HTMLElement | null) => void;
    onCopyLinkClick?: (anchor: HTMLElement | null) => void;
}

export class ThreadListActionBarViewModel
    extends BaseViewModel<ActionBarViewSnapshot, ThreadListActionBarViewModelProps>
    implements ActionBarViewActions
{
    public constructor(props: ThreadListActionBarViewModelProps) {
        super(props, {
            actions: [ActionBarAction.ViewInRoom, ActionBarAction.CopyLink],
            presentation: "icon",
            isDownloadEncrypted: false,
            isDownloadLoading: false,
            isPinned: false,
            isQuoteExpanded: false,
            isThreadReplyAllowed: true,
        });
    }

    public setProps(newProps: Partial<ThreadListActionBarViewModelProps>): void {
        this.props = {
            ...this.props,
            ...newProps,
        };
    }

    public onViewInRoomClick = (anchor: HTMLElement | null): void => {
        this.props.onViewInRoomClick?.(anchor);
    };

    public onCopyLinkClick = (anchor: HTMLElement | null): void => {
        this.props.onCopyLinkClick?.(anchor);
    };
}
