const React = require('react');
const ReactDom = require('react-dom');
import PropTypes from 'prop-types';
const Velocity = require('velocity-animate');

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
        children: PropTypes.any,

        // optional transition information for changing existing children
        transition: PropTypes.object,

        // a list of state objects to apply to each child node in turn
        startStyles: PropTypes.array,

        // a list of transition options from the corresponding startStyle
        enterTransitionOpts: PropTypes.array,
    },

    getDefaultProps: function() {
        return {
            startStyles: [],
            enterTransitionOpts: [],
        };
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
        const self = this;
        const oldChildren = this.children || {};
        this.children = {};
        React.Children.toArray(newChildren).forEach(function(c) {
            if (oldChildren[c.key]) {
                const old = oldChildren[c.key];
                const oldNode = ReactDom.findDOMNode(self.nodes[old.key]);

                if (oldNode && oldNode.style.left != c.props.style.left) {
                    Velocity(oldNode, { left: c.props.style.left }, self.props.transition).then(function() {
                        // special case visibility because it's nonsensical to animate an invisible element
                        // so we always hidden->visible pre-transition and visible->hidden after
                        if (oldNode.style.visibility == 'visible' && c.props.style.visibility == 'hidden') {
                            oldNode.style.visibility = c.props.style.visibility;
                        }
                    });
                    //console.log("translation: "+oldNode.style.left+" -> "+c.props.style.left);
                }
                if (oldNode && oldNode.style.visibility == 'hidden' && c.props.style.visibility == 'visible') {
                    oldNode.style.visibility = c.props.style.visibility;
                }
                // clone the old element with the props (and children) of the new element
                // so prop updates are still received by the children.
                self.children[c.key] = React.cloneElement(old, c.props, c.props.children);
            } else {
                // new element. If we have a startStyle, use that as the style and go through
                // the enter animations
                const newProps = {};
                const restingStyle = c.props.style;

                const startStyles = self.props.startStyles;
                if (startStyles.length > 0) {
                    const startStyle = startStyles[0];
                    newProps.style = startStyle;
                    // console.log("mounted@startstyle0: "+JSON.stringify(startStyle));
                }

                newProps.ref = ((n) => self._collectNode(
                    c.key, n, restingStyle,
                ));

                self.children[c.key] = React.cloneElement(c, newProps);
            }
        });
    },

    /**
     * called when a child element is mounted/unmounted
     *
     * @param {string}     k              key of the child
     * @param {null|Object} node          On mount: React node. On unmount: null
     * @param {Object}     restingStyle   final style
     */
    _collectNode: function(k, node, restingStyle) {
        if (
            node &&
            this.nodes[k] === undefined &&
            this.props.startStyles.length > 0
        ) {
            const startStyles = this.props.startStyles;
            const transitionOpts = this.props.enterTransitionOpts;
            const domNode = ReactDom.findDOMNode(node);
            // start from startStyle 1: 0 is the one we gave it
            // to start with, so now we animate 1 etc.
            for (var i = 1; i < startStyles.length; ++i) {
                Velocity(domNode, startStyles[i], transitionOpts[i-1]);
                /*
                console.log("start:",
                            JSON.stringify(transitionOpts[i-1]),
                            "->",
                            JSON.stringify(startStyles[i]),
                            );
                */
            }

            // and then we animate to the resting state
            Velocity(domNode, restingStyle,
                     transitionOpts[i-1])
            .then(() => {
                // once we've reached the resting state, hide the element if
                // appropriate
                domNode.style.visibility = restingStyle.visibility;
            });

            /*
            console.log("enter:",
                        JSON.stringify(transitionOpts[i-1]),
                        "->",
                        JSON.stringify(restingStyle));
            */
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
            const domNode = ReactDom.findDOMNode(this.nodes[k]);
            if (domNode) Velocity.Utilities.removeData(domNode);
        }
        this.nodes[k] = node;
    },

    render: function() {
        return (
            <span>
                { Object.values(this.children) }
            </span>
        );
    },
});
