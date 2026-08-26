/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, type Dispatch, type KeyboardEvent } from "react";

import {
    checkInputableElement,
    findNextSiblingElement,
    findPreviousSiblingElement,
    type IAction,
    type IState,
    RovingAction,
    RovingStateActionType,
    RovingTabIndexProvider,
    type RovingTabIndexProviderProps,
} from "./RovingTabIndex";

/**
 * Resolves the grid cell element that contains a registered roving node.
 *
 * The default expects the roving node to be a direct child of a `role="gridcell"`
 * element.
 */
export type RovingGridCellResolver = (this: void, rovingNode: Element) => Element | undefined;

/**
 * Resolves the row element that contains a registered roving node.
 *
 * The default expects `rovingNode -> gridcell -> row`, where the row element is
 * the grid cell's parent.
 */
export type RovingGridRowResolver = (this: void, rovingNode: Element) => Element | undefined;

/**
 * Resolves the registered roving node contained within a grid cell.
 *
 * The default expects the roving node to be the first child of the grid cell.
 */
export type RovingGridNodeResolver = (this: void, gridCell: Element) => HTMLElement | undefined;

/**
 * Controls whether grid navigation moves DOM focus to the active cell.
 *
 * Pass `false` for composite widgets that keep DOM focus elsewhere and expose
 * the active grid item through `aria-activedescendant`.
 */
export type RovingGridMoveFocus =
    | boolean
    | ((this: void, target: HTMLElement, event: KeyboardEvent, state: IState) => boolean);

/**
 * Props for {@link RovingGridIndexProvider}.
 */
export interface RovingGridIndexProviderProps extends Omit<
    RovingTabIndexProviderProps,
    "handleUpDown" | "handleLeftRight" | "onKeyDown"
> {
    /**
     * Optional callback invoked before grid handling and before the wrapped
     * roving provider performs its own keyboard handling.
     *
     * Call `preventDefault()` on the event to suppress grid and fallback
     * roving behaviour.
     */
    onKeyDown?(this: void, ev: KeyboardEvent, state: IState, dispatch: Dispatch<IAction>): void;
    /**
     * Whether arrow-key grid navigation should move DOM focus.
     *
     * Defaults to `true`. When `false`, the provider still updates the active
     * roving node and tab stop.
     */
    moveFocus?: RovingGridMoveFocus;
    /**
     * Called after grid navigation resolves a target and updates roving state.
     */
    onGridNavigation?(
        this: void,
        event: KeyboardEvent,
        target: HTMLElement,
        state: IState,
        dispatch: Dispatch<IAction>,
    ): void;
    /**
     * Resolves the grid cell element for a registered roving node.
     *
     * Override this when the roving node is not a direct child of the grid cell.
     */
    getGridCell?: RovingGridCellResolver;
    /**
     * Resolves the row element for a registered roving node.
     *
     * Override this when grid rows are not direct parents of grid cells.
     */
    getRow?: RovingGridRowResolver;
    /**
     * Resolves the registered roving node inside a grid cell.
     *
     * Override this when the focusable element is not the grid cell's first
     * child.
     */
    getRovingNode?: RovingGridNodeResolver;
}

const defaultGetGridCell: RovingGridCellResolver = (rovingNode) => rovingNode.parentElement ?? undefined;

const defaultGetRovingNode: RovingGridNodeResolver = (gridCell) => {
    const child = gridCell.children[0];
    return child instanceof HTMLElement ? child : undefined;
};

type RovingGridNavigationAction =
    | RovingAction.ArrowLeft
    | RovingAction.ArrowRight
    | RovingAction.ArrowUp
    | RovingAction.ArrowDown;

const isGridNavigationAction = (action: RovingAction | undefined): action is RovingGridNavigationAction => {
    return (
        action === RovingAction.ArrowLeft ||
        action === RovingAction.ArrowRight ||
        action === RovingAction.ArrowUp ||
        action === RovingAction.ArrowDown
    );
};

const getHorizontalTarget = (
    action: RovingAction,
    state: IState,
    handleLoop: boolean | undefined,
): HTMLElement | undefined => {
    if (!state.activeNode) return undefined;

    const activeIndex = state.nodes.indexOf(state.activeNode);
    if (activeIndex === -1) return undefined;

    if (action === RovingAction.ArrowLeft) {
        return findPreviousSiblingElement(state.nodes, activeIndex - 1, handleLoop);
    }

    if (action === RovingAction.ArrowRight) {
        return findNextSiblingElement(state.nodes, activeIndex + 1, handleLoop);
    }
};

