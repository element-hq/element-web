/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

declare module "*.css";

// For importing markdown files into storybook stories
declare module "*.md?raw" {
    const content: string;
    export default content;
}
