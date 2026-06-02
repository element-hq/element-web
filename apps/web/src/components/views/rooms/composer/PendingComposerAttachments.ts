/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export interface PendingComposerAttachment {
    id: string;
    file: File;
    objectUrl?: string;
}

interface PendingComposerAttachmentUrlHooks {
    createObjectURL?: (file: File) => string;
    revokeObjectURL?: (objectUrl: string) => void;
}

interface PendingComposerAttachmentIdHooks extends PendingComposerAttachmentUrlHooks {
    createId?: (file: File, index: number) => string;
}

export function addPendingComposerAttachments(
    pending: PendingComposerAttachment[],
    files: File[],
    hooks: PendingComposerAttachmentIdHooks = {},
): PendingComposerAttachment[] {
    const startingIndex = pending.length;
    const additions = files.map((file, index) => ({
        id: hooks.createId?.(file, startingIndex + index) ?? crypto.randomUUID(),
        file,
        objectUrl: hooks.createObjectURL?.(file),
    }));

    return [...pending, ...additions];
}

export function removePendingComposerAttachment(
    pending: PendingComposerAttachment[],
    id: string,
    hooks: PendingComposerAttachmentUrlHooks = {},
): PendingComposerAttachment[] {
    const removed = pending.find((attachment) => attachment.id === id);
    if (removed?.objectUrl) {
        hooks.revokeObjectURL?.(removed.objectUrl);
    }

    return pending.filter((attachment) => attachment.id !== id);
}

export function revokePendingComposerAttachmentObjectUrls(
    pending: PendingComposerAttachment[],
    hooks: PendingComposerAttachmentUrlHooks = {},
): void {
    for (const attachment of pending) {
        if (attachment.objectUrl) {
            hooks.revokeObjectURL?.(attachment.objectUrl);
        }
    }
}
