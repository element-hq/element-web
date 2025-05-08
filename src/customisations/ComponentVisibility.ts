/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Dev note: this customisation point is heavily inspired by UIFeature flags, though
// with an intention of being used for more complex switching on whether or not a feature
// should be shown.

// Populate this class with the details of your customisations when copying it.

import { type ComponentVisibilityCustomisations as IComponentVisibilityCustomisations } from "@element-hq/element-web-module-api";

// A real customisation module will define and export one or more of the
// customisation points that make up the interface above.
export const ComponentVisibilityCustomisations: IComponentVisibilityCustomisations = {
    // while we don't specify the functions here, their defaults are described
    // in their pseudo-implementations above.
};
