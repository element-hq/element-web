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

import { _t } from '../../../languageHandler';
import sdk from '../../../index';
import dis from '../../../dispatcher';
import Modal from '../../../Modal';
import { createMenu } from '../../structures/ContextualMenu';
import SettingsStore from '../../../settings/SettingsStore';
import { isContentActionable } from '../../../utils/EventUtils';

export default class MessageActionBar extends React.PureComponent {
    static propTypes = {
        mxEvent: PropTypes.object.isRequired,
        permalinkCreator: PropTypes.object,
        tile: PropTypes.element,
        replyThread: PropTypes.element,
        onFocusChange: PropTypes.func,
    };

    constructor(props) {
        super(props);

        this.state = {
            agreeDimension: null,
            likeDimension: null,
        };
    }

    onFocusChange = (focused) => {
        if (!this.props.onFocusChange) {
            return;
        }
        this.props.onFocusChange(focused);
    }

    onCryptoClicked = () => {
        const event = this.props.mxEvent;
        Modal.createTrackedDialogAsync('Encrypted Event Dialog', '',
            import('../../../async-components/views/dialogs/EncryptedEventDialog'),
            {event},
        );
    }

    onAgreeClick = (ev) => {
        this.toggleDimensionValue("agreeDimension", "agree");
    }

    onDisagreeClick = (ev) => {
        this.toggleDimensionValue("agreeDimension", "disagree");
    }

    onLikeClick = (ev) => {
        this.toggleDimensionValue("likeDimension", "like");
    }

    onDislikeClick = (ev) => {
        this.toggleDimensionValue("likeDimension", "dislike");
    }

    toggleDimensionValue(dimension, value) {
        const state = this.state[dimension];
        const newState = state !== value ? value : null;
        this.setState({
            [dimension]: newState,
        });
        // TODO: Send the reaction event
    }

    onReplyClick = (ev) => {
        dis.dispatch({
            action: 'reply_to_event',
            event: this.props.mxEvent,
        });
    }

    onOptionsClick = (ev) => {
        const MessageContextMenu = sdk.getComponent('context_menus.MessageContextMenu');
        const buttonRect = ev.target.getBoundingClientRect();

        // The window X and Y offsets are to adjust position when zoomed in to page
        const x = buttonRect.right + window.pageXOffset;
        const y = (buttonRect.top + (buttonRect.height / 2) + window.pageYOffset) - 19;

        const {tile, replyThread} = this.props;

        let e2eInfoCallback = null;
        if (this.props.mxEvent.isEncrypted()) {
            e2eInfoCallback = () => this.onCryptoClicked();
        }

        createMenu(MessageContextMenu, {
            chevronOffset: 10,
            mxEvent: this.props.mxEvent,
            left: x,
            top: y,
            permalinkCreator: this.props.permalinkCreator,
            eventTileOps: tile && tile.getEventTileOps ? tile.getEventTileOps() : undefined,
            collapseReplyThread: replyThread && replyThread.canCollapse() ? replyThread.collapse : undefined,
            e2eInfoCallback: e2eInfoCallback,
            onFinished: () => {
                this.onFocusChange(false);
            },
        });

        this.onFocusChange(true);
    }

    isReactionsEnabled() {
        return SettingsStore.isFeatureEnabled("feature_reactions");
    }

    renderAgreeDimension() {
        if (!this.isReactionsEnabled()) {
            return null;
        }

        const state = this.state.agreeDimension;
        const options = [
            {
                key: "agree",
                content: "👍",
                onClick: this.onAgreeClick,
            },
            {
                key: "disagree",
                content: "👎",
                onClick: this.onDisagreeClick,
            },
        ];

        return <span className="mx_MessageActionBar_reactionDimension"
            title={_t("Agree or Disagree")}
        >
            {this.renderReactionDimensionItems(state, options)}
        </span>;
    }

    renderLikeDimension() {
        if (!this.isReactionsEnabled()) {
            return null;
        }

        const state = this.state.likeDimension;
        const options = [
            {
                key: "like",
                content: "🙂",
                onClick: this.onLikeClick,
            },
            {
                key: "dislike",
                content: "😔",
                onClick: this.onDislikeClick,
            },
        ];

        return <span className="mx_MessageActionBar_reactionDimension"
            title={_t("Like or Dislike")}
        >
            {this.renderReactionDimensionItems(state, options)}
        </span>;
    }

    renderReactionDimensionItems(state, options) {
        return options.map(option => {
            const disabled = state && state !== option.key;
            const classes = classNames({
                mx_MessageActionBar_reactionDisabled: disabled,
            });
            return <span key={option.key}
                className={classes}
                onClick={option.onClick}
            >
                {option.content}
            </span>;
        });
    }

    render() {
        let agreeDimensionReactionButtons;
        let likeDimensionReactionButtons;
        let replyButton;

        if (isContentActionable(this.props.mxEvent)) {
            agreeDimensionReactionButtons = this.renderAgreeDimension();
            likeDimensionReactionButtons = this.renderLikeDimension();
            replyButton = <span className="mx_MessageActionBar_maskButton mx_MessageActionBar_replyButton"
                title={_t("Reply")}
                onClick={this.onReplyClick}
            />;
        }

        return <div className="mx_MessageActionBar">
            {agreeDimensionReactionButtons}
            {likeDimensionReactionButtons}
            {replyButton}
            <span className="mx_MessageActionBar_maskButton mx_MessageActionBar_optionsButton"
                title={_t("Options")}
                onClick={this.onOptionsClick}
            />
        </div>;
    }
}
