/*
Copyright 2019 Tulir Asokan <tulir@maunium.net>
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from 'react';
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Relations, RelationsEvent } from 'matrix-js-sdk/src/models/relations';
import { EventType, RelationType } from 'matrix-js-sdk/src/@types/event';

import EmojiPicker from "./EmojiPicker";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import dis from "../../../dispatcher/dispatcher";
import { Action } from '../../../dispatcher/actions';
import RoomContext from "../../../contexts/RoomContext";
import { FocusComposerPayload } from '../../../dispatcher/payloads/FocusComposerPayload';

interface IProps {
    mxEvent: MatrixEvent;
    reactions?: Relations;
    onFinished(): void;
}

interface IState {
    selectedEmojis: Set<string>;
}

class ReactionPicker extends React.Component<IProps, IState> {
    static contextType = RoomContext;
    public context!: React.ContextType<typeof RoomContext>;

    constructor(props: IProps, context: React.ContextType<typeof RoomContext>) {
        super(props, context);

        this.state = {
            selectedEmojis: new Set(Object.keys(this.getReactions())),
        };
        this.addListeners();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.reactions !== this.props.reactions) {
            this.addListeners();
            this.onReactionsChange();
        }
    }

    private addListeners() {
        if (this.props.reactions) {
            this.props.reactions.on(RelationsEvent.Add, this.onReactionsChange);
            this.props.reactions.on(RelationsEvent.Remove, this.onReactionsChange);
            this.props.reactions.on(RelationsEvent.Redaction, this.onReactionsChange);
        }
    }

    componentWillUnmount() {
        if (this.props.reactions) {
            this.props.reactions.removeListener(RelationsEvent.Add, this.onReactionsChange);
            this.props.reactions.removeListener(RelationsEvent.Remove, this.onReactionsChange);
            this.props.reactions.removeListener(RelationsEvent.Redaction, this.onReactionsChange);
        }
    }

    private getReactions() {
        if (!this.props.reactions) {
            return {};
        }
        const userId = MatrixClientPeg.get().getUserId();
        const myAnnotations = this.props.reactions.getAnnotationsBySender()[userId] || [];
        return Object.fromEntries([...myAnnotations]
            .filter(event => !event.isRedacted())
            .map(event => [event.getRelation().key, event.getId()]));
    }

    private onReactionsChange = () => {
        this.setState({
            selectedEmojis: new Set(Object.keys(this.getReactions())),
        });
    };

    private onChoose = (reaction: string) => {
        this.componentWillUnmount();
        this.props.onFinished();
        const myReactions = this.getReactions();
        if (myReactions.hasOwnProperty(reaction)) {
            MatrixClientPeg.get().redactEvent(this.props.mxEvent.getRoomId(), myReactions[reaction]);
            dis.dispatch<FocusComposerPayload>({
                action: Action.FocusAComposer,
                context: this.context.timelineRenderingType,
            });
            // Tell the emoji picker not to bump this in the more frequently used list.
            return false;
        } else {
            MatrixClientPeg.get().sendEvent(this.props.mxEvent.getRoomId(), EventType.Reaction, {
                "m.relates_to": {
                    "rel_type": RelationType.Annotation,
                    "event_id": this.props.mxEvent.getId(),
                    "key": reaction,
                },
            });
            dis.dispatch({ action: "message_sent" });
            dis.dispatch<FocusComposerPayload>({
                action: Action.FocusAComposer,
                context: this.context.timelineRenderingType,
            });
            return true;
        }
    };

    render() {
        return <EmojiPicker
            onChoose={this.onChoose}
            selectedEmojis={this.state.selectedEmojis}
            showQuickReactions={true}
            data-testid='mx_ReactionPicker'
        />;
    }
}

export default ReactionPicker;
