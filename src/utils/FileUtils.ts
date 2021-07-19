/*
Copyright 2015 - 2021 The Matrix.org Foundation C.I.C.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import filesize from 'filesize';
import { IMediaEventContent } from '../customisations/models/IMediaEventContent';
import { _t } from '../languageHandler';

/**
 * Extracts a human readable label for the file attachment to use as
 * link text.
 *
 * @param {IMediaEventContent} content The "content" key of the matrix event.
 * @param {string} fallbackText The fallback text
 * @param {boolean} withSize Whether to include size information. Default true.
 * @return {string} the human readable link text for the attachment.
 */
export function presentableTextForFile(
    content: IMediaEventContent,
    fallbackText = _t("Attachment"),
    withSize = true,
): string {
    let text = fallbackText;
    if (content.body && content.body.length > 0) {
        // The content body should be the name of the file including a
        // file extension.
        text = content.body;
    }

    if (content.info && content.info.size && withSize) {
        // If we know the size of the file then add it as human readable
        // string to the end of the link text so that the user knows how
        // big a file they are downloading.
        // The content.info also contains a MIME-type but we don't display
        // it since it is "ugly", users generally aren't aware what it
        // means and the type of the attachment can usually be inferrered
        // from the file extension.
        text += ' (' + filesize(content.info.size) + ')';
    }
    return text;
}
