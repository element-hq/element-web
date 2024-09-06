/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

declare module "*.svg" {
    const path: string;
    export const Icon: React.FC<React.SVGProps<SVGSVGElement>>;
    export default path;
}
