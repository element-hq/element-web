import React from "react";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { RelationType, MsgType } from "matrix-js-sdk/src/matrix";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import AccessibleButton from "../elements/AccessibleButton";
import { _t } from "../../../languageHandler";

interface IProps {
    mxEvent?: MatrixEvent;
    showTranscript: boolean;
    onToggleTranscript: () => void;
}

interface IState {
    transcript?: string;
    transcriptEventId?: string;
    isRefinedTranscript: boolean;
}

export class TranscriptView extends React.Component<IProps, IState> {
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
            transcript: undefined,
            transcriptEventId: undefined,
            isRefinedTranscript: false,
        };
    }

    private onTimelineEvent = (event: MatrixEvent): void => {
        const { mxEvent } = this.props;
        if (!mxEvent) return;

        // Check if this event is a transcript for our audio message
        if (
            event.getRelation()?.event_id === mxEvent.getId() &&
            event.getRelation()?.rel_type === RelationType.Reference &&
            (event.getContent().msgtype === MsgType.RefinedSTT || event.getContent().msgtype === MsgType.RawSTT)
        ) {
            this.updateTranscript();
        }
    };

    public componentDidMount(): void {
        this.updateTranscript();

        // Add timeline listener
        const room = MatrixClientPeg.safeGet().getRoom(this.props.mxEvent?.getRoomId());
        if (room) {
            room.on("Room.timeline", this.onTimelineEvent);
        }
    }

    public componentDidUpdate(prevProps: IProps): void {
        if (prevProps.mxEvent?.getId() !== this.props.mxEvent?.getId()) {
            this.updateTranscript();
            
            // Remove listener from old room and add to new room if needed
            const oldRoom = MatrixClientPeg.safeGet().getRoom(prevProps.mxEvent?.getRoomId());
            const newRoom = MatrixClientPeg.safeGet().getRoom(this.props.mxEvent?.getRoomId());
            
            if (oldRoom) {
                oldRoom.removeListener("Room.timeline", this.onTimelineEvent);
            }
            if (newRoom) {
                newRoom.on("Room.timeline", this.onTimelineEvent);
            }
        }
    }

    private updateTranscript = (): void => {
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

        const refined = transcripts?.find((e) => e.getContent().msgtype === MsgType.RefinedSTT);
        const raw = transcripts?.find((e) => e.getContent().msgtype === MsgType.RawSTT);

        const newTranscript =
            refined?.getContent()?.body || raw?.getContent()?.body || mxEvent.getContent()?.transcript;
        const isRefined = refined !== undefined;
        const transcriptEventId = (refined || raw)?.getId();

        if (
            this.state.transcript !== newTranscript ||
            this.state.isRefinedTranscript !== isRefined ||
            this.state.transcriptEventId !== transcriptEventId
        ) {
            this.setState({
                transcript: newTranscript,
                transcriptEventId,
                isRefinedTranscript: isRefined,
            });
        }
    };

    public render(): React.ReactNode {
        const { showTranscript, onToggleTranscript } = this.props;
        const { transcript, isRefinedTranscript } = this.state;

        return (
            <>
                <AccessibleButton
                    className="mx_RecordingPlayback_transcriptButton"
                    onClick={onToggleTranscript}
                    disabled={!transcript}
                ></AccessibleButton>
                {showTranscript && transcript && (
                    <div className="mx_RecordingPlayback_transcript">
                        <div className="mx_RecordingPlayback_transcriptBody">
                            {transcript}
                            {isRefinedTranscript && <div className="mx_AudioPlayer_checkmark mx_RecordingPlayback_transcriptType"><span className="mx_RecordingPlayback_refinedLabel">AI refined</span>✓</div>}
                        </div>
                    </div>
                )}
            </>
        );
    }
}
