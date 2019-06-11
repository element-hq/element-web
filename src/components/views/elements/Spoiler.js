'use strict';

import React from 'react';

module.exports = React.createClass({
    displayName: 'Spoiler',

    getInitialState() {
        return {
            visible: false,
        };
    },

    toggleVisible(e) {
        if (!this.state.visible) {
            // we are un-blurring, we don't want this click to propagate to potential child pills
            e.preventDefault();
            e.stopPropagation();
        }
        this.setState({ visible: !this.state.visible });
    },

    render: function() {
        const reason = this.props.reason ? (
            <span className="mx_EventTile_spoiler_reason">{"(" + this.props.reason + ")"}</span>
        ) : null;
        return (
            <span className={"mx_EventTile_spoiler" + (this.state.visible ? " visible" : "")} onClick={this.toggleVisible.bind(this)}>
                { reason }
                &nbsp;
                <span className="mx_EventTile_spoiler_content" dangerouslySetInnerHTML={{ __html: this.props.contentHtml }} />
            </span>
        );
    }
})
