/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { useState, useEffect, useCallback } from "react";
import { type Room, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import SettingsTab from "../settings/tabs/SettingsTab";
import { SettingsSection } from "../settings/shared/SettingsSection";
import { ImagePackStore, type ImagePack } from "../../../stores/image-packs/ImagePackStore";
import { mediaFromMxc } from "../../../customisations/Media";
import Modal from "../../../Modal";
import QuestionDialog from "../dialogs/QuestionDialog";

interface IProps {
    matrixClient: MatrixClient;
    space: Room;
}

export const SpaceSettingsStickersTab: React.FC<IProps> = ({ matrixClient: cli, space }) => {
    const [packs, setPacks] = useState<{ id: string; pack: ImagePack }[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingPackId, setEditingPackId] = useState<string | null>(null);

    const userId = cli.getUserId()!;
    const canManage =
        space.currentState.maySendStateEvent("m.room.image_pack", userId) ||
        space.currentState.maySendStateEvent("im.ponies.room_emotes", userId);

    const loadPacks = useCallback((): void => {
        const store = ImagePackStore.instance;
        const roomPacks = store.getRoomImagePacks(space.roomId);
        // Only show packs that belong directly to this space room
        const directSpacePacks = roomPacks.filter((p) => p.roomId === space.roomId);
        setPacks(directSpacePacks);
        setEditingPackId((prev) => {
            if (prev && directSpacePacks.some((p) => p.id === prev)) {
                return prev;
            }
            return directSpacePacks[0]?.id || null;
        });
    }, [space.roomId]);

    useEffect(() => {
        loadPacks();
    }, [loadPacks]);

    const handleCreatePack = async (): Promise<void> => {
        if (!canManage) return;
        setLoading(true);
        try {
            const store = ImagePackStore.instance;
            const newPackId = "pack_" + Date.now();
            const newPack: ImagePack = {
                images: {},
                pack: {
                    display_name: "New Space Pack",
                    usage: ["sticker", "emoticon"],
                },
            };
            await store.createOrUpdateRoomPack(space.roomId, newPackId, newPack);
            setPacks((prev) => [...prev, { id: newPackId, pack: newPack }]);
            setEditingPackId(newPackId);
        } catch (e) {
            console.error("Failed to create pack in space", e);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, packId: string): Promise<void> => {
        const files = event.target.files;
        if (!files || files.length === 0 || !canManage) return;

        setLoading(true);
        try {
            const store = ImagePackStore.instance;
            const currentPackData = packs.find((p) => p.id === packId)?.pack;
            if (!currentPackData) return;

            const updatedImages = { ...currentPackData.images };

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const uploadPromise = cli.uploadContent(file, {
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
                ...currentPackData,
                images: updatedImages,
            };

            await store.createOrUpdateRoomPack(space.roomId, packId, updatedPack);
            setPacks((prev) => prev.map((p) => (p.id === packId ? { ...p, pack: updatedPack } : p)));
        } catch (e) {
            console.error("Failed to upload image to space pack", e);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteImage = async (packId: string, shortcode: string): Promise<void> => {
        if (!canManage) return;
        setLoading(true);
        try {
            const store = ImagePackStore.instance;
            const currentPackData = packs.find((p) => p.id === packId)?.pack;
            if (!currentPackData) return;

            const updatedImages = { ...currentPackData.images };
            delete updatedImages[shortcode];

            const updatedPack: ImagePack = {
                ...currentPackData,
                images: updatedImages,
            };

            await store.createOrUpdateRoomPack(space.roomId, packId, updatedPack);
            setPacks((prev) => prev.map((p) => (p.id === packId ? { ...p, pack: updatedPack } : p)));
        } catch (e) {
            console.error("Failed to delete image from space pack", e);
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePack = (packId: string): void => {
        if (!canManage) return;
        const packToDelete = packs.find((p) => p.id === packId);
        if (!packToDelete) return;

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
                    await ImagePackStore.instance.deleteRoomPack(space.roomId, packId);
                    setPacks((prev) => prev.filter((p) => p.id !== packId));
                    setEditingPackId((prev) => (prev === packId ? null : prev));
                } catch (e) {
                    console.error("Failed to delete space pack", e);
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const handleRenamePack = async (packId: string, newName: string): Promise<void> => {
        if (!canManage) return;
        const currentPackData = packs.find((p) => p.id === packId)?.pack;
        if (!currentPackData || currentPackData.pack?.display_name === newName) return;

        const updatedPack: ImagePack = {
            ...currentPackData,
            pack: {
                ...currentPackData.pack,
                display_name: newName,
            },
        };

        await ImagePackStore.instance.createOrUpdateRoomPack(space.roomId, packId, updatedPack);
        setPacks((prev) => prev.map((p) => (p.id === packId ? { ...p, pack: updatedPack } : p)));
    };

    const activePack = packs.find((p) => p.id === editingPackId);

    return (
        <SettingsTab>
            <SettingsSection
                heading="Space Image Packs (MSC2545)"
                subHeading="Manage sticker and emoticon packs for this space. All rooms and nested sub-spaces within this space will inherit these packs automatically."
            >
                {!canManage && (
                    <div
                        style={{
                            padding: "8px 12px",
                            background: "var(--cpd-color-bg-subtle-secondary)",
                            borderRadius: "6px",
                            marginBottom: "16px",
                            color: "var(--cpd-color-text-secondary)",
                        }}
                    >
                        {"You do not have permission to modify sticker packs in this space."}
                    </div>
                )}

                <div
                    style={{
                        display: "flex",
                        gap: "16px",
                        minHeight: "320px",
                        border: "1px solid var(--cpd-color-border-interactive-secondary)",
                        borderRadius: "8px",
                        padding: "12px",
                    }}
                >
                    {/* Left Sidebar: Pack list */}
                    <div
                        style={{
                            width: "30%",
                            borderRight: "1px solid var(--cpd-color-border-interactive-secondary)",
                            paddingRight: "12px",
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
                            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>Packs ({packs.length})</h4>
                            {canManage && (
                                <AccessibleButton
                                    kind="primary"
                                    onClick={handleCreatePack}
                                    disabled={loading}
                                    style={{ padding: "2px 8px", fontSize: "14px" }}
                                    title="Create new pack"
                                >
                                    +
                                </AccessibleButton>
                            )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {packs.length === 0 && (
                                <span style={{ fontSize: "12px", color: "var(--cpd-color-text-secondary)" }}>
                                    No packs in this space yet.
                                </span>
                            )}
                            {packs.map((p) => {
                                const count = Object.keys(p.pack.images || {}).length;
                                return (
                                    <AccessibleButton
                                        key={p.id}
                                        onClick={() => setEditingPackId(p.id)}
                                        style={{
                                            padding: "8px 10px",
                                            border: "1px solid var(--cpd-color-border-interactive-secondary)",
                                            borderRadius: "6px",
                                            background:
                                                editingPackId === p.id
                                                    ? "var(--cpd-color-bg-subtle-secondary)"
                                                    : "transparent",
                                            cursor: "pointer",
                                            textAlign: "left",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontWeight: editingPackId === p.id ? 600 : 400,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {p.pack.pack?.display_name || p.id}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: "11px",
                                                color: "var(--cpd-color-text-secondary)",
                                                background: "var(--cpd-color-bg-subtle-primary)",
                                                padding: "2px 6px",
                                                borderRadius: "10px",
                                                marginLeft: "8px",
                                            }}
                                        >
                                            {count}
                                        </span>
                                    </AccessibleButton>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Panel: Active Pack Editor */}
                    <div style={{ width: "70%", paddingLeft: "12px", display: "flex", flexDirection: "column" }}>
                        {!activePack ? (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    height: "100%",
                                    color: "var(--cpd-color-text-secondary)",
                                }}
                            >
                                Select a pack on the left or create a new one.
                            </div>
                        ) : (
                            <div>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginBottom: "16px",
                                        flexWrap: "wrap",
                                        gap: "8px",
                                    }}
                                >
                                    <div>
                                        {canManage ? (
                                            <input
                                                type="text"
                                                defaultValue={activePack.pack.pack?.display_name || ""}
                                                key={activePack.id}
                                                placeholder={activePack.id}
                                                onBlur={(e) => handleRenamePack(activePack.id, e.target.value.trim())}
                                                style={{
                                                    fontSize: "16px",
                                                    fontWeight: 600,
                                                    padding: "4px 8px",
                                                    border: "1px solid var(--cpd-color-border-interactive-secondary)",
                                                    borderRadius: "4px",
                                                    maxWidth: "240px",
                                                }}
                                            />
                                        ) : (
                                            <h3 style={{ margin: 0, fontSize: "16px" }}>
                                                {activePack.pack.pack?.display_name || activePack.id}
                                            </h3>
                                        )}
                                        <div
                                            style={{
                                                fontSize: "12px",
                                                color: "var(--cpd-color-text-secondary)",
                                                marginTop: "4px",
                                            }}
                                        >
                                            ID: <code>{activePack.id}</code> &bull;{" "}
                                            {Object.keys(activePack.pack.images || {}).length} stickers
                                        </div>
                                    </div>

                                    {canManage && (
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <input
                                                type="file"
                                                id={`space-upload-${activePack.id}`}
                                                style={{ display: "none" }}
                                                multiple
                                                accept="image/*"
                                                onChange={(e) => handleFileUpload(e, activePack.id)}
                                                disabled={loading}
                                            />
                                            <AccessibleButton
                                                kind="primary_outline"
                                                onClick={() =>
                                                    document.getElementById(`space-upload-${activePack.id}`)?.click()
                                                }
                                                disabled={loading}
                                                style={{ padding: "6px 12px", borderRadius: "6px" }}
                                            >
                                                Add Images
                                            </AccessibleButton>
                                            <AccessibleButton
                                                kind="danger_outline"
                                                onClick={() => handleDeletePack(activePack.id)}
                                                disabled={loading}
                                                style={{ padding: "6px 12px", borderRadius: "6px" }}
                                            >
                                                Delete Pack
                                            </AccessibleButton>
                                        </div>
                                    )}
                                </div>

                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                                        gap: "10px",
                                        maxHeight: "360px",
                                        overflowY: "auto",
                                        padding: "4px",
                                    }}
                                >
                                    {Object.entries(activePack.pack.images || {}).map(([shortcode, image]) => {
                                        const src = mediaFromMxc(image.url).srcHttp;
                                        return (
                                            <div
                                                key={shortcode}
                                                style={{
                                                    position: "relative",
                                                    border: "1px solid var(--cpd-color-border-interactive-secondary)",
                                                    padding: "6px",
                                                    borderRadius: "6px",
                                                    textAlign: "center",
                                                    background: "var(--cpd-color-bg-subtle-secondary)",
                                                }}
                                            >
                                                {src ? (
                                                    <img
                                                        src={src}
                                                        style={{
                                                            width: "100%",
                                                            aspectRatio: "1",
                                                            objectFit: "contain",
                                                            display: "block",
                                                        }}
                                                        alt={image.body || shortcode}
                                                    />
                                                ) : (
                                                    <div
                                                        style={{
                                                            width: "100%",
                                                            aspectRatio: "1",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                        }}
                                                    >
                                                        🖼️
                                                    </div>
                                                )}
                                                <span
                                                    style={{
                                                        display: "block",
                                                        fontSize: "11px",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        marginTop: "4px",
                                                    }}
                                                    title={shortcode}
                                                >
                                                    {shortcode}
                                                </span>
                                                {canManage && (
                                                    <AccessibleButton
                                                        onClick={() => handleDeleteImage(activePack.id, shortcode)}
                                                        disabled={loading}
                                                        style={{
                                                            position: "absolute",
                                                            top: -4,
                                                            right: -4,
                                                            background: "var(--cpd-color-icon-critical)",
                                                            color: "white",
                                                            borderRadius: "50%",
                                                            width: "18px",
                                                            height: "18px",
                                                            lineHeight: "16px",
                                                            textAlign: "center",
                                                            cursor: "pointer",
                                                            fontSize: "12px",
                                                            padding: 0,
                                                        }}
                                                        title="Delete sticker"
                                                    >
                                                        &times;
                                                    </AccessibleButton>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </SettingsSection>
        </SettingsTab>
    );
};

export default SpaceSettingsStickersTab;
