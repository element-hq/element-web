/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// These live in `shared-types` rather than here so that `UrlPreview` (also in `shared-types`,
// and referenced by `UrlPreviewHandler`) can use them without depending back on this package.
export type { EncryptedFile, UnstableBundledUrlPreviewSingle, UnstableBundledUrlPreviews } from "shared-types";
