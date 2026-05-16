/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MouseEvent } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type MjolnirBodyViewModel as MjolnirBodyViewModelInterface,
    type MjolnirBodyViewSnapshot,
} from "@element-hq/web-shared-components";

export interface MjolnirBodyViewModelProps {
    /**
     * The event currently hidden by Mjolnir.
     */
    mxEvent: MatrixEvent;
    /**
     * Invoked after the event has been allowed so the tile can re-render.
     */
    onMessageAllowed?: () => void;
}

/**
 * ViewModel for Mjolnir-hidden message bodies.
 */
export class MjolnirBodyViewModel
    extends BaseViewModel<MjolnirBodyViewSnapshot, MjolnirBodyViewModelProps>
    implements MjolnirBodyViewModelInterface
{
    private static readonly computeSnapshot = (): MjolnirBodyViewSnapshot => ({});

    public constructor(props: MjolnirBodyViewModelProps) {
        super(props, MjolnirBodyViewModel.computeSnapshot());
    }

    public setEvent(mxEvent: MatrixEvent): void {
        if (this.props.mxEvent === mxEvent) return;

        // The view has no event-derived render state; this only changes action inputs.
        this.props = { ...this.props, mxEvent };
    }

    public setOnMessageAllowed(onMessageAllowed: (() => void) | undefined): void {
        if (this.props.onMessageAllowed === onMessageAllowed) return;

        // The view has no callback-derived render state; this only changes action inputs.
        this.props = { ...this.props, onMessageAllowed };
    }

    public onAllowClick = (event: MouseEvent<HTMLButtonElement>): void => {
        event.preventDefault();
        event.stopPropagation();

        localStorage.setItem(this.localStorageKey, "true");
        this.props.onMessageAllowed?.();
    };

    private get localStorageKey(): string {
        return `mx_mjolnir_render_${this.props.mxEvent.getRoomId()}__${this.props.mxEvent.getId()}`;
    }
}
