/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getSampleFilePath(file: string): string {
    return join(__dirname, file);
}

export function readSampleFile(file: string, encoding: BufferEncoding = "utf-8"): Promise<string> {
    return readFile(getSampleFilePath(file), encoding);
}

export function readSampleFileSync(file: string): NonSharedBuffer {
    return readFileSync(getSampleFilePath(file));
}
