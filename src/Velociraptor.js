var React = require('react');
var ReactDom = require('react-dom');
var Velocity = require('velocity-vector');

/**
 * The Velociraptor contains components and animates transitions with velocity.
 * It will only pick up direct changes to properties ('left', currently), and so
 * will not work for animating positional changes where the position is implicit
 * from DOM order. This makes it a lot simpler and lighter: if you need fully
 * automatic positional animation, look at react-shuffle or similar libraries.
 */
module.exports = React.createClass({
    displayName: 'Velociraptor',

    propTypes: {
        // either a list of child nodes, or a single child.
        children: React.PropTypes.any,

        // optional transition information for changing existing children
        transition: React.PropTypes.object,
    },

    componentWillMount: function() {
        this.nodes = {};
        this._updateChildren(this.props.children);
    },

    componentWillReceiveProps: function(nextProps) {
        this._updateChildren(nextProps.children);
    },

    /**
     * update `this.children` according to the new list of children given
     */
    _updateChildren: function(newChildren) {
        var self = this;
        var oldChildren = this.children || {};
        this.children = {};
        React.Children.toArray(newChildren).forEach(function(c) {
            if (oldChildren[c.key]) {
                var old = oldChildren[c.key];
                var oldNode = ReactDom.findDOMNode(self.nodes[old.key]);

                if (oldNode && oldNode.style.left != c.props.style.left) {
                    Velocity(oldNode, { left: c.props.style.left }, self.props.transition).then(function() {
                        // special case visibility because it's nonsensical to animate an invisible element
                        // so we always hidden->visible pre-transition and visible->hidden after
                        if (oldNode.style.visibility == 'visible' && c.props.style.visibility == 'hidden') {
                            oldNode.style.visibility = c.props.style.visibility;
                        }
                    });
                    if (oldNode.style.visibility == 'hidden' && c.props.style.visibility == 'visible') {
                        oldNode.style.visibility = c.props.style.visibility;
                    }
                    //console.log("translation: "+oldNode.style.left+" -> "+c.props.style.left);
                }
                self.children[c.key] = old;
            } else {
                // new element. If it has a startStyle, use that as the style and go through
                // the enter animations
                var newProps = {
                    ref: self.collectNode.bind(self, c.key)
                };
                if (c.props.startStyle && Object.keys(c.props.startStyle).length) {
                    var startStyle = c.props.startStyle;
                    if (Array.isArray(startStyle)) {
                        startStyle = startStyle[0];
                    }
                    newProps._restingStyle = c.props.style;
                    newProps.style = startStyle;
                    //console.log("mounted@startstyle0: "+JSON.stringify(startStyle));
                    // apply the enter animations once it's mounted
                }
                self.children[c.key] = React.cloneElement(c, newProps);
            }
        });
    },

    collectNode: function(k, node) {
        if (
            node &&
            this.nodes[k] === undefined &&
            node.props.startStyle &&
            Object.keys(node.props.startStyle).length
        ) {
            var domNode = ReactDom.findDOMNode(node);
            var startStyles = node.props.startStyle;
            var transitionOpts = node.props.enterTransitionOpts;
            if (!Array.isArray(startStyles)) {
                startStyles = [ startStyles ];
                transitionOpts = [ transitionOpts ];
            }
            // start from startStyle 1: 0 is the one we gave it
            // to start with, so now we animate 1 etc.
            for (var i = 1; i < startStyles.length; ++i) {
                Velocity(domNode, startStyles[i], transitionOpts[i-1]);
                //console.log("start: "+JSON.stringify(startStyles[i]));
            }
            // and then we animate to the resting state
            Velocity(domNode, node.props._restingStyle,
                     transitionOpts[i-1])
            .then(() => {
                // once we've reached the resting state, hide the element if
                // appropriate
                domNode.style.visibility = node.props._restingStyle.visibility;
            });

            //console.log("enter: "+JSON.stringify(node.props._restingStyle));
        } else if (node === null) {
            // Velocity stores data on elements using the jQuery .data()
            // method, and assumes you'll be using jQuery's .remove() to
            // remove the element, but we don't use jQuery, so we need to
            // blow away the element's data explicitly otherwise it will leak.
            // This uses Velocity's internal jQuery compatible wrapper.
            // See the bug at
            // https://github.com/julianshapiro/velocity/issues/300
            // and the FAQ entry, "Preventing memory leaks when
            // creating/destroying large numbers of elements"
            // (https://github.com/julianshapiro/velocity/issues/47)
            var domNode = ReactDom.findDOMNode(this.nodes[k]);
            Velocity.Utilities.removeData(domNode);
        }
        this.nodes[k] = node;
    },

    render: function() {
        return (
            <span>
                {Object.values(this.children)}
            </span>
        );
    },
});
