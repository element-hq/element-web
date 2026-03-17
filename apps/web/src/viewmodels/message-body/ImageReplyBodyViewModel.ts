/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    type ImageReplyBodyViewSnapshot,
    type ImageReplyBodyViewModel as ImageReplyBodyViewModelInterface,
} from "@element-hq/web-shared-components";

export interface ImageReplyBodyViewModelProps {
    /**
     * Controls whether the reply image body should render.
     * @default true
     */
    isVisible?: boolean;
}

interface InternalProps {
    isVisible: boolean;
}

export class ImageReplyBodyViewModel
    extends BaseViewModel<ImageReplyBodyViewSnapshot, InternalProps>
    implements ImageReplyBodyViewModelInterface
{
    private static readonly computeSnapshot = (props: InternalProps): ImageReplyBodyViewSnapshot => ({
        isVisible: props.isVisible,
    });

    public constructor(props: ImageReplyBodyViewModelProps = {}) {
        const internalProps: InternalProps = {
            isVisible: props.isVisible ?? true,
        };

        super(internalProps, ImageReplyBodyViewModel.computeSnapshot(internalProps));
    }

    public setVisible(isVisible: boolean): void {
        if (this.snapshot.current.isVisible === isVisible) {
            return;
        }

        this.props = {
            ...this.props,
            isVisible,
        };

        this.snapshot.merge({ isVisible });
    }
}
