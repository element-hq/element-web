/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import React, { useEffect, useMemo, useState } from "react";
import { type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";

import AccessibleButton from "../elements/AccessibleButton";
import {
    getRemoteStickerIndexUrl,
    loadRemoteStickerIndex,
    prepareRemoteEmoticon,
    sendRemoteSticker,
    stickerMediaUrl,
    stickerName,
    stickerPreviewUrl,
    stickerSearchText,
    type RemoteSticker,
    type RemoteStickerIndex,
} from "../../../features/remote-stickers/RemoteStickerIndex";

interface Props {
    room: Room;
    threadId?: string | null;
    replyToEvent?: MatrixEvent;
    onInsertEmoticon: (emoticon: { src: string; text: string }) => void;
    onSent: () => void;
}

const RemoteStickerTab: React.FC<Props> = ({ room, threadId, replyToEvent, onInsertEmoticon, onSent }) => {
    const [index, setIndex] = useState<RemoteStickerIndex>();
    const [query, setQuery] = useState("");
    const [pack, setPack] = useState("all");
    const [error, setError] = useState<string>();
    const [sending, setSending] = useState<string>();

    useEffect(() => {
        let cancelled = false;
        loadRemoteStickerIndex()
            .then((nextIndex) => !cancelled && setIndex(nextIndex))
            .catch(
                (cause: unknown) => !cancelled && setError(cause instanceof Error ? cause.message : "云端表情加载失败"),
            );
        return () => {
            cancelled = true;
        };
    }, []);

    const stickers = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        return (index?.items ?? []).filter((sticker) => {
            if (!stickerMediaUrl(sticker)) return false;
            if (pack !== "all" && sticker.packId !== pack) return false;
            return !normalizedQuery || stickerSearchText(sticker).includes(normalizedQuery);
        });
    }, [index, pack, query]);

    if (!getRemoteStickerIndexUrl()) return <div className="mx_RemoteStickerTab_empty">管理员尚未配置云端表情。</div>;
    if (error) return <div className="mx_RemoteStickerTab_empty">{error}</div>;
    if (!index) return <div className="mx_RemoteStickerTab_empty">正在加载云端表情…</div>;

    const packs = index.packs?.filter((item): item is { id: string; name?: string } => Boolean(item.id)) ?? [];
    return (
        <div className="mx_RemoteStickerTab">
            <div className="mx_RemoteStickerTab_toolbar">
                <input
                    className="mx_RemoteStickerTab_search"
                    type="search"
                    placeholder="搜索表情"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
            </div>
            <div className="mx_RemoteStickerTab_content">
                <div className="mx_RemoteStickerTab_grid" role="grid" aria-label="云端表情">
                    {stickers.map((sticker: RemoteSticker, offset) => {
                        const id = sticker.id || `${sticker.packId || "remote"}-${stickerName(sticker)}-${offset}`;
                        return (
                            <AccessibleButton
                                key={id}
                                className="mx_RemoteStickerTab_item"
                                title={stickerName(sticker)}
                                disabled={sending === id}
                                onClick={async () => {
                                    setSending(id);
                                    setError(undefined);
                                    try {
                                        const targetEncrypted = Boolean(
                                            await room.client.getCrypto()?.isEncryptionEnabledInRoom(room.roomId),
                                        );
                                        if (!targetEncrypted) {
                                            onInsertEmoticon(await prepareRemoteEmoticon(room, sticker));
                                        } else {
                                            await sendRemoteSticker(room, threadId, sticker, replyToEvent);
                                            onSent();
                                        }
                                    } catch (cause) {
                                        setError(cause instanceof Error ? cause.message : "发送云端表情失败");
                                    } finally {
                                        setSending(undefined);
                                    }
                                }}
                            >
                                <img
                                    loading="lazy"
                                    src={stickerPreviewUrl(sticker, room.client)}
                                    alt={stickerName(sticker)}
                                />
                            </AccessibleButton>
                        );
                    })}
                </div>
                <div className="mx_RemoteStickerTab_packRail" aria-label="表情分类">
                    <AccessibleButton
                        className="mx_RemoteStickerTab_packButton"
                        data-active={pack === "all" || undefined}
                        onClick={() => setPack("all")}
                        title="全部表情"
                    >
                        全部
                    </AccessibleButton>
                    {packs.map((item) => {
                        const preview = index.items?.find((sticker) => sticker.packId === item.id);
                        return (
                            <AccessibleButton
                                key={item.id}
                                className="mx_RemoteStickerTab_packButton"
                                data-active={pack === item.id || undefined}
                                onClick={() => setPack(item.id)}
                                title={item.name || item.id}
                            >
                                {preview ? (
                                    <img src={stickerPreviewUrl(preview, room.client)} alt={item.name || item.id} />
                                ) : (
                                    <span>{(item.name || item.id).slice(0, 1)}</span>
                                )}
                            </AccessibleButton>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default RemoteStickerTab;
