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

interface IState {
    summary?: string;
}

export class SummaryView extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        this.state = {
            summary: undefined,
        };
    }

    public componentDidMount(): void {
        this.updateSummary();
    }

    public componentDidUpdate(prevProps: IProps): void {
        if (prevProps.mxEvent?.getId() !== this.props.mxEvent?.getId()) {
            this.updateSummary();
        }
    }

    private updateSummary = (): void => {
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
            const summaryEvent = summaryEvents[summaryEvents.length - 1];
            const summary = summaryEvent.getContent().body;
            if (summary && this.state.summary !== summary) {
                this.setState({ summary });
            }
        }
    };

    private requestSummary = async (): Promise<void> => {
        const { mxEvent } = this.props;
        if (!mxEvent) return;

        this.setState({ summary: "Generating summary..." });

        try {
            const cli = MatrixClientPeg.safeGet();
            const roomId = mxEvent.getRoomId();
            const requestBody = {
                language: "en",
                reference_event_id: mxEvent.getId(),
            };

            const path = `/client/v1/rooms/${roomId}/event/${mxEvent.getId()}/summarize`;
            await cli.http.authedRequest("POST", path, undefined, requestBody, {
                prefix: "/_synapse",
                useAuthorizationHeader: true,
            });
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
                    onClick={() => {
                        onToggleSummary();
                        if (!summary) {
                            this.requestSummary();
                        }
                    }}
                ></AccessibleButton>
                {showSummary && summary && (
                    <div className="mx_RecordingPlayback_summary">
                        <div className="mx_RecordingPlayback_summaryBody">{summary}</div>
                    </div>
                )}
            </>
        );
    }
}
