/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import type { PendingComposerAttachment } from "./composer/PendingComposerAttachments";

interface PendingAttachmentTrayProps {
    attachments: PendingComposerAttachment[];
    onRemove(this: void, id: string): void;
}

export default function PendingAttachmentTray({
    attachments,
    onRemove,
}: PendingAttachmentTrayProps): React.ReactElement | null {
    if (attachments.length === 0) {
        return null;
    }

    const stopComposerFocus = (ev: React.SyntheticEvent): void => {
        ev.stopPropagation();
    };

    return (
        <div
            className="mx_PendingAttachmentTray mx_PendingAttachmentTray_bounded"
            data-testid="pending-attachment-tray"
            onClick={stopComposerFocus}
            onMouseDown={stopComposerFocus}
        >
            {attachments.map((attachment) => (
                <div className="mx_PendingAttachmentTray_item" key={attachment.id}>
                    <div className="mx_PendingAttachmentTray_thumbnailFrame">
                        {attachment.objectUrl && (
                            <img
                                className="mx_PendingAttachmentTray_thumbnailImage"
                                src={attachment.objectUrl}
                                alt={attachment.file.name}
                            />
                        )}
                        <button
                            className="mx_PendingAttachmentTray_removeButton"
                            type="button"
                            onClick={() => onRemove(attachment.id)}
                            aria-label={`Remove ${attachment.file.name}`}
                        >
                            ×
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
