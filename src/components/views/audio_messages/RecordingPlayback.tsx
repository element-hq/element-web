/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { RelationType, MsgType } from "matrix-js-sdk/src/matrix";
import classnames from "classnames";

import PlayPauseButton from "./PlayPauseButton";
import AccessibleButton from "../elements/AccessibleButton";
import PlaybackClock from "./PlaybackClock";
import AudioPlayerBase, { type IProps as IAudioPlayerBaseProps } from "./AudioPlayerBase";
import SeekBar from "./SeekBar";
import PlaybackWaveform from "./PlaybackWaveform";
import { PlaybackState } from "../../../audio/Playback";
import { _t } from "../../../languageHandler";

export enum PlaybackLayout {
    /**
     * Clock on the left side of a waveform, without seek bar.
     */
    Composer,

    /**
     * Clock on the right side of a waveform, with an added seek bar.
     */
    Timeline,
}

interface IProps extends IAudioPlayerBaseProps {
    layout?: PlaybackLayout; // Defaults to Timeline layout
    mxEvent?: MatrixEvent; // Matrix event containing the voice message
}

interface State {
    playbackPhase: PlaybackState;
    showSummary: boolean;
    showTranscript: boolean;
    transcript?: string;
    transcriptEventId?: string;
    isRefinedTranscript: boolean;
    summary?: string;
}

export default class RecordingPlayback extends AudioPlayerBase<IProps, State> {
    constructor(props: IProps) {
        super(props);
        this.state = {
            playbackPhase: PlaybackState.Stopped,
            showSummary: false,
            showTranscript: false,
            transcript: undefined,
            isRefinedTranscript: false,
            summary: undefined,
        };
    }

