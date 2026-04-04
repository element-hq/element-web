/*
Copyright 2026 Joao Costa <me@joaocosta.dev>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Node } from "@vencord/venmic";

/** User's audio source selection from the audio picker. */
export interface AudioSelection {
    /** The type of audio source: "none" (no audio), "system" (all system audio), or "app" (specific application). */
    type: "none" | "system" | "app";
    /** The PipeWire node to capture audio from. Only set when type is "app". */
    node?: Node;
}

/** Result of listing available venmic audio nodes. */
export type VenmicListResult =
    | { ok: true; targets: Node[]; hasPipewirePulse: boolean }
    | { ok: false; isGlibcOutdated: boolean };
