/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MouseEvent } from "react";
import { type MatrixClient, type MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type ViewSourceEventViewModel as ViewSourceEventViewModelInterface,
    type ViewSourceEventViewSnapshot,
} from "@element-hq/web-shared-components";

export interface ViewSourceEventViewModelProps {
    /**
     * The hidden event whose source is being rendered.
     */
    mxEvent: MatrixEvent;
    /**
     * Matrix client used to request decryption before rendering event source.
     */
    cli: MatrixClient;
}

/**
 * ViewModel for hidden event source rendering.
 */
export class ViewSourceEventViewModel
    extends BaseViewModel<ViewSourceEventViewSnapshot, ViewSourceEventViewModelProps>
    implements ViewSourceEventViewModelInterface
{
    private decryptionListenerCleanup?: () => void;

    private static computeSnapshot(
        { mxEvent }: ViewSourceEventViewModelProps,
        expanded: boolean,
    ): ViewSourceEventViewSnapshot {
        return {
            expanded,
            preview: `{ "type": ${mxEvent.getType()} }`,
            source: expanded ? ViewSourceEventViewModel.computeSource(mxEvent) : "",
        };
    }

    private static computeSource(mxEvent: MatrixEvent): string {
        return JSON.stringify(mxEvent, null, 4) ?? "";
    }

    public constructor(props: ViewSourceEventViewModelProps) {
        super(props, ViewSourceEventViewModel.computeSnapshot(props, false));
        this.setupDecryptionListener();
    }

    public setEvent(mxEvent: MatrixEvent): void {
        if (this.props.mxEvent === mxEvent) return;

        this.props = { ...this.props, mxEvent };
        this.setupDecryptionListener();
        this.updateSnapshotFromProps();
    }

    public setClient(cli: MatrixClient): void {
        if (this.props.cli === cli) return;

        this.props = { ...this.props, cli };
        this.setupDecryptionListener();
    }

    public onToggle = (event: MouseEvent<HTMLButtonElement>): void => {
        event.preventDefault();

        const expanded = !this.snapshot.current.expanded;
        this.snapshot.merge({
            expanded,
            source: expanded ? ViewSourceEventViewModel.computeSource(this.props.mxEvent) : "",
        });
    };

    public override dispose(): void {
        this.removeDecryptionListener();
        super.dispose();
    }

    private updateSnapshotFromProps(): void {
        this.snapshot.merge(ViewSourceEventViewModel.computeSnapshot(this.props, this.snapshot.current.expanded));
    }

    private setupDecryptionListener(): void {
        this.removeDecryptionListener();

        const { cli, mxEvent } = this.props;
        void cli.decryptEventIfNeeded(mxEvent);

        if (!mxEvent.isBeingDecrypted()) return;

        const onDecrypted = (): void => {
            this.removeDecryptionListener();
            if (this.props.mxEvent !== mxEvent) return;

            this.updateSnapshotFromProps();
        };

        mxEvent.once(MatrixEventEvent.Decrypted, onDecrypted);
        this.decryptionListenerCleanup = () => mxEvent.off(MatrixEventEvent.Decrypted, onDecrypted);
    }

    private removeDecryptionListener(): void {
        this.decryptionListenerCleanup?.();
        this.decryptionListenerCleanup = undefined;
    }
}
