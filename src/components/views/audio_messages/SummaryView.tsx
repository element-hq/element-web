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
        if (!mxEvent || event.getRelation()?.event_id !== mxEvent.getId() || 
            event.getRelation()?.rel_type !== RelationType.Reference || 
            event.getContent().msgtype !== MsgType.Summary) return;

        this.setState({ summary: event.getContent().body });
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
        if (prevProps.mxEvent?.getRoomId() !== mxEvent?.getRoomId()) {
            if (this.currentRoom) {
                this.currentRoom.removeListener("Room.timeline", this.onTimelineEvent);
                this.currentRoom = null;
            }
            const room = mxEvent && MatrixClientPeg.safeGet().getRoom(mxEvent.getRoomId());
            if (room) {
                room.on("Room.timeline", this.onTimelineEvent);
                this.currentRoom = room;
            }
        }
        if (prevProps.mxEvent?.getId() !== mxEvent?.getId()) {
            this.requestSummaryIfNeeded();
        }
    }

    private updateSummary = (): void => {
        const { mxEvent } = this.props;
        if (!mxEvent) return;

        const summaryEvents = MatrixClientPeg.safeGet()
            .getRoom(mxEvent.getRoomId())
            ?.getUnfilteredTimelineSet()
            .getLiveTimeline()
            .getEvents()
            .filter(e => e.getRelation()?.event_id === mxEvent.getId() &&
                e.getRelation()?.rel_type === RelationType.Reference &&
                e.getContent().msgtype === MsgType.Summary);

        if (summaryEvents?.length) {
            this.setState({ summary: summaryEvents[summaryEvents.length - 1].getContent().body });
        }
    };

    public requestSummaryIfNeeded = async (): Promise<void> => {
        const { mxEvent } = this.props;
        if (!mxEvent || (this.state.summary && 
            !["Generating summary...", "Failed to request summary", "No transcript available to summarize"].includes(this.state.summary))) return;

        const cli = MatrixClientPeg.safeGet();
        const room = cli.getRoom(mxEvent.getRoomId());
        const audioEventId = mxEvent.getId();

        const allTranscripts = room?.getUnfilteredTimelineSet()
            .getLiveTimeline()
            .getEvents()
            .filter(e => e.getRelation()?.event_id === audioEventId && 
                (e.getContent().msgtype === MsgType.RawSTT || e.getContent().msgtype === MsgType.RefinedSTT));

        if (!allTranscripts?.length) {
            this.setState({ summary: "No transcript available to summarize" });
            return;
        }

        const transcriptEvent = allTranscripts.find(e => e.getContent().msgtype === MsgType.RefinedSTT) || 
            allTranscripts.find(e => e.getContent().msgtype === MsgType.RawSTT);

        try {
            await cli.http.authedRequest("POST", 
                `/_synapse/client/v1/rooms/${mxEvent.getRoomId()}/event/${transcriptEvent.getId()}/summarize`,
                undefined, 
                { language: "en", reference_event_id: audioEventId },
                { prefix: "", useAuthorizationHeader: true });
            this.setState({ summary: "Generating summary..." });
        } catch {
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
