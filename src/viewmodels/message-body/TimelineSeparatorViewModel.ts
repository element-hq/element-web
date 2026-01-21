/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import {
    BaseViewModel,
    type TimelineSeparatorViewSnapshot,
    type TimelineSeparatorViewModel as TimelineSeparatorViewModelInterface,
} from "@element-hq/web-shared-components";
import { PropsWithChildren } from "react";
 
/**
 * ViewModel for the timeline separator, providing the current state of the component.
 * It listens to updates and computes a snapshot.
 */
export class TimelineSeparatorViewModel
    extends BaseViewModel<TimelineSeparatorViewSnapshot, TimelineSeparatorViewSnapshot>
    implements TimelineSeparatorViewModelInterface
{
    /**
    * @param label the accessible label string describing the separator (used for `aria-label`)
    * @param children optional React nodes to render between the separators
     */
    private static readonly computeSnapshot = (
        label: string,
        children?: PropsWithChildren["children"],
    ): TimelineSeparatorViewSnapshot => {
        return {
            label,
            children,
        };
    };
 
    public constructor(props: TimelineSeparatorViewSnapshot) {
        super(props, TimelineSeparatorViewModel.computeSnapshot(props.label, props.children));
    }
 
    /**
     * Sets the snapshot and emits an update to subscribers.
     */
    private readonly setSnapshot = (): void => {
        this.snapshot.set(
            TimelineSeparatorViewModel.computeSnapshot(this.props.label, this.props.children),
        );
    };
 
    /**
     * Updates the properties of the view model and recomputes the snapshot.
     * @param newProps
     */
    public setProps(newProps: Partial<TimelineSeparatorViewSnapshot>): void {
        this.props = { ...this.props, ...newProps };
        this.setSnapshot();
    }
}