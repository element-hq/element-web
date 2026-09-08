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

/**
 * Props for {@link MediaPreviewGroupViewModel}. Identical to the snapshot: this view model derives
 * nothing, so entry composition (labels, icons, button handlers) happens in the caller, e.g. `MBodyFactory`.
 */
export type MediaPreviewGroupProps = MediaPreviewGroupSnapshot;

/**
 * A pass-through view model that makes a group of media previews observable by `MediaPreviewGroupView`.
 */
export class MediaPreviewGroupViewModel
    extends BaseViewModel<MediaPreviewGroupSnapshot, MediaPreviewGroupProps>
    implements MediaPreviewGroupViewModelInterface
{
    public constructor(props: MediaPreviewGroupProps) {
        super(props, props);
    }

    /**
     * Swap in a new set of entries and notify subscribers. Entries are replaced wholesale rather than
     * merged, so removals take effect.
     *
     * @param props The entries that replace the current group.
     */
    public setProps(props: MediaPreviewGroupProps): void {
        this.props = props;
        this.snapshot.set(props);
    }
}
