/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingsStore from "../../settings/SettingsStore";
import { stripFileMetadata } from "./stripFileMetadata";

/**
 * Removes metadata such as location from a file if the labs feature is enabled.
 * Used for uploads which do not go through the upload dialog, such as avatars.
 *
 * @param file - the file about to be uploaded
 * @returns the file to upload
 * @throws {MetadataStripError} if the metadata could not be removed, in which case the file must not be uploaded
 */
export async function stripFileMetadataIfEnabled(file: File): Promise<File> {
    return SettingsStore.getValue("feature_strip_upload_metadata") ? stripFileMetadata(file) : file;
}
