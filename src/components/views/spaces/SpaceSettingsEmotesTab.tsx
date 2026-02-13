/*
I'm not sure if this is the right place for this file to be.
*/

import React, { useState, useCallback, useEffect, useRef } from "react";
import { type Room, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import SettingsTab from "../settings/tabs/SettingsTab";
import { SettingsSection } from "../settings/shared/SettingsSection";
import { mediaFromMxc } from "../../../customisations/Media";
import { EMOTE_EVENT_TYPE } from "../../../utils/space-emotes";

interface EmoteInfo {
    url: string;
}

type EmoteMap = Record<string, EmoteInfo>;

/**
 * Given a desired shortcode and an existing emote map, returns a unique shortcode.
 * If "coolface" exists, returns "coolface-2", then "coolface-3", etc.
 */
function uniqueShortcode(base: string, existing: EmoteMap): string {
    if (!(base in existing)) return base;
    let n = 2;
    while (`${base}-${n}` in existing) n++;
    return `${base}-${n}`;
}

/**
 * Derive a shortcode from a filename by stripping the extension
 * and replacing non-alphanumeric characters with hyphens.
 */
function shortcodeFromFilename(filename: string): string {
    const name = filename.replace(/\.[^.]+$/, "");
    return name.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

interface EmoteRowProps {
    shortcode: string;
    url: string;
    canEdit: boolean;
    onDelete: (shortcode: string) => void;
    onRename: (oldShortcode: string, newShortcode: string) => void;
}

const EmoteRow: React.FC<EmoteRowProps> = ({ shortcode, url, canEdit, onDelete, onRename }) => {
    const httpUrl = mediaFromMxc(url).getSquareThumbnailHttp(32) ?? undefined;
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(shortcode);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing]);

    const commitRename = useCallback(() => {
        setEditing(false);
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== shortcode) {
            onRename(shortcode, trimmed);
        } else {
            setEditValue(shortcode);
        }
    }, [editValue, shortcode, onRename]);

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter") {
                commitRename();
            } else if (e.key === "Escape") {
                setEditValue(shortcode);
                setEditing(false);
            }
        },
        [commitRename, shortcode],
    );

    return (
        <div className="mx_SpaceSettingsEmotesTab_emoteRow">
            <img
                className="mx_SpaceSettingsEmotesTab_emoteImage"
                src={httpUrl}
                alt={shortcode}
                width={32}
                height={32}
            />
            {editing ? (
                <span className="mx_SpaceSettingsEmotesTab_shortcode mx_SpaceSettingsEmotesTab_shortcode_editing">:<input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                    onBlur={commitRename}
                    onKeyDown={onKeyDown}
                    className="mx_SpaceSettingsEmotesTab_shortcodeEditInput"
                />:</span>
            ) : (
                <span
                    className={`mx_SpaceSettingsEmotesTab_shortcode ${canEdit ? "mx_SpaceSettingsEmotesTab_shortcode_editable" : ""}`}
                    onClick={canEdit ? () => setEditing(true) : undefined}
                    title={canEdit ? _t("custom_emotes|click_to_rename") : undefined}
                >
                    :{shortcode}:
                </span>
            )}
            {canEdit && (
                <AccessibleButton
                    kind="danger_outline"
                    onClick={() => onDelete(shortcode)}
                    className="mx_SpaceSettingsEmotesTab_deleteButton"
                >
                    {_t("action|delete")}
                </AccessibleButton>
            )}
        </div>
    );
};

interface IProps {
    matrixClient: MatrixClient;
    space: Room;
}

const SpaceSettingsEmotesTab: React.FC<IProps> = ({ matrixClient: cli, space }) => {
    const userId = cli.getUserId()!;
    const canEdit = space.currentState.maySendStateEvent(EMOTE_EVENT_TYPE, userId);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const [emotes, setEmotes] = useState<EmoteMap>(() => {
        const event = space.currentState.getStateEvents(EMOTE_EVENT_TYPE, "");
        return (event?.getContent()?.images as EmoteMap) ?? {};
    });

    useEffect(() => {
        const onStateEvent = (): void => {
            const event = space.currentState.getStateEvents(EMOTE_EVENT_TYPE, "");
            setEmotes((event?.getContent()?.images as EmoteMap) ?? {});
        };
        space.on("RoomState.events" as any, onStateEvent);
        return () => {
            space.off("RoomState.events" as any, onStateEvent);
        };
    }, [space]);

    const onAddEmoteClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const onFileSelected = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            // Reset file input so the same file can be selected again
            e.target.value = "";

            const baseShortcode = shortcodeFromFilename(file.name);
            if (!baseShortcode) return;

            const shortcode = uniqueShortcode(baseShortcode, emotes);

            setUploading(true);
            try {
                const { content_uri: mxcUrl } = await cli.uploadContent(file);
                const newImages = { ...emotes, [shortcode]: { url: mxcUrl } };
                await cli.sendStateEvent(space.roomId, EMOTE_EVENT_TYPE as any, { images: newImages }, "");
                setEmotes(newImages);
            } catch (e) {
                logger.error("Failed to add emote:", e);
            } finally {
                setUploading(false);
            }
        },
        [cli, space.roomId, emotes],
    );

    const onDeleteEmote = useCallback(
        async (shortcode: string) => {
            try {
                const newImages = { ...emotes };
                delete newImages[shortcode];
                await cli.sendStateEvent(space.roomId, EMOTE_EVENT_TYPE as any, { images: newImages }, "");
                setEmotes(newImages);
            } catch (e) {
                logger.error("Failed to delete emote:", e);
            }
        },
        [cli, space.roomId, emotes],
    );

    const onRenameEmote = useCallback(
        async (oldShortcode: string, newShortcode: string) => {
            if (oldShortcode === newShortcode) return;

            // Ensure uniqueness for the new name
            const finalShortcode = uniqueShortcode(newShortcode, emotes);

            try {
                const newImages = { ...emotes };
                const info = newImages[oldShortcode];
                delete newImages[oldShortcode];
                newImages[finalShortcode] = info;
                await cli.sendStateEvent(space.roomId, EMOTE_EVENT_TYPE as any, { images: newImages }, "");
                setEmotes(newImages);
            } catch (e) {
                logger.error("Failed to rename emote:", e);
            }
        },
        [cli, space.roomId, emotes],
    );

    const shortcodes = Object.keys(emotes);

    return (
        <SettingsTab>
            <SettingsSection heading={_t("custom_emotes|title")}>
                <div className="mx_SpaceSettingsEmotesTab_description">
                    {_t("custom_emotes|description")}
                </div>

                <div className="mx_SpaceSettingsEmotesTab_emoteList">
                    {shortcodes.length === 0 && (
                        <div className="mx_SpaceSettingsEmotesTab_noEmotes">
                            {_t("custom_emotes|no_emotes")}
                        </div>
                    )}
                    {shortcodes.map((code) => (
                        <EmoteRow
                            key={code}
                            shortcode={code}
                            url={emotes[code].url}
                            canEdit={canEdit}
                            onDelete={onDeleteEmote}
                            onRename={onRenameEmote}
                        />
                    ))}
                </div>

                {canEdit && (
                    <>
                        <AccessibleButton kind="primary" onClick={onAddEmoteClick} disabled={uploading}>
                            {uploading ? _t("custom_emotes|uploading") : _t("custom_emotes|add_emote")}
                        </AccessibleButton>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={onFileSelected}
                            className="mx_SpaceSettingsEmotesTab_fileInput"
                        />
                    </>
                )}
            </SettingsSection>
        </SettingsTab>
    );
};

export default SpaceSettingsEmotesTab;