    private handleSummaryToggle = async () => {
        const { mxEvent } = this.props;
        if (!mxEvent) return;

        this.setState((prevState) => ({
            showSummary: !prevState.showSummary,
            showTranscript: false, // Hide transcript when showing summary
        }));

        if (!this.state.summary) {
            try {
                const room = MatrixClientPeg.safeGet().getRoom(mxEvent.getRoomId());
                if (!room) {
                    console.error("[RecordingPlayback] Room not found");
                    this.setState({ summary: "Room not found" });
                    return;
                }

                const cli = MatrixClientPeg.safeGet();

                try {
                    // First check if we already have a summary
                    this.updateSummary();
                    
                    // If no summary found after checking, trigger generation
                    if (!this.state.summary || this.state.summary === "Generating summary...") {
                        this.setState({ summary: "Generating summary..." });

                        // Use the room and event IDs to construct our request
                        const roomId = mxEvent.getRoomId();
                        
                        // Prepare the request body with our parameters
                        const requestBody = {
                            language: "en",
                            reference_event_id: mxEvent.getId(),
                        };
                        console.log(`[RecordingPlayback] Request body:`, requestBody);
                        
                        // When using authedRequest, we leave out the `_synapse` prefix and configure it with options
                        if (!this.state.transcriptEventId) {
                            console.error("[RecordingPlayback] No transcript available to summarize");
                            this.setState({ summary: "No transcript available to summarize" });
                            return;
                        }
                        const path = `/client/v1/rooms/${roomId}/event/${this.state.transcriptEventId}/summarize`;
                        console.log(`[RecordingPlayback] API path: ${path} (with /_synapse prefix)`);
                        
                        // This call will use the client's CORS settings and authentication
                        const response = await cli.http.authedRequest(
                            "POST", // Use POST method
                            path, // Path without _synapse prefix - it's added by the option
                            undefined, // No query params for POST
                            requestBody, // Request body with parameters
                            {
                                prefix: "/_synapse", // Add _synapse prefix to the path
                                useAuthorizationHeader: true,
                            },
                        );
                        console.log(`[RecordingPlayback] Summary generation response:`, response);
                        
                        // The summary will be delivered as a Matrix event, no need to handle the response
                    }
                } catch (error) {
                    console.error("[RecordingPlayback] Failed to request summary:", error);
                    this.setState({ summary: "Failed to request summary" });
                }
            } catch (error) {
                console.error("[RecordingPlayback] Failed to fetch summary:", error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.setState({ summary: `Failed to load summary: ${errorMessage}` });
            }
        }
    };

    private updateSummary = () => {
        const { mxEvent } = this.props;
        if (!mxEvent) return;

        const room = MatrixClientPeg.safeGet().getRoom(mxEvent.getRoomId());
        const summaryEvents = room
            ?.getUnfilteredTimelineSet()
            .getLiveTimeline()
            .getEvents()
            .filter(
                (e) =>
                    e.getRelation()?.event_id === mxEvent.getId() &&
                    e.getRelation()?.rel_type === RelationType.Reference &&
                    e.getContent().msgtype === MsgType.Summary,
            );

        if (summaryEvents?.length) {
            // Use the latest summary event
            const summaryEvent = summaryEvents[summaryEvents.length - 1];
            const summary = summaryEvent.getContent().body;
            if (summary && this.state.summary !== summary) {
                this.setState({ summary });
            }
        }
    };

    private updateTranscript = () => {
        const { mxEvent } = this.props;
        if (!mxEvent) return;

        const room = MatrixClientPeg.safeGet().getRoom(mxEvent.getRoomId());
        const transcripts = room
            ?.getUnfilteredTimelineSet()
            .getLiveTimeline()
            .getEvents()
            .filter(
                (e) =>
                    e.getRelation()?.event_id === mxEvent.getId() &&
                    e.getRelation()?.rel_type === RelationType.Reference &&
                    (e.getContent().msgtype === MsgType.RefinedSTT || e.getContent().msgtype === MsgType.RawSTT),
            );

        // Always prefer refined over raw transcript regardless of timestamp
        const refined = transcripts?.find((e) => e.getContent().msgtype === MsgType.RefinedSTT);
        const raw = transcripts?.find((e) => e.getContent().msgtype === MsgType.RawSTT);

        // Always prefer refined over raw transcript as per MsgType.RefinedSTT vs MsgType.RawSTT precedence
        const newTranscript =
            refined?.getContent()?.body || raw?.getContent()?.body || mxEvent.getContent()?.transcript;
        const isRefined = refined !== undefined;
        const transcriptEventId = (refined || raw)?.getId();
        
        if (this.state.transcript !== newTranscript || 
            this.state.isRefinedTranscript !== isRefined ||
            this.state.transcriptEventId !== transcriptEventId) {
            this.setState({
                transcript: newTranscript,
                transcriptEventId,
                isRefinedTranscript: isRefined,
            });
        }
    };

    public componentDidMount(): void {
        super.componentDidMount?.();
        const { mxEvent } = this.props;
        if (mxEvent) {
            const room = MatrixClientPeg.safeGet().getRoom(mxEvent.getRoomId());
            room?.on("Room.timeline", this.onTimelineUpdate);
            this.updateTranscript();
            this.updateSummary();
        }
    }

    public componentWillUnmount(): void {
        super.componentWillUnmount?.();
        const { mxEvent } = this.props;
        if (mxEvent) {
            const room = MatrixClientPeg.safeGet().getRoom(mxEvent.getRoomId());
            room?.removeListener("Room.timeline", this.onTimelineUpdate);
        }
    }

    private onTimelineUpdate = (event: MatrixEvent) => {
        const { mxEvent } = this.props;
        if (!mxEvent) return;

        // Log all timeline events for debugging
        console.log("[RecordingPlayback] Timeline event:", {
            type: event.getType(),
            msgtype: event.getContent().msgtype,
            content: event.getContent(),
            relation: event.getRelation(),
        });

        // Update if this is a transcript or summary event related to our voice message
        if (
            event.getRelation()?.event_id === mxEvent.getId() &&
            event.getRelation()?.rel_type === RelationType.Reference
        ) {
            const msgType = event.getContent().msgtype;
            if (msgType === MsgType.RefinedSTT || msgType === MsgType.RawSTT) {
                console.log(
                    "[RecordingPlayback] Timeline update - Transcript event:",
                    "type:",
                    msgType,
                    "content:",
                    event.getContent().body,
                    "related to:",
                    event.getRelation()?.event_id,
                );
                this.updateTranscript();
            } else if (msgType === MsgType.Summary) {
                console.log(
                    "[RecordingPlayback] Timeline update - Summary event:",
                    "content:",
                    event.getContent().body,
                    "related to:",
                    event.getRelation()?.event_id,
                );
                this.updateSummary();
            }
        }
    };

    private handleTranscriptToggle = () => {
        this.setState((prevState) => ({
            showTranscript: !prevState.showTranscript,
            showSummary: false, // Hide summary when showing transcript
        }));
    };

    // This component is rendered in two ways: the composer and timeline. They have different
    // rendering properties (specifically the difference of a waveform or not).

    private renderComposerLook(): ReactNode {
        return (
            <div className="mx_RecordingPlayback_container">
                <div className="mx_RecordingPlayback_mainContent">
                    <PlayPauseButton
                        playback={this.props.playback}
                        playbackPhase={this.state.playbackPhase}
                        ref={this.playPauseRef}
                    />
                    <PlaybackWaveform playback={this.props.playback} />
                    <PlaybackClock playback={this.props.playback} />
                </div>
            </div>
        );
    }

    private renderTimelineLook(): ReactNode {
        return (
            <div className="mx_RecordingPlayback_container">
                <div className="mx_RecordingPlayback_mainContent">
                    <PlayPauseButton
                        playback={this.props.playback}
                        playbackPhase={this.state.playbackPhase}
                        ref={this.playPauseRef}
                    />
                    <div className="mx_RecordingPlayback_timelineLayoutMiddle">
                        <PlaybackWaveform playback={this.props.playback} />
                        <SeekBar
                            playback={this.props.playback}
                            tabIndex={0} // allow keyboard users to fall into the seek bar
                            disabled={this.state.playbackPhase === PlaybackState.Decoding}
                            ref={this.seekRef}
                        />
                    </div>
                    <PlaybackClock playback={this.props.playback} />
                    <div className="mx_AudioPlayer_buttonContainer">
                        <AccessibleButton
                            className={classnames("mx_AudioPlayer_transcribeButton mx_AccessibleButton", {
                                mx_AudioPlayer_transcribeButton_active: this.state.showTranscript,
                            })}
                            onClick={this.handleTranscriptToggle}
                        >
                            <span className="mx_AudioPlayer_transcribeArrow">T</span>
                            <span className="mx_AudioPlayer_transcribeLetter">T</span>
                        </AccessibleButton>
                        <AccessibleButton
                            className={classnames(
                                "mx_AudioPlayer_transcribeButton mx_AudioPlayer_secondButton mx_AccessibleButton",
                                {
                                    mx_AudioPlayer_transcribeButton_active: this.state.showSummary,
                                },
                            )}
                            onClick={this.handleSummaryToggle}
                        >
                            <span className="mx_AudioPlayer_transcribeLetter">S</span>
                        </AccessibleButton>
                    </div>
                </div>
                {this.state.showSummary && (
                    <div className="mx_AudioPlayer_summary">{this.state.summary || "Loading summary..."}</div>
                )}
                {this.state.showTranscript && (
                    <div className="mx_AudioPlayer_summary">
                        {(() => {
                            return this.state.transcript ? (
                                <div className="mx_AudioPlayer_transcriptContainer">
                                    <div>{this.state.transcript}</div>
                                    {this.state.transcript && this.state.isRefinedTranscript && (
                                        <div className="mx_AudioPlayer_refinedIndicator">
                                            <span className="mx_AudioPlayer_checkmark">✓</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div>No transcript available</div>
                            );
                        })()}
                    </div>
                )}
            </div>
        );
    }

    protected renderComponent(): ReactNode {
        let body: ReactNode;
        switch (this.props.layout) {
            case PlaybackLayout.Composer:
                body = this.renderComposerLook();
                break;
            case PlaybackLayout.Timeline: // default is timeline, fall through.
            default:
                body = this.renderTimelineLook();
                break;
        }

        return (
            <div className="mx_MediaBody mx_VoiceMessagePrimaryContainer" onKeyDown={this.onKeyDown}>
                {body}
            </div>
        );
    }
}
