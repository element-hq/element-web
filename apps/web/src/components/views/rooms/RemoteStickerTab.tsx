/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import React, { useEffect, useMemo, useState } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import AccessibleButton from "../elements/AccessibleButton";
import {
    getRemoteStickerIndexUrl,
    getRemoteStickerPackOrder,
    loadRemoteStickerIndex,
    sendRemoteSticker,
    setRemoteStickerPackOrder,
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
    onSent: () => void;
}

const RemoteStickerTab: React.FC<Props> = ({ room, threadId, onSent }) => {
    const [index, setIndex] = useState<RemoteStickerIndex>();
    const [query, setQuery] = useState("");
    const [pack, setPack] = useState("all");
    const [error, setError] = useState<string>();
    const [sending, setSending] = useState<string>();
    const [packOrder, setPackOrder] = useState(getRemoteStickerPackOrder);

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

    const packs = (index.packs?.filter((item): item is { id: string; name?: string } => Boolean(item.id)) ?? []).sort(
        (a, b) => {
            const aIndex = packOrder.indexOf(a.id);
            const bIndex = packOrder.indexOf(b.id);
            return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
        },
    );
    const movePack = (direction: -1 | 1): void => {
        const position = packs.findIndex((item) => item.id === pack);
        const target = position + direction;
        if (position < 0 || target < 0 || target >= packs.length) return;
        const next = packs.map((item) => item.id);
        [next[position], next[target]] = [next[target], next[position]];
        setRemoteStickerPackOrder(next);
        setPackOrder(next);
    };
    return (
        <div className="mx_RemoteStickerTab">
            <input
                className="mx_RemoteStickerTab_search"
                type="search"
                placeholder="搜索云端表情"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
            />
            <select className="mx_RemoteStickerTab_pack" value={pack} onChange={(event) => setPack(event.target.value)}>
                <option value="all">全部分类</option>
                {packs.map((item) => (
                    <option key={item.id} value={item.id}>
                        {item.name || item.id}
                    </option>
                ))}
            </select>
            {pack !== "all" && (
                <span>
                    <AccessibleButton onClick={() => movePack(-1)} title="上移表情包">
                        ↑
                    </AccessibleButton>
                    <AccessibleButton onClick={() => movePack(1)} title="下移表情包">
                        ↓
                    </AccessibleButton>
                </span>
            )}
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
                                    await sendRemoteSticker(room, threadId, sticker);
                                    onSent();
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
        </div>
    );
};

export default RemoteStickerTab;
