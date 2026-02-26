/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MouseEvent, type MouseEventHandler, type ReactNode } from "react";
import {
    BaseViewModel,
    type ReactionsRowViewSnapshot,
    type ReactionsRowViewModel as ReactionsRowViewModelInterface,
} from "@element-hq/web-shared-components";

import { _t } from "../../languageHandler";

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
    /**
     * Reaction row children (typically reaction buttons).
     */
    children?: ReactNode;
}

interface InternalProps extends ReactionsRowViewModelProps {
    showAll: boolean;
}

export class ReactionsRowViewModel
    extends BaseViewModel<ReactionsRowViewSnapshot, InternalProps>
    implements ReactionsRowViewModelInterface
{
    private static readonly computeDerivedSnapshot = (props: InternalProps): Pick<
        ReactionsRowViewSnapshot,
        "isVisible" | "showAllButtonVisible" | "showAddReactionButton" | "addReactionButtonActive" | "children"
    > => ({
        isVisible: props.isActionable && props.reactionGroupCount > 0,
        showAllButtonVisible: props.reactionGroupCount > MAX_ITEMS_WHEN_LIMITED + 1 && !props.showAll,
        showAddReactionButton: props.canReact,
        addReactionButtonActive: !!props.addReactionButtonActive,
        children: props.children,
    });

    private static readonly computeSnapshot = (props: InternalProps): ReactionsRowViewSnapshot => ({
        ariaLabel: _t("common|reactions"),
        className: "mx_ReactionsRow",
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

    private updateSnapshotFromProps(): void {
        const current = this.snapshot.current;
        const next = ReactionsRowViewModel.computeDerivedSnapshot(this.props);
        const updates: Partial<ReactionsRowViewSnapshot> = {};

        if (current.isVisible !== next.isVisible) updates.isVisible = next.isVisible;
        if (current.showAllButtonVisible !== next.showAllButtonVisible) {
            updates.showAllButtonVisible = next.showAllButtonVisible;
        }
        if (current.showAddReactionButton !== next.showAddReactionButton) {
            updates.showAddReactionButton = next.showAddReactionButton;
        }
        if (current.addReactionButtonActive !== next.addReactionButtonActive) {
            updates.addReactionButtonActive = next.addReactionButtonActive;
        }
        if (current.children !== next.children) {
            updates.children = next.children;
        }

        if (Object.keys(updates).length > 0) {
            this.snapshot.merge(updates);
        }
    }

    public setActionable(isActionable: boolean): void {
        if (this.props.isActionable === isActionable) return;

        this.props = {
            ...this.props,
            isActionable,
        };
        this.updateSnapshotFromProps();
    }

    public setReactionGroupCount(reactionGroupCount: number): void {
        if (this.props.reactionGroupCount === reactionGroupCount) return;

        this.props = {
            ...this.props,
            reactionGroupCount,
        };
        this.updateSnapshotFromProps();
    }

    public setCanReact(canReact: boolean): void {
        if (this.props.canReact === canReact) return;

        this.props = {
            ...this.props,
            canReact,
        };
        this.updateSnapshotFromProps();
    }

    public setAddReactionButtonActive(addReactionButtonActive: boolean): void {
        if (!!this.props.addReactionButtonActive === addReactionButtonActive) return;

        this.props = {
            ...this.props,
            addReactionButtonActive,
        };
        this.updateSnapshotFromProps();
    }

    public setChildren(children?: ReactNode): void {
        if (this.props.children === children) return;

        this.props = {
            ...this.props,
            children,
        };
        this.updateSnapshotFromProps();
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
        if (this.props.showAll) return;

        this.props = {
            ...this.props,
            showAll: true,
        };
        this.updateSnapshotFromProps();
    };

    public onAddReactionClick = (event: MouseEvent<HTMLButtonElement>): void => {
        this.props.onAddReactionClick?.(event);
    };

    public onAddReactionContextMenu = (event: MouseEvent<HTMLButtonElement>): void => {
        this.props.onAddReactionContextMenu?.(event);
    };
}
