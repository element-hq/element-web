/*
Copyright 2026 Johannes Camp jcamp@gmx.de

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";

import ImageView from "../elements/ImageView";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { LightboxNavigationViewModel } from "../../../viewmodels/room/LightboxNavigationViewModel";

type Props = Readonly<{
    /**
     * The `m.image` event to open the lightbox on.
     */
    initialEvent: MatrixEvent;
    /**
     * URL of the initial image, shown until the image's own URL has been resolved.
     */
    initialSrc: string;
    permalinkCreator?: RoomPermalinkCreator;
    /**
     * Position and size of the clicked thumbnail, which the initial image animates in from.
     */
    thumbnailInfo?: ComponentProps<typeof ImageView>["thumbnailInfo"];
    onFinished(): void;
}>;

/**
 * Lightbox dialog for an `m.image` event that can step to the previous (older) and next (newer)
 * image in the same timeline. The navigation logic lives in {@link LightboxNavigationViewModel};
 * this dialog ties its lifetime to the dialog and shows its current image in {@link ImageView}.
 */
export default function NavigableImageViewDialog({
    initialEvent,
    initialSrc,
    permalinkCreator,
    thumbnailInfo,
    onFinished,
}: Props): React.ReactNode {
    const vm = useCreateAutoDisposedViewModel(
        () => new LightboxNavigationViewModel({ client: MatrixClientPeg.safeGet(), initialEvent, initialSrc }),
    );
    const { currentEvent, src, name } = useViewModel(vm);

    return (
        <ImageView
            src={src}
            name={name}
            mxEvent={currentEvent}
            permalinkCreator={permalinkCreator}
            thumbnailInfo={thumbnailInfo}
            onFinished={onFinished}
            navigation={vm}
        />
    );
}
