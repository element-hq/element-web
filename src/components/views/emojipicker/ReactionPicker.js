/*
Copyright 2019 Tulir Asokan <tulir@maunium.net>

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
import PropTypes from "prop-types";
import EmojiPicker from "./EmojiPicker";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import dis from "../../../dispatcher/dispatcher";

class ReactionPicker extends React.Component {
    static propTypes = {
        mxEvent: PropTypes.object.isRequired,
        onFinished: PropTypes.func.isRequired,
        reactions: PropTypes.object,
    };

    constructor(props) {
        super(props);

        this.state = {
            selectedEmojis: new Set(Object.keys(this.getReactions())),
        };
        this.onChoose = this.onChoose.bind(this);
        this.onReactionsChange = this.onReactionsChange.bind(this);
        this.addListeners();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.reactions !== this.props.reactions) {
            this.addListeners();
            this.onReactionsChange();
        }
    }

    addListeners() {
        if (this.props.reactions) {
            this.props.reactions.on("Relations.add", this.onReactionsChange);
            this.props.reactions.on("Relations.remove", this.onReactionsChange);
            this.props.reactions.on("Relations.redaction", this.onReactionsChange);
        }
    }

    componentWillUnmount() {
        if (this.props.reactions) {
            this.props.reactions.removeListener(
                "Relations.add",
                this.onReactionsChange,
            );
            this.props.reactions.removeListener(
                "Relations.remove",
                this.onReactionsChange,
            );
            this.props.reactions.removeListener(
                "Relations.redaction",
                this.onReactionsChange,
            );
        }
    }

    getReactions() {
        if (!this.props.reactions) {
            return {};
        }
        const userId = MatrixClientPeg.get().getUserId();
        const myAnnotations = this.props.reactions.getAnnotationsBySender()[userId] || [];
        return Object.fromEntries([...myAnnotations]
            .filter(event => !event.isRedacted())
            .map(event => [event.getRelation().key, event.getId()]));
    }

    onReactionsChange() {
        this.setState({
            selectedEmojis: new Set(Object.keys(this.getReactions())),
        });
    }

    onChoose(reaction) {
        this.componentWillUnmount();
        this.props.onFinished();
        const myReactions = this.getReactions();
        if (myReactions.hasOwnProperty(reaction)) {
            MatrixClientPeg.get().redactEvent(
                this.props.mxEvent.getRoomId(),
                myReactions[reaction],
            );
            // Tell the emoji picker not to bump this in the more frequently used list.
            return false;
        } else {
            MatrixClientPeg.get().sendEvent(this.props.mxEvent.getRoomId(), "m.reaction", {
                "m.relates_to": {
                    "rel_type": "m.annotation",
                    "event_id": this.props.mxEvent.getId(),
                    "key": reaction,
                },
            });
            dis.dispatch({action: "message_sent"});
            return true;
        }
    }

    render() {
        return <EmojiPicker
            onChoose={this.onChoose}
            selectedEmojis={this.state.selectedEmojis}
            showQuickReactions={true}
        />;
    }
}

export default ReactionPicker;
