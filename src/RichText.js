import {Editor, ContentState, convertFromHTML, DefaultDraftBlockRenderMap, DefaultDraftInlineStyle} from 'draft-js';
const ReactDOM = require('react-dom');

const styles = {
    BOLD: 'strong',
    CODE: 'code',
    ITALIC: 'em',
    STRIKETHROUGH: 's',
    UNDERLINE: 'u'
};

export function contentStateToHTML(contentState:ContentState): String {
    const elem = contentState.getBlockMap().map((block) => {
        const elem = DefaultDraftBlockRenderMap.get(block.getType()).element;
        const content = [];
        block.findStyleRanges(() => true, (s, e) => {
            console.log(block.getInlineStyleAt(s));
            const tags = block.getInlineStyleAt(s).map(style => styles[style]);
            const open = tags.map(tag => `<${tag}>`).join('');
            const close = tags.map(tag => `</${tag}>`).reverse().join('');
            content.push(`${open}${block.getText().substring(s, e)}${close}`);
        });

        return (`
            <${elem}>
                ${content.join('')}
            </${elem}>
        `);
    }).join('');


    return elem;
}

export function HTMLtoContentState(html:String): ContentState {
    return ContentState.createFromBlockArray(convertFromHTML(html));
}
