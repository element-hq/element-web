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

/** Props for the thread-list action bar view model. */
export interface ThreadListActionBarViewModelProps {
    /** Called when the view in room action is activated. */
    onViewInRoomClick?: (anchor: HTMLElement | null) => void;
    /** Called when the copy link action is activated. */
    onCopyLinkClick?: (anchor: HTMLElement | null) => void;
}

/** View model for the icon-only action bar shown in the thread list. */
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

    /** Updates the action handlers exposed by the view model. */
    public setProps(newProps: Partial<ThreadListActionBarViewModelProps>): void {
        this.props = {
            ...this.props,
            ...newProps,
        };
    }

    /** Forwards the view in room action using the triggering button as the anchor. */
    public onViewInRoomClick = (anchor: HTMLElement | null): void => {
        this.props.onViewInRoomClick?.(anchor);
    };

    /** Forwards the copy link action using the triggering button as the anchor. */
    public onCopyLinkClick = (anchor: HTMLElement | null): void => {
        this.props.onCopyLinkClick?.(anchor);
    };
}
