import {Editor, ContentState, convertFromHTML, DefaultDraftBlockRenderMap, DefaultDraftInlineStyle, CompositeDecorator} from 'draft-js';
const ReactDOM = require('react-dom');
var sdk = require('./index');

const BLOCK_RENDER_MAP = DefaultDraftBlockRenderMap.set('unstyled', {
    element: 'p' // draft uses <div> by default which we don't really like
});

const styles = {
    BOLD: 'strong',
    CODE: 'code',
    ITALIC: 'em',
    STRIKETHROUGH: 's',
    UNDERLINE: 'u'
};

export function contentStateToHTML(contentState:ContentState): String {
    const elem = contentState.getBlockMap().map((block) => {
        const elem = BLOCK_RENDER_MAP.get(block.getType()).element;
        const content = [];
        block.findStyleRanges(() => true, (s, e) => {
            const tags = block.getInlineStyleAt(s).map(style => styles[style]);
            const open = tags.map(tag => `<${tag}>`).join('');
            const close = tags.map(tag => `</${tag}>`).reverse().join('');
            content.push(`${open}${block.getText().substring(s, e)}${close}`);
        });

        return (`<${elem}>${content.join('')}</${elem}>`);
    }).join('');

    return elem;
}

export function HTMLtoContentState(html:String): ContentState {
    return ContentState.createFromBlockArray(convertFromHTML(html));
}

const USERNAME_REGEX = /@\S+:\S+/g;
const ROOM_REGEX = /#\S+:\S+/g;

export function getScopedDecorator(scope) {
    const MemberAvatar = sdk.getComponent('avatars.MemberAvatar');

    const usernameDecorator = {
        strategy: (contentBlock, callback) => {
            findWithRegex(USERNAME_REGEX, contentBlock, callback);
        },
        component: (props) => {
            console.log(props.children);
            console.log(props.children[0].props.text);
            const member = scope.room.getMember(props.children[0].props.text);
            console.log(scope);
            window.scope = scope;
            let name = null;
            if(!!member) {
                name = member.name;
            }
            console.log(member);
            const avatar = member ? <MemberAvatar member={member} width={16} height={16} /> : null;
            return <span className="mx_UserPill">{avatar} {props.children}</span>;
        }
    };
    const roomDecorator = {
        strategy: (contentBlock, callback) => {
            findWithRegex(ROOM_REGEX, contentBlock, callback);
        },
        component: (props) => {
            return <span className="mx_RoomPill">{props.children}</span>;
        }
    };

    return new CompositeDecorator([usernameDecorator, roomDecorator]);
}

function findWithRegex(regex, contentBlock, callback) {
    const text = contentBlock.getText();
    let matchArr, start;
    while ((matchArr = regex.exec(text)) !== null) {
        start = matchArr.index;
        callback(start, start + matchArr[0].length);
    }
}
