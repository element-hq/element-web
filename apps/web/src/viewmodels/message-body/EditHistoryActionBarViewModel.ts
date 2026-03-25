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

export interface EditHistoryActionBarViewModelProps {
    canRemove: boolean;
    showViewSource: boolean;
    onRemoveClick?: (anchor: HTMLElement | null) => void;
    onViewSourceClick?: (anchor: HTMLElement | null) => void;
}

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

    public setProps(newProps: Partial<EditHistoryActionBarViewModelProps>): void {
        this.props = {
            ...this.props,
            ...newProps,
        };
        this.snapshot.set(EditHistoryActionBarViewModel.buildSnapshot(this.props));
    }

    public onRemoveClick = (anchor: HTMLElement | null): void => {
        this.props.onRemoveClick?.(anchor);
    };

    public onViewSourceClick = (anchor: HTMLElement | null): void => {
        this.props.onViewSourceClick?.(anchor);
    };
}
