/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

declare module "webpack-version-file-plugin" {
    interface Opts {
        outputFile: string;
        template?: string;
        templateString?: string;
        extras?: Record<string, string>;
    }

    export default class VersionFilePlugin {
        public constructor(opts: Opts);
    }
}
