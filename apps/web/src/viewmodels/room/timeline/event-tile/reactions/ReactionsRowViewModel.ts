/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MouseEvent, type MouseEventHandler } from "react";
import {
    BaseViewModel,
    type ReactionsRowViewSnapshot,
    type ReactionsRowViewModel as ReactionsRowViewModelInterface,
} from "@element-hq/web-shared-components";

import { _t } from "../../../../../languageHandler";

export const MAX_ITEMS_WHEN_LIMITED = 8;

export interface ReactionsRowViewModelProps {
    /**
     * Whether the current event is actionable for reactions.
     */
    isActionable: boolean;
    /**
     * Number of reaction keys with at least one event.
     */
    reactionGroupCount: number;
    /**
     * Whether the current user can add reactions.
     */
    canReact: boolean;
    /**
     * Whether the add-reaction context menu is currently open.
     */
    addReactionButtonActive?: boolean;
    /**
     * Optional callback invoked when the add-reaction button is clicked.
     */
    onAddReactionClick?: MouseEventHandler<HTMLButtonElement>;
    /**
     * Optional callback invoked on add-reaction button context-menu.
     */
    onAddReactionContextMenu?: MouseEventHandler<HTMLButtonElement>;
}

interface InternalProps extends ReactionsRowViewModelProps {
    showAll: boolean;
}

export class ReactionsRowViewModel
    extends BaseViewModel<ReactionsRowViewSnapshot, InternalProps>
    implements ReactionsRowViewModelInterface
{
    private static readonly computeDerivedSnapshot = (
        props: InternalProps,
    ): Pick<
        ReactionsRowViewSnapshot,
        "isVisible" | "showAllButtonVisible" | "showAddReactionButton" | "addReactionButtonActive"
    > => ({
        isVisible: props.isActionable && props.reactionGroupCount > 0,
        showAllButtonVisible: props.reactionGroupCount > MAX_ITEMS_WHEN_LIMITED + 1 && !props.showAll,
        showAddReactionButton: props.canReact,
        addReactionButtonActive: !!props.addReactionButtonActive,
    });

    private static readonly computeSnapshot = (props: InternalProps): ReactionsRowViewSnapshot => ({
        ariaLabel: _t("common|reactions"),
        showAllButtonLabel: _t("action|show_all"),
        addReactionButtonLabel: _t("timeline|reactions|add_reaction_prompt"),
        addReactionButtonVisible: false,
        ...ReactionsRowViewModel.computeDerivedSnapshot(props),
    });

    public constructor(props: ReactionsRowViewModelProps) {
        const internalProps: InternalProps = {
            ...props,
            showAll: false,
        };
        super(internalProps, ReactionsRowViewModel.computeSnapshot(internalProps));
    }

    public setActionable(isActionable: boolean): void {
        this.props = {
            ...this.props,
            isActionable,
        };

        const isVisible = this.props.isActionable && this.props.reactionGroupCount > 0;

        this.snapshot.merge({ isVisible });
    }

    public setReactionGroupCount(reactionGroupCount: number): void {
        this.props = {
            ...this.props,
            reactionGroupCount,
        };

        const nextIsVisible = this.props.isActionable && this.props.reactionGroupCount > 0;
        const nextShowAllButtonVisible =
            this.props.reactionGroupCount > MAX_ITEMS_WHEN_LIMITED + 1 && !this.props.showAll;
        this.snapshot.merge({
            isVisible: nextIsVisible,
            showAllButtonVisible: nextShowAllButtonVisible,
        });
    }

    public setCanReact(canReact: boolean): void {
        this.props = {
            ...this.props,
            canReact,
        };

        this.snapshot.merge({ showAddReactionButton: canReact });
    }

    public setAddReactionButtonActive(addReactionButtonActive: boolean): void {
        this.props = {
            ...this.props,
            addReactionButtonActive,
        };

        this.snapshot.merge({ addReactionButtonActive });
    }

    public setAddReactionHandlers({
        onAddReactionClick,
        onAddReactionContextMenu,
    }: Pick<ReactionsRowViewModelProps, "onAddReactionClick" | "onAddReactionContextMenu">): void {
        this.props = {
            ...this.props,
            onAddReactionClick,
            onAddReactionContextMenu,
        };
    }

    public onShowAllClick = (): void => {
        this.props = {
            ...this.props,
            showAll: true,
        };
        this.snapshot.merge({ showAllButtonVisible: false });
    };

    public onAddReactionClick = (event: MouseEvent<HTMLButtonElement>): void => {
        this.props.onAddReactionClick?.(event);
    };

    public onAddReactionContextMenu = (event: MouseEvent<HTMLButtonElement>): void => {
        this.props.onAddReactionContextMenu?.(event);
    };
}
