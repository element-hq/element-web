/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import {
    BaseViewModel,
    type DisambiguatedProfileViewSnapshot,
    type DisambiguatedProfileViewModel as DisambiguatedProfileViewModelInterface,
} from "@element-hq/web-shared-components";
import { ReactNode } from "react";
 
/**
 * ViewModel for the timeline separator, providing the current state of the component.
 * It listens to updates and computes a snapshot.
 */
export class DisambiguatedProfileViewModel
    extends BaseViewModel<DisambiguatedProfileViewSnapshot, DisambiguatedProfileViewSnapshot>
    implements DisambiguatedProfileViewModelInterface
{
    /**
    * @param label the accessible label string describing the separator (used for `aria-label`)
    * @param children optional React nodes to render between the separators
     */
    private static readonly computeSnapshot = (
        label: string,
        children?: ReactNode,
    ): DisambiguatedProfileViewSnapshot => {
        return {
            label,
            children,
        };
    };
 
    public constructor(props: DisambiguatedProfileViewSnapshot) {
        super(props, DisambiguatedProfileViewModel.computeSnapshot(props.label, props.children));
    }
 
    /**
     * Sets the snapshot and emits an update to subscribers.
     */
    private readonly setSnapshot = (): void => {
        this.snapshot.set(
            DisambiguatedProfileViewModel.computeSnapshot(this.props.label, this.props.children),
        );
    };
 
    /**
     * Updates the properties of the view model and recomputes the snapshot.
     * @param newProps
     */
    public setProps(newProps: Partial<DisambiguatedProfileViewSnapshot>): void {
        this.props = { ...this.props, ...newProps };
        this.setSnapshot();
    }
}