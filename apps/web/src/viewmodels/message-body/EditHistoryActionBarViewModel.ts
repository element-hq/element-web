/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    ActionBarAction,
    BaseViewModel,
    type ActionBarViewActions,
    type ActionBarViewSnapshot,
} from "@element-hq/web-shared-components";

/** Props for the edit-history action bar view model. */
export interface EditHistoryActionBarViewModelProps {
    /** Whether to include the remove action. */
    canRemove: boolean;
    /** Whether to include the view source action. */
    showViewSource: boolean;
    /** Called when the remove action is activated. */
    onRemoveClick?: (anchor: HTMLElement | null) => void;
    /** Called when the view source action is activated. */
    onViewSourceClick?: (anchor: HTMLElement | null) => void;
}

/** View model for the label-style action bar shown in the edit-history panel. */
export class EditHistoryActionBarViewModel
    extends BaseViewModel<ActionBarViewSnapshot, EditHistoryActionBarViewModelProps>
    implements ActionBarViewActions
{
    public constructor(props: EditHistoryActionBarViewModelProps) {
        super(props, EditHistoryActionBarViewModel.buildSnapshot(props));
    }

    private static buildSnapshot(props: EditHistoryActionBarViewModelProps): ActionBarViewSnapshot {
        const actions: ActionBarAction[] = [];

        if (props.canRemove) {
            actions.push(ActionBarAction.Remove);
        }
        if (props.showViewSource) {
            actions.push(ActionBarAction.ViewSource);
        }

        return {
            actions,
            presentation: "label",
            isDownloadEncrypted: false,
            isDownloadLoading: false,
            isPinned: false,
            isQuoteExpanded: false,
            isThreadReplyAllowed: true,
        };
    }

    /** Updates props and rebuilds the derived action-bar snapshot. */
    public setProps(newProps: Partial<EditHistoryActionBarViewModelProps>): void {
        this.props = {
            ...this.props,
            ...newProps,
        };
        this.snapshot.merge(EditHistoryActionBarViewModel.buildSnapshot(this.props));
    }

    /** Forwards the remove action using the triggering button as the anchor. */
    public onRemoveClick = (anchor: HTMLElement | null): void => {
        this.props.onRemoveClick?.(anchor);
    };

    /** Forwards the view source action using the triggering button as the anchor. */
    public onViewSourceClick = (anchor: HTMLElement | null): void => {
        this.props.onViewSourceClick?.(anchor);
    };
}
