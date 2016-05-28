import {Editor, ContentState, convertFromHTML, DefaultDraftBlockRenderMap, DefaultDraftInlineStyle} from 'draft-js';
const ReactDOM = require('react-dom');

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
