import React from "react";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { RelationType, MsgType } from "matrix-js-sdk/src/matrix";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import AccessibleButton from "../elements/AccessibleButton";
import { _t } from "../../../languageHandler";

interface IProps {
    mxEvent?: MatrixEvent;
    showSummary: boolean;
    onToggleSummary: () => void;
}

export interface ISummaryViewRef {
    requestSummaryIfNeeded: () => Promise<void>;
}

interface IState {
    summary?: string;
}

export class SummaryView extends React.Component<IProps, IState> implements ISummaryViewRef {
    private currentRoom: Room | null = null;
    public componentWillUnmount(): void {
        // Clean up timeline listener
        const room = MatrixClientPeg.safeGet().getRoom(this.props.mxEvent?.getRoomId());
        if (room) {
            room.removeListener("Room.timeline", this.onTimelineEvent);
        }
    }

    public constructor(props: IProps) {
        super(props);
        this.state = {
            summary: undefined,
        };
    }

    private onTimelineEvent = (event: MatrixEvent): void => {
        const { mxEvent } = this.props;
        if (!mxEvent) return;

        const audioEventId = mxEvent.getId();

        // Check if this event is a summary for our audio message
        if (
            event.getRelation()?.event_id === audioEventId &&
            event.getRelation()?.rel_type === RelationType.Reference &&
            event.getContent().msgtype === MsgType.Summary
        ) {
            this.setState({ summary: event.getContent().body });
        }
    };

    public componentDidMount(): void {
        // Check for existing summaries and request one if needed
        this.updateSummary();

        // Add timeline listener
        const { mxEvent } = this.props;
        if (mxEvent) {
            const room = MatrixClientPeg.safeGet().getRoom(mxEvent.getRoomId());
            if (room) {
                room.on("Room.timeline", this.onTimelineEvent);
                this.currentRoom = room; // Store room reference for cleanup
            }
        }
    }

    public componentWillUnmount(): void {
        // Remove timeline listener
        if (this.currentRoom) {
            this.currentRoom.removeListener("Room.timeline", this.onTimelineEvent);
            this.currentRoom = null;
        }
    }

    public componentDidUpdate(prevProps: IProps): void {
        const { mxEvent } = this.props;
        const prevEvent = prevProps.mxEvent;

        // If the event changed, update the room listener
        if (prevEvent?.getRoomId() !== mxEvent?.getRoomId()) {
            console.log("[Summary] Room changed, updating timeline listener");

            // Remove old listener
            if (this.currentRoom) {
                console.log("[Summary] Removing timeline listener from old room");
                this.currentRoom.removeListener("Room.timeline", this.onTimelineEvent);
                this.currentRoom = null;
            }

            // Add new listener
            if (mxEvent) {
                const room = MatrixClientPeg.safeGet().getRoom(mxEvent.getRoomId());
                if (room) {
                    console.log("[Summary] Adding timeline listener for new room:", mxEvent.getRoomId());
                    room.on("Room.timeline", this.onTimelineEvent);
                    this.currentRoom = room;
                }
            }
        }

        // Check for summary if event changed
        if (prevEvent?.getId() !== mxEvent?.getId()) {
            this.requestSummaryIfNeeded();
        }
    }

    private updateSummary = (): void => {
        const { mxEvent } = this.props;
        if (!mxEvent) return;

        const audioEventId = mxEvent.getId();
        const room = MatrixClientPeg.safeGet().getRoom(mxEvent.getRoomId());
        const summaryEvents = room
            ?.getUnfilteredTimelineSet()
            .getLiveTimeline()
            .getEvents()
            .filter(
                (e) =>
                    e.getRelation()?.event_id === audioEventId &&
                    e.getRelation()?.rel_type === RelationType.Reference &&
                    e.getContent().msgtype === MsgType.Summary,
            );

        // Always update with the latest summary if available
        if (summaryEvents?.length) {
            const summaryEvent = summaryEvents[summaryEvents.length - 1];
            const summary = summaryEvent.getContent().body;
            this.setState({ summary });
        }
    };

    public requestSummaryIfNeeded = async (): Promise<void> => {
        const { mxEvent } = this.props;
        if (!mxEvent) return;

        // Only skip if we have a real summary (not an error or loading state)
        if (
            this.state.summary &&
            !["Generating summary...", "Failed to request summary", "No transcript available to summarize"].includes(
                this.state.summary,
            )
        ) {
            console.log("[Summary] Already have a valid summary:", this.state.summary);
            return;
        }

        const cli = MatrixClientPeg.safeGet();
        const roomId = mxEvent.getRoomId();
        const room = cli.getRoom(roomId);
        const audioEventId = mxEvent.getId();

        // No summary exists, check for transcript
        const allTranscripts = room
            ?.getUnfilteredTimelineSet()
            .getLiveTimeline()
            .getEvents()
            .filter(
                (e) =>
                    e.getRelation()?.event_id === audioEventId &&
                    (e.getContent().msgtype === MsgType.RawSTT || e.getContent().msgtype === MsgType.RefinedSTT),
            );

        if (!allTranscripts?.length) {
            this.setState({ summary: "No transcript available to summarize" });
            return;
        }

        // Prefer refined transcript over raw
        const refinedTranscript = allTranscripts.find((e) => e.getContent().msgtype === MsgType.RefinedSTT);
        const rawTranscript = allTranscripts.find((e) => e.getContent().msgtype === MsgType.RawSTT);

        const transcriptEvent = refinedTranscript || rawTranscript;
        const transcriptId = transcriptEvent.getId();
        const requestBody = {
            language: "en",
            reference_event_id: audioEventId,
        };

        const path = `/_synapse/client/v1/rooms/${roomId}/event/${transcriptId}/summarize`;

        try {
            await cli.http.authedRequest("POST", path, undefined, requestBody, {
                prefix: "",
                useAuthorizationHeader: true,
            });
            this.setState({ summary: "Generating summary..." });
        } catch (error) {
            this.setState({ summary: "Failed to request summary" });
        }
    };

    public render(): React.ReactNode {
        const { showSummary, onToggleSummary } = this.props;
        const { summary } = this.state;

        return (
            <>
                <AccessibleButton
                    className="mx_RecordingPlayback_summaryButton"
                    onClick={onToggleSummary}
                ></AccessibleButton>
                {showSummary && (
                    <div className="mx_RecordingPlayback_transcript">
                        <div className="mx_RecordingPlayback_transcriptBody">{summary || "Generating summary..."}</div>
                    </div>
                )}
            </>
        );
    }
}
