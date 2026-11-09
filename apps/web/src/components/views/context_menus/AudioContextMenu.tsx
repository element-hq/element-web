/*
Copyright 2026 foxberries

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useState } from "react";

import IconizedContextMenu, { IconizedContextMenuOptionList, IconizedContextMenuCheckbox } from "./IconizedContextMenu";
import { type IProps as IContextMenuProps } from "../../structures/ContextMenu";
import { _t } from "../../../languageHandler";
import type { SourceName } from "shared-types";
import type AudiofoxManager from "../../../audio/AudiofoxHook";

interface IAudioContextMenuSectionProps {
    /** The `AudiofoxManager` used to query Audiofox. */
    manager: AudiofoxManager;
    /** The `SourceName` of each selected `AudioSource`. */
    selection: SourceName[];
    /** Event that fires on source selection changes. */
    onSelection: React.Dispatch<React.SetStateAction<SourceName[]>>;
}

const AudioContextMenuSection: React.FC<IAudioContextMenuSectionProps> = ({ manager, selection, onSelection }) => {
    const [audioSources, setAudioSources] = useState<SourceName[]>([]);
    // Refresh selected sources on mount
    useEffect(() => {
        const listSources = async (): Promise<void> => {
            try {
                const sources = await manager.list();
                return setAudioSources(sources);
            } catch (e) {
                return console.error("Failed to list audio sources:", e);
            }
        };
        void listSources();
    }, [manager]);

    // Link selected sources to the manager
    useEffect(() => {
        manager.link(selection).catch((e) => {
            console.error("Failed to link to audio sources:", e);
        });
    }, [manager, selection]);

    // Toggle a given SourceName's selection status
    const onClick = (source: SourceName): void => {
        onSelection((sources) =>
            sources.includes(source) ? sources.filter((s) => s !== source) : [...sources, source],
        );
    };

    return (
        <IconizedContextMenuOptionList label={_t("voip|audio_sources")}>
            {audioSources.map((source) => {
                return (
                    <IconizedContextMenuCheckbox
                        key={source}
                        label={source}
                        active={selection.includes(source)}
                        onClick={() => onClick(source)}
                    />
                );
            })}
        </IconizedContextMenuOptionList>
    );
};

interface IProps extends IContextMenuProps, IAudioContextMenuSectionProps {}

const AudioContextMenu: React.FC<IProps> = ({ manager, selection, onSelection, ...props }) => {
    return (
        // AudioContextMenu shares styling with DeviceContextMenu, so use this class until needs differ
        <IconizedContextMenu compact className="mx_DeviceContextMenu" {...props}>
            <AudioContextMenuSection manager={manager} selection={selection} onSelection={onSelection} />
        </IconizedContextMenu>
    );
};

export default AudioContextMenu;
