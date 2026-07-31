/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import React, { useEffect, useMemo, useState } from "react";
import {
    ClientEvent,
    type MatrixEvent,
    type Room,
} from "matrix-js-sdk/src/matrix";

import AccessibleButton from "../elements/AccessibleButton";
import {
    getPersonalEmojiPacks,
    personalEmojiPreviewUrl,
    type PersonalEmojiItem,
    type PersonalEmojiPack,
} from "../../../features/personal-emoji/PersonalEmojiPacks";
import {
    sendRemoteSticker,
    type RemoteSticker,
} from "../../../features/remote-stickers/RemoteStickerIndex";

interface Props {
    room: Room;
    threadId?: string | null;
    replyToEvent?: MatrixEvent;
    onSent: () => void;
}

const asRemoteSticker = (item: PersonalEmojiItem): RemoteSticker => ({
    id: item.id,
    packId: item.packId,
    name: item.body || item.shortcode,
    fileName: item.shortcode,
    keywords: item.keywords,
    mxc: item.url.startsWith("mxc://") ? item.url : undefined,
    url: item.url.startsWith("mxc://") ? undefined : item.url,
    mimeType:
        typeof item.info?.mimetype === "string"
            ? item.info.mimetype
            : undefined,
    width: typeof item.info?.w === "number" ? item.info.w : undefined,
    height: typeof item.info?.h === "number" ? item.info.h : undefined,
    size: typeof item.info?.size === "number" ? item.info.size : undefined,
});

/** Spark/Cinny-compatible personal stickers, sourced from Matrix account data. */
const PersonalStickerTab: React.FC<Props> = ({
    room,
    threadId,
    replyToEvent,
    onSent,
}) => {
    const [packs, setPacks] = useState<PersonalEmojiPack[]>([]);
    const [packId, setPackId] = useState("all");
    const [query, setQuery] = useState("");
    const [preview, setPreview] = useState<PersonalEmojiItem>();
    const [sending, setSending] = useState<string>();
    const [error, setError] = useState<string>();

    useEffect(() => {
        const refresh = (): void =>
            setPacks(getPersonalEmojiPacks(room.client));
        refresh();
        room.client.on(ClientEvent.AccountData, refresh);
        return () =>
            room.client.removeListener(ClientEvent.AccountData, refresh);
    }, [room.client]);

    const stickers = useMemo(() => {
        const search = query.trim().toLocaleLowerCase();
        return packs
            .flatMap((pack) => pack.items)
            .filter((item) => item.usage.includes("sticker"))
            .filter((item) => packId === "all" || item.packId === packId)
            .filter(
                (item) =>
                    !search ||
                    item.keywords.join(" ").toLocaleLowerCase().includes(search)
            );
    }, [packId, packs, query]);

    if (error) return <div className="mx_RemoteStickerTab_empty">{error}</div>;
    if (packs.length === 0) {
        return (
            <div className="mx_RemoteStickerTab_empty">
                还没有个人贴纸包。可先在星火中保存贴纸，随后会通过 Matrix
                账号数据同步到这里。
            </div>
        );
    }

    return (
        <div className="mx_RemoteStickerTab mx_PersonalStickerTab">
            <div className="mx_RemoteStickerTab_toolbar">
                <input
                    className="mx_RemoteStickerTab_search"
                    type="search"
                    placeholder="搜索个人贴纸"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
            </div>
            <div className="mx_RemoteStickerTab_content">
                <div
                    className="mx_RemoteStickerTab_grid"
                    data-mode="sticker"
                    role="grid"
                    aria-label="个人贴纸"
                >
                    <div className="mx_RemoteStickerTab_groupLabel">
                        {packId === "all"
                            ? "个人贴纸"
                            : packs.find((pack) => pack.id === packId)?.name}
                    </div>
                    {stickers.map((item, index) => (
                        <AccessibleButton
                            key={item.id}
                            className="mx_RemoteStickerTab_item"
                            data-remote-sticker-index={index}
                            title={item.body || item.shortcode}
                            disabled={sending === item.id}
                            onMouseEnter={() => setPreview(item)}
                            onFocus={() => setPreview(item)}
                            onClick={async () => {
                                setSending(item.id);
                                setError(undefined);
                                try {
                                    await sendRemoteSticker(
                                        room,
                                        threadId,
                                        asRemoteSticker(item),
                                        replyToEvent
                                    );
                                    onSent();
                                } catch (cause) {
                                    setError(
                                        cause instanceof Error
                                            ? cause.message
                                            : "发送个人贴纸失败。"
                                    );
                                } finally {
                                    setSending(undefined);
                                }
                            }}
                        >
                            <img
                                loading="lazy"
                                src={personalEmojiPreviewUrl(item, room.client)}
                                alt={item.body || item.shortcode}
                                draggable={false}
                            />
                        </AccessibleButton>
                    ))}
                </div>
                <div
                    className="mx_RemoteStickerTab_packRail"
                    aria-label="个人贴纸分类"
                >
                    <AccessibleButton
                        className="mx_RemoteStickerTab_packButton"
                        data-active={packId === "all" || undefined}
                        onClick={() => setPackId("all")}
                        title="全部贴纸"
                    >
                        全部
                    </AccessibleButton>
                    {packs.map((pack) => {
                        const icon =
                            pack.items.find((item) =>
                                item.usage.includes("sticker")
                            ) ?? pack.items[0];
                        return (
                            <AccessibleButton
                                key={pack.id}
                                className="mx_RemoteStickerTab_packButton"
                                data-active={packId === pack.id || undefined}
                                onClick={() => setPackId(pack.id)}
                                title={pack.name}
                            >
                                {icon ? (
                                    <img
                                        src={personalEmojiPreviewUrl(
                                            icon,
                                            room.client,
                                            48
                                        )}
                                        alt={pack.name}
                                        draggable={false}
                                    />
                                ) : (
                                    pack.name.slice(0, 1)
                                )}
                            </AccessibleButton>
                        );
                    })}
                </div>
            </div>
            {preview && (
                <div className="mx_RemoteStickerTab_preview" aria-live="polite">
                    <img
                        src={personalEmojiPreviewUrl(preview, room.client)}
                        alt=""
                        draggable={false}
                    />
                    <span>:{preview.shortcode}:</span>
                </div>
            )}
        </div>
    );
};

export default PersonalStickerTab;
