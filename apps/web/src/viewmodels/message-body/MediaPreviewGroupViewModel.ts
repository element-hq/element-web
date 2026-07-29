import { BaseViewModel, MediaPreviewGroupSnapshot, MediaPreviewGroupViewModel as MediaPreviewGroupViewModelInterface } from "@element-hq/web-shared-components";

export type MediaPreviewGroupProps = MediaPreviewGroupSnapshot;

export class MediaPreviewGroupViewModel
    extends BaseViewModel<MediaPreviewGroupSnapshot, MediaPreviewGroupProps>
    implements MediaPreviewGroupViewModelInterface {
    public constructor(props: MediaPreviewGroupProps) {
        super(props, props);
    }
}
