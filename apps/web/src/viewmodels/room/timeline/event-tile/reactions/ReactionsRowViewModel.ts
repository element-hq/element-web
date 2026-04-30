/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MouseEvent } from "react";
import {
    BaseViewModel,
    type ReactionsRowViewSnapshot,
    type ReactionsRowViewModel as ReactionsRowViewModelInterface,
} from "@element-hq/web-shared-components";

import { _t } from "../../../../../languageHandler";

/** Maximum reaction buttons rendered before the show-all affordance appears. */
export const MAX_ITEMS_WHEN_LIMITED = 8;

/** Inputs used to derive the event-tile reactions row snapshot. */
export interface ReactionsRowViewModelProps {
    /** Whether the current event is actionable for reactions. */
    isActionable: boolean;
    /** Number of reaction keys with at least one event. */
    reactionGroupCount: number;
    /** Whether the current user can add reactions. */
    canReact: boolean;
}

/** Event-tile reactions row snapshot including locally rendered menu state. */
export interface ReactionsRowViewSnapshotWithMenu extends ReactionsRowViewSnapshot {
    /** Anchor rect for the add-reaction menu, when open. */
    addReactionMenuAnchorRect?: DOMRect;
    /** Whether the add-reaction menu is currently open. */
    isAddReactionMenuOpen: boolean;
}

interface InternalProps extends ReactionsRowViewModelProps {
    showAll: boolean;
}

/** View model for the reactions row shown in an event tile footer. */
export class ReactionsRowViewModel
    extends BaseViewModel<ReactionsRowViewSnapshotWithMenu, InternalProps>
    implements ReactionsRowViewModelInterface
{
    private static readonly computeDerivedSnapshot = (
        props: InternalProps,
    ): Pick<
        ReactionsRowViewSnapshotWithMenu,
        "isVisible" | "showAllButtonVisible" | "showAddReactionButton" | "addReactionButtonActive"
    > => ({
        isVisible: props.isActionable && props.reactionGroupCount > 0,
        showAllButtonVisible: props.reactionGroupCount > MAX_ITEMS_WHEN_LIMITED + 1 && !props.showAll,
        showAddReactionButton: props.canReact,
        addReactionButtonActive: false,
    });

    private static readonly computeSnapshot = (props: InternalProps): ReactionsRowViewSnapshotWithMenu => ({
        ariaLabel: _t("common|reactions"),
        showAllButtonLabel: _t("action|show_all"),
        addReactionButtonLabel: _t("timeline|reactions|add_reaction_prompt"),
        addReactionButtonVisible: false,
        addReactionMenuAnchorRect: undefined,
        isAddReactionMenuOpen: false,
        ...ReactionsRowViewModel.computeDerivedSnapshot(props),
    });

    public constructor(props: ReactionsRowViewModelProps) {
        const internalProps: InternalProps = {
            ...props,
            showAll: false,
        };
        super(internalProps, ReactionsRowViewModel.computeSnapshot(internalProps));
    }

    /** Updates whether the event can currently show reaction UI. */
    public setActionable(isActionable: boolean): void {
        this.props = {
            ...this.props,
            isActionable,
        };

        const isVisible = this.props.isActionable && this.props.reactionGroupCount > 0;

        this.snapshot.merge({ isVisible });
    }

    /** Updates the number of visible reaction groups. */
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

    /** Updates whether the current user can add reactions. */
    public setCanReact(canReact: boolean): void {
        this.props = {
            ...this.props,
            canReact,
        };

        if (!canReact) {
            this.snapshot.merge({
                showAddReactionButton: false,
                addReactionButtonActive: false,
                addReactionMenuAnchorRect: undefined,
                isAddReactionMenuOpen: false,
            });
            return;
        }

        this.snapshot.merge({ showAddReactionButton: true });
    }

    private setAddReactionMenu(addReactionMenuAnchorRect?: DOMRect): void {
        this.snapshot.merge({
            addReactionMenuAnchorRect,
            isAddReactionMenuOpen: !!addReactionMenuAnchorRect,
            addReactionButtonActive: !!addReactionMenuAnchorRect,
        });
    }

    /** Opens the add-reaction menu at the action anchor. */
    public openAddReactionMenu(anchor: HTMLElement | null): void {
        this.setAddReactionMenu(anchor?.getBoundingClientRect());
    }

    /** Closes the add-reaction menu. */
    public closeAddReactionMenu = (): void => {
        this.setAddReactionMenu(undefined);
    };

    /** Expands the limited reaction list to show every reaction group. */
    public onShowAllClick = (): void => {
        this.props = {
            ...this.props,
            showAll: true,
        };
        this.snapshot.merge({ showAllButtonVisible: false });
    };

    /** Opens the add-reaction menu from the add-reaction button. */
    public onAddReactionClick = (event: MouseEvent<HTMLButtonElement>): void => {
        this.openAddReactionMenu(event.currentTarget);
    };

    /** Opens the add-reaction menu from the add-reaction context-menu action. */
    public onAddReactionContextMenu = (event: MouseEvent<HTMLButtonElement>): void => {
        event.preventDefault();
        this.openAddReactionMenu(event.currentTarget);
    };
}
