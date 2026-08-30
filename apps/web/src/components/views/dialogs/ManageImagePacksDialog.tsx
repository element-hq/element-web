/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { useState, useEffect } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import BaseDialog from "./BaseDialog";
import QuestionDialog from "./QuestionDialog";
import Modal from "../../../Modal";
import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { ImagePackStore, type ImagePack } from "../../../stores/image-packs/ImagePackStore";
import { mediaFromMxc } from "../../../customisations/Media";
import AccessibleButton from "../elements/AccessibleButton";

interface IProps {
    room: Room;
    onFinished: () => void;
}

export const ManageImagePacksDialog: React.FC<IProps> = ({ room, onFinished }) => {
    const [packs, setPacks] = useState<{ id: string; pack: ImagePack; roomId: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingPackKey, setEditingPackKey] = useState<string | null>(null);

    const getPackKey = (p: { roomId: string; id: string }): string => `${p.roomId}:${p.id}`;

    const loadPacks = React.useCallback((): void => {
        const store = ImagePackStore.instance;
        const roomPacks = store.getRoomImagePacks(room.roomId);
        setPacks(roomPacks);
        setEditingPackKey((prev) => {
            if (prev && roomPacks.some((p) => getPackKey(p) === prev)) {
                return prev;
            }
            return roomPacks[0] ? getPackKey(roomPacks[0]) : null;
        });
    }, [room.roomId]);

    useEffect(() => {
        loadPacks();
    }, [loadPacks]);

    const handleCreatePack = async (): Promise<void> => {
        setLoading(true);
        try {
            const store = ImagePackStore.instance;
            const newPackId = "pack_" + Date.now();
            const newPack: ImagePack = {
                images: {},
                pack: {
                    display_name: "New Pack",
                    usage: ["sticker", "emoticon"],
                },
            };
            await store.createOrUpdateRoomPack(room.roomId, newPackId, newPack);
            const newEntry = { id: newPackId, pack: newPack, roomId: room.roomId };
            setPacks((prev) => [...prev, newEntry]);
            setEditingPackKey(getPackKey(newEntry));
        } catch (e) {
            console.error("Failed to create pack", e);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (
        event: React.ChangeEvent<HTMLInputElement>,
        targetPack: { id: string; roomId: string; pack: ImagePack },
    ): Promise<void> => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setLoading(true);
        try {
            const store = ImagePackStore.instance;
            const updatedImages = { ...targetPack.pack.images };

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const uploadPromise = MatrixClientPeg.safeGet().uploadContent(file, {
                    includeFilename: false,
                });
                const response = await uploadPromise;
                const shortcode = file.name.split(".")[0].replace(/[^a-zA-Z0-9_-]/g, "");

                updatedImages[shortcode] = {
                    url: response.content_uri,
                    body: shortcode,
                    info: {
                        mimetype: file.type,
                        size: file.size,
                    },
                };
            }

            const updatedPack: ImagePack = {
                ...targetPack.pack,
                images: updatedImages,
            };

            await store.createOrUpdateRoomPack(targetPack.roomId, targetPack.id, updatedPack);
            const targetKey = getPackKey(targetPack);
            setPacks((prev) => prev.map((p) => (getPackKey(p) === targetKey ? { ...p, pack: updatedPack } : p)));
        } catch (e) {
            console.error("Failed to upload image", e);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteImage = async (
        targetPack: { id: string; roomId: string; pack: ImagePack },
        shortcode: string,
    ): Promise<void> => {
        setLoading(true);
        try {
            const store = ImagePackStore.instance;
            const updatedImages = { ...targetPack.pack.images };
            delete updatedImages[shortcode];

            const updatedPack: ImagePack = {
                ...targetPack.pack,
                images: updatedImages,
            };

            await store.createOrUpdateRoomPack(targetPack.roomId, targetPack.id, updatedPack);
            const targetKey = getPackKey(targetPack);
            setPacks((prev) => prev.map((p) => (getPackKey(p) === targetKey ? { ...p, pack: updatedPack } : p)));
        } catch (e) {
            console.error("Failed to delete image", e);
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePack = (packToDelete: { id: string; roomId: string; pack: ImagePack }): void => {
        const displayName = packToDelete.pack.pack?.display_name || packToDelete.id;
        Modal.createDialog(QuestionDialog, {
            title: _t("action|delete"),
            description: (_t as any)("Are you sure you want to delete '%(displayName)s'?", { displayName }),
            button: _t("action|delete"),
            danger: true,
            onFinished: async (confirmed?: boolean) => {
                if (!confirmed) return;

                setLoading(true);
                try {
                    await ImagePackStore.instance.deleteRoomPack(packToDelete.roomId, packToDelete.id);
                    const targetKey = getPackKey(packToDelete);
                    setPacks((prev) => prev.filter((p) => getPackKey(p) !== targetKey));
                    setEditingPackKey((prev) => (prev === targetKey ? null : prev));
                } catch (e) {
                    console.error("Failed to delete pack", e);
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const activePack = packs.find((p) => getPackKey(p) === editingPackKey);

    return (
        <BaseDialog className="mx_ManageImagePacksDialog" onFinished={onFinished} title={"Manage Image Packs"}>
            <div className="mx_Dialog_content" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <p>{"Create and manage custom sticker and emoticon packs (MSC2545) for this room."}</p>

                <div style={{ display: "flex", gap: "16px", flex: 1, minHeight: "300px" }}>
                    {/* Left Sidebar: Pack List */}
                    <div
                        style={{
                            width: "30%",
                            borderRight: "1px solid var(--cpd-color-border-interactive-secondary)",
                            paddingRight: "8px",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "12px",
                            }}
                        >
                            <h4 style={{ margin: 0 }}>{"Packs"}</h4>
                            <AccessibleButton
                                kind="primary"
                                onClick={handleCreatePack}
                                disabled={loading}
                                style={{ padding: "4px 8px" }}
                            >
                                +
                            </AccessibleButton>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {packs.length === 0 && (
                                <span style={{ fontSize: "12px", color: "gray" }}>{"No packs created yet"}</span>
                            )}
                            {packs.map((p) => {
                                const key = getPackKey(p);
                                const isSelected = editingPackKey === key;
                                const isFromSpace = p.roomId !== room.roomId;
                                return (
                                    <AccessibleButton
                                        key={key}
                                        onClick={() => setEditingPackKey(key)}
                                        style={{
                                            padding: "8px",
                                            border: "1px solid var(--cpd-color-border-interactive-secondary)",
                                            borderRadius: "4px",
                                            background: isSelected
                                                ? "var(--cpd-color-bg-subtle-secondary)"
                                                : "transparent",
                                            cursor: "pointer",
                                            textAlign: "left",
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontWeight: isSelected ? 600 : 400,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }}
                                        >
                                            {p.pack.pack?.display_name || p.id}
                                        </div>
                                        {isFromSpace && (
                                            <div style={{ fontSize: "10px", color: "var(--cpd-color-text-secondary)" }}>
                                                From Space
                                            </div>
                                        )}
                                    </AccessibleButton>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Area: Pack Editor */}
                    <div style={{ width: "70%", paddingLeft: "8px", overflowY: "auto" }}>
                        {!activePack ? (
                            <p style={{ color: "gray" }}>{"Select a pack on the left or create a new one."}</p>
                        ) : (
                            <div key={getPackKey(activePack)}>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginBottom: "16px",
                                    }}
                                >
                                    <input
                                        type="text"
                                        defaultValue={activePack.pack.pack?.display_name || ""}
                                        key={getPackKey(activePack)}
                                        placeholder={activePack.id}
                                        onBlur={async (e) => {
                                            const newName = e.target.value.trim();
                                            if (newName && newName !== activePack.pack.pack?.display_name) {
                                                const updatedPack: ImagePack = {
                                                    ...activePack.pack,
                                                    pack: {
                                                        ...activePack.pack.pack,
                                                        display_name: newName,
                                                    },
                                                };
                                                await ImagePackStore.instance.createOrUpdateRoomPack(
                                                    activePack.roomId,
                                                    activePack.id,
                                                    updatedPack,
                                                );
                                                const targetKey = getPackKey(activePack);
                                                setPacks((prev) =>
                                                    prev.map((item) =>
                                                        getPackKey(item) === targetKey
                                                            ? { ...item, pack: updatedPack }
                                                            : item,
                                                    ),
                                                );
                                            }
                                        }}
                                        style={{
                                            fontSize: "16px",
                                            fontWeight: 600,
                                            padding: "4px 8px",
                                            border: "1px solid var(--cpd-color-border-interactive-secondary)",
                                            borderRadius: "4px",
                                            maxWidth: "220px",
                                        }}
                                    />
                                    <div>
                                        <input
                                            type="file"
                                            id={`upload-${activePack.id}`}
                                            style={{ display: "none" }}
                                            multiple
                                            accept="image/*"
                                            onChange={(e) => handleFileUpload(e, activePack)}
                                            disabled={loading}
                                        />
                                        <AccessibleButton
                                            kind="primary_outline"
                                            onClick={() => document.getElementById(`upload-${activePack.id}`)?.click()}
                                            disabled={loading}
                                            style={{ marginRight: "8px" }}
                                        >
                                            {"Add Images"}
                                        </AccessibleButton>
                                        <AccessibleButton
                                            kind="danger_outline"
                                            onClick={() => handleDeletePack(activePack)}
                                            disabled={loading}
                                        >
                                            {"Delete Pack"}
                                        </AccessibleButton>
                                    </div>
                                </div>

                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                                        gap: "12px",
                                    }}
                                >
                                    {Object.entries(activePack.pack.images || {}).map(([shortcode, image]) => {
                                        const src = mediaFromMxc(image.url).srcHttp;
                                        return (
                                            <div
                                                key={shortcode}
                                                style={{
                                                    position: "relative",
                                                    border: "1px solid #ddd",
                                                    padding: "4px",
                                                    borderRadius: "4px",
                                                    textAlign: "center",
                                                }}
                                            >
                                                {src && (
                                                    <img
                                                        src={src}
                                                        style={{
                                                            width: "100%",
                                                            aspectRatio: "1",
                                                            objectFit: "contain",
                                                        }}
                                                        alt={image.body || shortcode}
                                                    />
                                                )}
                                                <span
                                                    style={{
                                                        display: "block",
                                                        fontSize: "12px",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                    }}
                                                >
                                                    {shortcode}
                                                </span>
                                                <AccessibleButton
                                                    onClick={() => handleDeleteImage(activePack, shortcode)}
                                                    disabled={loading}
                                                    style={{
                                                        position: "absolute",
                                                        top: -5,
                                                        right: -5,
                                                        background: "red",
                                                        color: "white",
                                                        borderRadius: "50%",
                                                        width: "20px",
                                                        height: "20px",
                                                        lineHeight: "18px",
                                                        textAlign: "center",
                                                        cursor: "pointer",
                                                        fontSize: "12px",
                                                    }}
                                                >
                                                    &times;
                                                </AccessibleButton>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </BaseDialog>
    );
};

export default ManageImagePacksDialog;
