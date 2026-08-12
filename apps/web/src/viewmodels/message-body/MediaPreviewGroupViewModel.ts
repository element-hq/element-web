/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
    BaseViewModel,
    type MediaPreviewGroupSnapshot,
    type MediaPreviewGroupViewModel as MediaPreviewGroupViewModelInterface,
} from "@element-hq/web-shared-components";

export type MediaPreviewGroupProps = MediaPreviewGroupSnapshot;

export class MediaPreviewGroupViewModel
    extends BaseViewModel<MediaPreviewGroupSnapshot, MediaPreviewGroupProps>
    implements MediaPreviewGroupViewModelInterface
{
    public constructor(props: MediaPreviewGroupProps) {
        super(props, props);
    }

    public replace(props: MediaPreviewGroupProps): void {
        this.props = props;
        this.snapshot.set(props);
    }
}
