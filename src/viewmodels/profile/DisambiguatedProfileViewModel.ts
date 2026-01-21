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
        member: { userId: string; roomId: string; rawDisplayName?: string; disambiguate: boolean } | null | undefined,
        fallbackName: string,
        colored?: boolean,
        emphasizeDisplayName?: boolean,
        withTooltip?: boolean,
    ): DisambiguatedProfileViewSnapshot => {
        return {
            member: {
                userId: member?.userId ?? "",
                roomId: member?.roomId ?? "",
                rawDisplayName: member?.rawDisplayName ?? "",
                disambiguate: member?.disambiguate ?? false,
            },
            fallbackName,
            colored,
            emphasizeDisplayName,
            withTooltip,
        };
    };
 
    public constructor(props: DisambiguatedProfileViewSnapshot) {
        super(props, DisambiguatedProfileViewModel.computeSnapshot(props.member, props.fallbackName, props.colored, props.emphasizeDisplayName, props.withTooltip));
    }
 
    /**
     * Sets the snapshot and emits an update to subscribers.
     */
    private readonly setSnapshot = (): void => {
        this.snapshot.set(
            DisambiguatedProfileViewModel.computeSnapshot(this.props.member, this.props.fallbackName, this.props.colored, this.props.emphasizeDisplayName, this.props.withTooltip),
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