/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import ScrollPanel, { type IScrollPanelProps } from "./ScrollPanel";

/**
 * Placeholder wrapper for the Labs-gated virtualized timeline path.
 * This currently preserves ScrollPanel behaviour until virtualization lands.
 */
export default class TimelineScrollPanel extends ScrollPanel {
    declare public props: Readonly<IScrollPanelProps>;
}
