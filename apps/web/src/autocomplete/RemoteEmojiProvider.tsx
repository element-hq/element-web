/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import React from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import AutocompleteProvider from "./AutocompleteProvider";
import { PillCompletion } from "./Components";
import { type ICompletion, type ISelectionRange } from "./Autocompleter";
import SettingsStore from "../settings/SettingsStore";
import {
    loadRemoteStickerIndex,
    stickerName,
    stickerPreviewUrl,
    stickerSearchText,
    type RemoteSticker,
    type RemoteStickerIndex,
} from "../features/remote-stickers/RemoteStickerIndex";
import { type TimelineRenderingType } from "../contexts/RoomContext";
import { getPersonalEmojiPacks } from "../features/personal-emoji/PersonalEmojiPacks";

// Cloud suggestions follow Spark's trigger rules: Chinese keywords can be
// entered directly, while Latin keywords need two characters unless the user
// explicitly starts a :shortcode query.
const REMOTE_EMOJI_REGEX = /(?:^|\s)(?::)?[\p{L}\p{N}_+-]+:?$/gu;
const MAX_RESULTS = 20;

export function getRemoteEmojiSearchTerm(
    command: string | undefined
): string | undefined {
    const source = command?.trim() ?? "";
    const explicitShortcode = source.startsWith(":");
    const term = source.replace(/^:/, "").replace(/:$/, "").trim();
    if (!term) return undefined;

    if (/\p{Script=Han}/u.test(term)) return term;
    if (explicitShortcode) return term;
    return /^[A-Za-z]+$/.test(term) && term.length >= 2 ? term : undefined;
}

export default class RemoteEmojiProvider extends AutocompleteProvider {
    private index?: RemoteStickerIndex;
    private loadingIndex?: Promise<void>;

    public constructor(
        private readonly room: Room,
        renderingType?: TimelineRenderingType
    ) {
        super({ commandRegex: REMOTE_EMOJI_REGEX, renderingType });
        // Start warming as the composer opens, so the first meaningful query
        // normally has results without delaying any other provider.
        this.ensureIndexLoaded();
    }

    private ensureIndexLoaded(): void {
        if (this.index || this.loadingIndex) return;
        this.loadingIndex = loadRemoteStickerIndex()
            .then((index) => {
                this.index = index;
            })
            .catch(() => undefined)
            .finally(() => {
                this.loadingIndex = undefined;
            });
    }

    public async getCompletions(
        query: string,
        selection: ISelectionRange,
        force?: boolean,
        limit = -1
    ): Promise<ICompletion[]> {
        if (!SettingsStore.getValue("MessageComposerInput.suggestEmoji")) {
            return [];
        }

        const { command, range } = this.getCurrentCommand(
            query,
            selection,
            force
        );
        const term = getRemoteEmojiSearchTerm(command?.[0]);
        if (!term || !range) return [];

        // Autocompleter waits for every provider before displaying anything.
        // Prime the remote index without delaying mention, command and normal
        // emoji completion; the following input event uses the warm index.
        this.ensureIndexLoaded();
        const personalItems: RemoteSticker[] = getPersonalEmojiPacks(
            this.room.client
        )
            .flatMap((pack) => pack.items)
            .filter((item) => item.usage.includes("emoticon"))
            .map((item) => ({
                id: item.id,
                packId: item.packId,
                name: item.shortcode,
                fileName: item.shortcode,
                keywords: item.keywords,
                mxc: item.url.startsWith("mxc://") ? item.url : undefined,
                url: item.url.startsWith("mxc://") ? undefined : item.url,
                mimeType:
                    typeof item.info?.mimetype === "string"
                        ? item.info.mimetype
                        : undefined,
            }));
        const items: RemoteSticker[] = [
            ...personalItems,
            ...(this.index?.items ?? []),
        ];
        if (items.length === 0) return [];

        const normalizedTerm = term.toLocaleLowerCase();
        const resultLimit =
            limit < 0 ? MAX_RESULTS : Math.min(limit, MAX_RESULTS);
        return items
            .filter((item) => stickerPreviewUrl(item, this.room.client))
            .filter((item) => stickerSearchText(item).includes(normalizedTerm))
            .slice(0, resultLimit)
            .map((item) => {
                const name = stickerName(item);
                const previewUrl = stickerPreviewUrl(item, this.room.client);
                return {
                    type: "remote-emoticon" as const,
                    completion: `:${name}:`,
                    remoteSticker: item,
                    range,
                    component: (
                        <PillCompletion
                            title={`:${name}:`}
                            aria-label={`云端表情 ${name}`}
                        >
                            <img
                                src={previewUrl}
                                alt=""
                                width={26}
                                height={26}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                style={{ objectFit: "contain" }}
                            />
                        </PillCompletion>
                    ),
                };
            });
    }

    public getName(): string {
        return "云端表情";
    }

    public renderCompletions(completions: React.ReactNode[]): React.ReactNode {
        return (
            <div className="mx_Autocomplete_Completion_container_pill">
                {completions}
            </div>
        );
    }
}
