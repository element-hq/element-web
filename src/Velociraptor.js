var React = require('react');
var ReactDom = require('react-dom');
var Velocity = require('velocity-animate');

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
        children: React.PropTypes.array,
        transition: React.PropTypes.object,
        container: React.PropTypes.string
    },

    componentWillMount: function() {
        this.children = {};
        this.nodes = {};
        var self = this;
        React.Children.map(this.props.children, function(c) {
            self.children[c.props.key] = c;
        });
    },

    componentWillReceiveProps: function(nextProps) {
        var self = this;
        var oldChildren = this.children;
        this.children = {};
        React.Children.map(nextProps.children, function(c) {
            if (oldChildren[c.key]) {
                var old = oldChildren[c.key];
                var oldNode = ReactDom.findDOMNode(self.nodes[old.key]);

                if (oldNode.style.left != c.props.style.left) {
                    Velocity(oldNode, { left: c.props.style.left }, self.props.transition);
                }
                self.children[c.key] = old;
            } else {
                self.children[c.key] = c;
            }
        });
    },

    collectNode: function(k, node) {
        if (
            this.nodes[k] === undefined &&
            node.props.enterTransition &&
            Object.keys(node.props.enterTransition).length
        ) {
            var domNode = ReactDom.findDOMNode(node);
            var transitions = node.props.enterTransition;
            var transitionOpts = node.props.enterTransitionOpts;
            if (!Array.isArray(transitions)) {
                transitions = [ transitions ];
                transitionOpts = [ transitionOpts ];
            }
            for (var i = 0; i < transitions.length; ++i) {
                Velocity(domNode, transitions[i], transitionOpts[i]);
                console.log("enter: "+JSON.stringify(transitions[i]));
            }
        }
        this.nodes[k] = node;
    },

    render: function() {
        var self = this;
        var childList = Object.keys(this.children).map(function(k) {
            return React.cloneElement(self.children[k], {
                ref: self.collectNode.bind(self, self.children[k].key)
            });
        });
        return (
            <span>
                {childList}
            </span>
        );
    },
});