const getVerticalTarget = (
    action: RovingAction,
    state: IState,
    getGridCell: RovingGridCellResolver,
    getRow: RovingGridRowResolver,
    getRovingNode: RovingGridNodeResolver,
): HTMLElement | undefined => {
    if (!state.activeNode) return undefined;

    const row = getRow(state.activeNode);
    const gridCell = getGridCell(state.activeNode);
    if (!row || !gridCell) return undefined;

    const columnIndex = Array.from(row.children).indexOf(gridCell);
    const activeIndex = state.nodes.indexOf(state.activeNode);
    if (columnIndex === -1 || activeIndex === -1) return undefined;

    const nextRowProbeIndex =
        action === RovingAction.ArrowUp
            ? activeIndex - columnIndex - 1
            : activeIndex - columnIndex + row.children.length;
    const nextRow = getRow(state.nodes[nextRowProbeIndex]);

    if (nextRow) {
        if (!(nextRow instanceof HTMLElement) || nextRow.offsetParent === null || nextRow.children.length === 0) {
            return undefined;
        }

        const nextColumnIndex = Math.min(columnIndex, nextRow.children.length - 1);
        const target = getRovingNode(nextRow.children[nextColumnIndex]);
        if (target?.offsetParent && state.nodes.includes(target)) {
            return target;
        }
    }
};

const shouldMoveFocus = (
    moveFocus: RovingGridMoveFocus | undefined,
    target: HTMLElement,
    event: KeyboardEvent,
    state: IState,
): boolean => {
    if (typeof moveFocus === "function") return moveFocus(target, event, state);
    return moveFocus ?? true;
};

/**
 * Provides two-dimensional arrow-key navigation for roving tabindex grids.
 *
 * `RovingGridIndexProvider` reuses the same registration state as
 * {@link RovingTabIndexProvider}. Descendants should still call
 * {@link useRovingTabIndex}; this provider only changes how arrow keys resolve
 * the next active node.
 *
 * By default, the provider expects each registered roving node to be rendered as
 * the first child of a `role="gridcell"` element, and each grid cell to be a
 * direct child of a row element. Override `getGridCell`, `getRow`, and
 * `getRovingNode` for different markup.
 */
export const RovingGridIndexProvider: React.FC<RovingGridIndexProviderProps> = ({
    children,
    getAction,
    getGridCell = defaultGetGridCell,
    getRow,
    getRovingNode = defaultGetRovingNode,
    handleInputFields,
    handleLoop,
    moveFocus,
    onGridNavigation,
    onKeyDown,
    scrollIntoView,
    ...props
}) => {
    const resolvedGetRow = useCallback<RovingGridRowResolver>(
        (rovingNode) => getRow?.(rovingNode) ?? getGridCell(rovingNode)?.parentElement ?? undefined,
        [getGridCell, getRow],
    );

    const onGridKeyDown = useCallback(
        (event: KeyboardEvent, state: IState, dispatch: Dispatch<IAction>): void => {
            onKeyDown?.(event, state, dispatch);
            if (event.defaultPrevented) return;

            const action = getAction?.(event) ?? getDefaultGridAction(event);
            if (!isGridNavigationAction(action) || !state.activeNode) return;

            if (!handleInputFields && event.target instanceof HTMLElement && checkInputableElement(event.target)) {
                return;
            }

            const target =
                action === RovingAction.ArrowUp || action === RovingAction.ArrowDown
                    ? getVerticalTarget(action, state, getGridCell, resolvedGetRow, getRovingNode)
                    : getHorizontalTarget(action, state, handleLoop);

            event.preventDefault();
            event.stopPropagation();

            if (!target) return;

            if (shouldMoveFocus(moveFocus, target, event, state)) {
                target.focus();
            }

            dispatch({
                type: RovingStateActionType.SetFocus,
                payload: { node: target },
            });

            if (scrollIntoView) {
                target.scrollIntoView(scrollIntoView);
            }

            onGridNavigation?.(event, target, state, dispatch);
        },
        [
            getAction,
            getGridCell,
            getRovingNode,
            handleInputFields,
            handleLoop,
            moveFocus,
            onGridNavigation,
            onKeyDown,
            resolvedGetRow,
            scrollIntoView,
        ],
    );

    return (
        <RovingTabIndexProvider
            {...props}
            getAction={getAction}
            handleInputFields={handleInputFields}
            handleLoop={handleLoop}
            onKeyDown={onGridKeyDown}
            scrollIntoView={scrollIntoView}
        >
            {children}
        </RovingTabIndexProvider>
    );
};

const getDefaultGridAction = (ev: KeyboardEvent): RovingAction | undefined => {
    switch (ev.key) {
        case "ArrowLeft":
            return RovingAction.ArrowLeft;
        case "ArrowUp":
            return RovingAction.ArrowUp;
        case "ArrowRight":
            return RovingAction.ArrowRight;
        case "ArrowDown":
            return RovingAction.ArrowDown;
        default:
            return undefined;
    }
};
