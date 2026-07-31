/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import { type IContent, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { type EncryptedFile } from "matrix-js-sdk/src/types";

import { uploadFile } from "../../ContentMessages";
import { decryptFile } from "../../utils/DecryptFile";

const sourceMediaUrl = (content: IContent): string | undefined => {
    const encrypted = content.file as EncryptedFile | undefined;
    return encrypted?.url ?? (typeof content.url === "string" ? content.url : undefined);
};

/**
 * Copy only the binary attachment into the target room. Element's transformEvent continues to
 * own relation/mention cleanup, and uploadFile continues to own target-room encryption.
 */
export const copyForwardedMedia = async (
    client: MatrixClient,
    targetRoom: Room,
    content: IContent,
): Promise<IContent> => {
    const mediaUrl = sourceMediaUrl(content);
    if (!mediaUrl) return content;

    const encrypted = content.file as EncryptedFile | undefined;
    const blob = encrypted
        ? await decryptFile(encrypted, content.info)
        : await fetch(client.mxcUrlToHttp(mediaUrl, undefined, undefined, undefined, false, true) ?? mediaUrl).then(
              async (response) => {
                  if (!response.ok) throw new Error(`无法下载待转发媒体（${response.status}）`);
                  return response.blob();
              },
          );
    const mimeType = typeof content.info?.mimetype === "string" ? content.info.mimetype : blob.type;
    const filename = typeof content.filename === "string" ? content.filename : content.body || "attachment";
    const uploaded = await uploadFile(client, targetRoom.roomId, new File([blob], filename, { type: mimeType }));
    const copied = { ...content };
    delete copied.url;
    delete copied.file;
    // A thumbnail from the source room might disappear or be encrypted with a different key.
    delete copied.info?.thumbnail_url;
    delete copied.info?.thumbnail_file;
    delete copied.info?.thumbnail_info;
    return { ...copied, ...uploaded };
};
