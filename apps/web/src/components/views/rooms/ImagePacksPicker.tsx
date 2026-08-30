/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { mediaFromMxc } from "../../../customisations/Media";
/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { useState, useEffect } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import { ImagePackStore, type ImagePack, type ImagePackImage } from "../../../stores/image-packs/ImagePackStore";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import Modal from "../../../Modal";
import ManageImagePacksDialog from "../dialogs/ManageImagePacksDialog";
import AccessibleButton from "../elements/AccessibleButton";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { ComposerType } from "../../../dispatcher/payloads/ComposerInsertPayload";

interface IProps {
    room: Room;
    onFinished: () => void;
}

export const ImagePacksPicker: React.FC<IProps> = ({ room, onFinished }) => {
    const [packs, setPacks] = useState<{ id: string; pack: ImagePack }[]>([]);
    const [activePackId, setActivePackId] = useState<string | null>(null);

    useEffect(() => {
        const store = ImagePackStore.instance;
        const roomPacks = store.getRoomImagePacks(room.roomId);
        const globalPacks = store.getGlobalImagePacks();

        // Deduplicate packs
        const allPacksMap = new Map();
        [...globalPacks, ...roomPacks].forEach((p) => {
            // Ignore empty packs
            if (p.pack && p.pack.images && Object.keys(p.pack.images).length > 0) {
                allPacksMap.set(p.id, p);
            }
        });

        const allPacks = Array.from(allPacksMap.values());
        setPacks(allPacks);

        if (allPacks.length > 0) {
            setActivePackId(allPacks[0].id);
        }

        // Immediate background prefetch of all stickers in all packs
        if (typeof window !== "undefined") {
            allPacks.forEach((p) => {
                Object.values(p.pack?.images || {}).forEach((value) => {
                    const img = value as ImagePackImage;
                    if (img?.url) {
                        try {
                            const http = mediaFromMxc(img.url).srcHttp;
                            if (http) {
                                const pre = new window.Image();
                                pre.decoding = "async";
                                pre.src = http;
                            }
                        } catch {}
                    }
                });
            });
        }
    }, [room]);

    const sendSticker = async (image: ImagePackImage, shortcode: string): Promise<void> => {
        const content = {
            body: image.body || shortcode,
            info: image.info,
            url: image.url,
        };
        await MatrixClientPeg.safeGet().sendEvent(room.roomId, "m.sticker" as any, content);
        onFinished();
    };

    const sendEmoticon = (image: ImagePackImage, shortcode: string): void => {
        // Insert shortcode into the composer
        const emoteCode = `:${shortcode}:`;
        defaultDispatcher.dispatch({
            action: Action.ComposerInsert,
            composerType: ComposerType.Send,
            text: emoteCode,
        });
        onFinished();
    };

    const handleImageClick = (p: { id: string; pack: ImagePack }, image: ImagePackImage, shortcode: string): void => {
        // According to MSC2545, usage can be "sticker", "emoticon", or both.
        // If usage is undefined, assume both for backward compatibility or flexible usage.
        const usage = p.pack.pack?.usage || ["sticker", "emoticon"];

        // Let's decide based on usage and typical behaviour:
        // Emotes are usually sent into composer, stickers are sent directly.
        if (usage.includes("emoticon") && !usage.includes("sticker")) {
            sendEmoticon(image, shortcode);
        } else {
            // Default to sending as sticker if it's explicitly a sticker or has both usages (or no usage defined).
            sendSticker(image, shortcode);
        }
    };

    const openManageDialog = (): void => {
        onFinished();
        Modal.createDialog(ManageImagePacksDialog, { room });
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", width: "320px", height: "360px", maxHeight: "450px" }}>
            {/* Tab Bar */}
            {packs.length > 0 && (
                <div
                    style={{
                        display: "flex",
                        overflowX: "auto",
                        borderBottom: "1px solid var(--cpd-color-border-interactive-secondary)",
                        padding: "8px",
                    }}
                >
                    {packs.map((p) => {
                        const firstImage = Object.values(p.pack.images || {})[0];
                        const avatarUrl = p.pack.pack?.avatar_url || firstImage?.url;
                        const src = avatarUrl ? mediaFromMxc(avatarUrl).getThumbnailOfSourceHttp(32, 32, "crop") : null;
                        return (
                            <AccessibleButton
                                key={p.id}
                                onClick={() => setActivePackId(p.id)}
                                style={{
                                    padding: "4px",
                                    borderBottom:
                                        activePackId === p.id
                                            ? "2px solid var(--cpd-color-icon-accent-tertiary)"
                                            : "2px solid transparent",
                                    cursor: "pointer",
                                    opacity: activePackId === p.id ? 1 : 0.6,
                                    marginRight: "8px",
                                }}
                                title={p.pack.pack?.display_name || p.id}
                            >
                                {src ? (
                                    <img
                                        src={src}
                                        loading="eager"
                                        decoding="async"
                                        style={{ width: 32, height: 32, objectFit: "contain" }}
                                        alt=""
                                    />
                                ) : (
                                    <span
                                        style={{
                                            width: 32,
                                            height: 32,
                                            display: "inline-block",
                                            textAlign: "center",
                                            lineHeight: "32px",
                                        }}
                                    >
                                        📁
                                    </span>
                                )}
                            </AccessibleButton>
                        );
                    })}
                </div>
            )}

            {/* Sticker Grid */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
                {packs.length === 0 ? (
                    <div
                        style={{ textAlign: "center", padding: "32px 16px", color: "var(--cpd-color-text-secondary)" }}
                    >
                        <p style={{ margin: "0 0 8px 0", fontWeight: 600 }}>{"No sticker or emoji packs found"}</p>
                        <p style={{ margin: 0, fontSize: "13px" }}>{"Click below to create or manage your packs."}</p>
                    </div>
                ) : (
                    packs
                        .filter((p) => p.id === activePackId)
                        .map((p) => (
                            <div key={p.id}>
                                <h4 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>
                                    {p.pack.pack?.display_name || p.id}
                                </h4>
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
                                        gap: "8px",
                                    }}
                                >
                                    {Object.entries(p.pack.images).map(([shortcode, image]) => {
                                        const src = mediaFromMxc(image.url).srcHttp;
                                        return (
                                            <AccessibleButton
                                                key={shortcode}
                                                onClick={() => handleImageClick(p, image, shortcode)}
                                                style={{ cursor: "pointer", padding: "4px", borderRadius: "8px" }}
                                                title={shortcode}
                                                className="mx_StickerPicker_sticker"
                                            >
                                                {src ? (
                                                    <img
                                                        src={src}
                                                        loading="eager"
                                                        decoding="async"
                                                        style={{
                                                            width: "100%",
                                                            aspectRatio: "1",
                                                            objectFit: "contain",
                                                        }}
                                                        alt={image.body || shortcode}
                                                    />
                                                ) : (
                                                    <span
                                                        style={{
                                                            display: "block",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            fontSize: "10px",
                                                        }}
                                                    >
                                                        {shortcode}
                                                    </span>
                                                )}
                                            </AccessibleButton>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                )}
            </div>

            {/* Manage Button */}
            <div style={{ borderTop: "1px solid var(--cpd-color-border-interactive-secondary)", padding: "12px" }}>
                <AccessibleButton
                    kind="primary_outline"
                    onClick={openManageDialog}
                    style={{ width: "100%", padding: "8px", textAlign: "center", borderRadius: "8px" }}
                >
                    {"Manage Image Packs"}
                </AccessibleButton>
            </div>
        </div>
    );
};

export default ImagePacksPicker;
