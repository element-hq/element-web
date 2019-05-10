/*
Copyright 2019 New Vector Ltd

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
import PropTypes from 'prop-types';
import classNames from 'classnames';

import MatrixClientPeg from '../../../MatrixClientPeg';

export default class ReactionDimension extends React.PureComponent {
    static propTypes = {
        mxEvent: PropTypes.object.isRequired,
        // Array of strings containing the emoji for each option
        options: PropTypes.array.isRequired,
        title: PropTypes.string,
        // The Relations model from the JS SDK for reactions
        reactions: PropTypes.object,
    };

    constructor(props) {
        super(props);

        this.state = this.getSelection();

        if (props.reactions) {
            props.reactions.on("Relations.add", this.onReactionsChange);
            props.reactions.on("Relations.redaction", this.onReactionsChange);
        }
    }

    componentDidUpdate(prevProps) {
        if (prevProps.reactions !== this.props.reactions) {
            this.props.reactions.on("Relations.add", this.onReactionsChange);
            this.props.reactions.on("Relations.redaction", this.onReactionsChange);
            this.onReactionsChange();
        }
    }

    componentWillUnmount() {
        if (this.props.reactions) {
            this.props.reactions.removeListener(
                "Relations.add",
                this.onReactionsChange,
            );
            this.props.reactions.removeListener(
                "Relations.redaction",
                this.onReactionsChange,
            );
        }
    }

    onReactionsChange = () => {
        this.setState(this.getSelection());
    }

    getSelection() {
        const myReactions = this.getMyReactions();
        if (!myReactions) {
            return {
                selectedOption: null,
                selectedReactionEvent: null,
            };
        }
        const { options } = this.props;
        let selectedOption = null;
        let selectedReactionEvent = null;
        for (const option of options) {
            const reactionForOption = myReactions.find(mxEvent => {
                if (mxEvent.isRedacted()) {
                    return false;
                }
                return mxEvent.getContent()["m.relates_to"].key === option;
            });
            if (!reactionForOption) {
                continue;
            }
            if (selectedOption) {
                // If there are multiple selected values (only expected to occur via
                // non-Riot clients), then act as if none are selected.
                return {
                    selectedOption: null,
                    selectedReactionEvent: null,
                };
            }
            selectedOption = option;
            selectedReactionEvent = reactionForOption;
        }
        return { selectedOption, selectedReactionEvent };
    }

    getMyReactions() {
        const reactions = this.props.reactions;
        if (!reactions) {
            return null;
        }
        const userId = MatrixClientPeg.get().getUserId();
        return reactions.getAnnotationsBySender()[userId];
    }

    onOptionClick = (ev) => {
        const { key } = ev.target.dataset;
        this.toggleDimension(key);
    }

    toggleDimension(key) {
        const { selectedOption, selectedReactionEvent } = this.state;
        const newSelectedOption = selectedOption !== key ? key : null;
        this.setState({
            selectedOption: newSelectedOption,
        });
        if (selectedReactionEvent) {
            MatrixClientPeg.get().redactEvent(
                this.props.mxEvent.getRoomId(),
                selectedReactionEvent.getId(),
            );
        }
        if (newSelectedOption) {
            MatrixClientPeg.get().sendEvent(this.props.mxEvent.getRoomId(), "m.reaction", {
                "m.relates_to": {
                    "rel_type": "m.annotation",
                    "event_id": this.props.mxEvent.getId(),
                    "key": newSelectedOption,
                },
            });
        }
    }

    render() {
        const { selectedOption } = this.state;
        const { options } = this.props;

        const items = options.map(option => {
            const disabled = selectedOption && selectedOption !== option;
            const classes = classNames({
                mx_ReactionDimension_disabled: disabled,
            });
            return <span key={option}
                data-key={option}
                className={classes}
                onClick={this.onOptionClick}
            >
                {option}
            </span>;
        });

        return <span className="mx_ReactionDimension"
            title={this.props.title}
        >
            {items}
        </span>;
    }
}
