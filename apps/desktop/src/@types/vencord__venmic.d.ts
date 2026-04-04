/*
Copyright 2026 Joao Costa <me@joaocosta.dev>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

declare module "@vencord/venmic" {
    /** A PipeWire node represented as key-value pairs of its properties. */
    export type Node = Record<string, string>;

    /** Configuration for linking audio sources to the virtual microphone. */
    export interface LinkData {
        include: Node[];
        exclude: Node[];
        ignore_devices?: boolean;
        only_speakers?: boolean;
        only_default_speakers?: boolean;
        workaround?: Node[];
    }

    /** PipeWire audio patchbay for creating virtual microphone sources. */
    export class PatchBay {
        /** Check whether PipeWire is available on the system. */
        public static hasPipeWire(): boolean;

        /** List available audio nodes. Optionally filter by specific properties. */
        public list(props?: string[]): Node[];

        /** Link audio sources to the virtual microphone. */
        public link(data: LinkData): boolean;

        /** Unlink (destroy) the virtual microphone. */
        public unlink(): void;
    }
}
