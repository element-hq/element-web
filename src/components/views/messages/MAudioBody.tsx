/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { type IContent } from "matrix-js-sdk/src/matrix";
import { type MediaEventContent } from "matrix-js-sdk/src/types";

import { type Playback } from "../../../audio/Playback";
import InlineSpinner from "../elements/InlineSpinner";
import { _t } from "../../../languageHandler";
import AudioPlayer from "../audio_messages/AudioPlayer";
import MFileBody from "./MFileBody";
import { type IBodyProps } from "./IBodyProps";
import { PlaybackManager } from "../../../audio/PlaybackManager";
import { isVoiceMessage } from "../../../utils/EventUtils";
import { PlaybackQueue } from "../../../audio/PlaybackQueue";
import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";
import MediaProcessingError from "./shared/MediaProcessingError";

interface IState {
    error?: boolean;
    playback?: Playback;
}

export default class MAudioBody extends React.PureComponent<IBodyProps, IState> {
    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    public state: IState = {};

    public async componentDidMount(): Promise<void> {
        let buffer: ArrayBuffer;

        try {
            try {
                const blob = await this.props.mediaEventHelper!.sourceBlob.value;
                buffer = await blob.arrayBuffer();
            } catch (e) {
                this.setState({ error: true });
                logger.warn("Unable to decrypt audio message", e);
                return; // stop processing the audio file
            }
        } catch (e) {
            this.setState({ error: true });
            logger.warn("Unable to decrypt/download audio message", e);
            return; // stop processing the audio file
        }

        // We should have a buffer to work with now: let's set it up

        // Note: we don't actually need a waveform to render an audio event, but voice messages do.
        const content = this.props.mxEvent.getContent<MediaEventContent & IContent>();
        const waveform = content?.["org.matrix.msc1767.audio"]?.waveform?.map((p: number) => p / 1024);

        // We should have a buffer to work with now: let's set it up
        const playback = PlaybackManager.instance.createPlaybackInstance(buffer, waveform);
        playback.clockInfo.populatePlaceholdersFrom(this.props.mxEvent);
        this.setState({ playback });

        if (isVoiceMessage(this.props.mxEvent)) {
            PlaybackQueue.forRoom(this.props.mxEvent.getRoomId()!).unsortedEnqueue(this.props.mxEvent, playback);
        }

        // Note: the components later on will handle preparing the Playback class for us.
    }

    public componentWillUnmount(): void {
        this.state.playback?.destroy();
    }

    protected get showFileBody(): boolean {
        return (
            this.context.timelineRenderingType !== TimelineRenderingType.Room &&
            this.context.timelineRenderingType !== TimelineRenderingType.Pinned &&
            this.context.timelineRenderingType !== TimelineRenderingType.Search
        );
    }

    public render(): React.ReactNode {
        if (this.state.error) {
            return (
                <MediaProcessingError className="mx_MAudioBody">
                    {_t("timeline|m.audio|error_processing_audio")}
                </MediaProcessingError>
            );
        }

        if (this.props.forExport) {
            const content = this.props.mxEvent.getContent();
            // During export, the content url will point to the MSC, which will later point to a local url
            const contentUrl = content.file?.url || content.url;
            return (
                <span className="mx_MAudioBody">
                    <audio src={contentUrl} controls />
                </span>
            );
        }

        if (!this.state.playback) {
            return (
                <span className="mx_MAudioBody">
                    <InlineSpinner />
                </span>
            );
        }

        // At this point we should have a playable state
        return (
            <span className="mx_MAudioBody">
                <AudioPlayer playback={this.state.playback} mediaName={this.props.mxEvent.getContent().body} />
                {this.showFileBody && <MFileBody {...this.props} showGenericPlaceholder={false} />}
            </span>
        );
    }
}
