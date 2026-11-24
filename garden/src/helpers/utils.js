const slugify = require("@sindresorhus/slugify");

// slugify rebuilds its transliteration/escape regexes on every call, which
// makes it one of the most expensive functions in a build (it runs for every
// heading and every wikilink). The same strings repeat constantly, so memoize.
const slugifyCache = new Map();
const SLUGIFY_CACHE_MAX = 50000;

function cachedSlugify(input) {
    if (slugifyCache.has(input)) {
        return slugifyCache.get(input);
    }
    const result = slugify(input);
    if (slugifyCache.size >= SLUGIFY_CACHE_MAX) {
        slugifyCache.clear();
    }
    slugifyCache.set(input, result);
    return result;
}

function headerToId(heading) {
    // Keep Persian headings readable and make Arabic/Persian keyboard forms
    // resolve to the same fragment identifier, including mixed English text.
    return String(heading).replace(/<[^>]*>/g, "").normalize("NFKC")
        .replace(/[يى]/g, "ی").replace(/ك/g, "ک")
        .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
        .replace(/[\u200C\u200D]/g, " ").toLocaleLowerCase("fa")
        .replace(/[^\p{L}\p{N}\s_-]/gu, "")
        .replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "");
}

function namedHeadings(md, state) {

    var ids = {}

    state.tokens.forEach(function(token, i) {
        if (token.type === 'heading_open') {
            // Pass env through: renderers like markdown-it-footnote read
            // env.docId and crash on a footnote inside a heading without it
            var text = md.renderer.render(state.tokens[i + 1].children, md.options, state.env)
            var id = headerToId(text);
            var uniqId = uncollide(ids, id)
            ids[uniqId] = true
            setAttr(token, 'id', uniqId)
        }
    })
}

function uncollide(ids, id) {
    if (!ids[id]) return id
    var i = 1
    while (ids[id + '-' + i]) { i++ }
    return id + '-' + i
}

function setAttr(token, attr, value, options) {
    var idx = token.attrIndex(attr)

    if (idx === -1) {
        token.attrPush([attr, value])
    } else if (options && options.append) {
        token.attrs[idx][1] =
            token.attrs[idx][1] + ' ' + value
    } else {
        token.attrs[idx][1] = value
    }
}

//https://github.com/rstacruz/markdown-it-named-headings/blob/master/index.js
exports.namedHeadingsFilter = function (md, options) {
    md.core.ruler.push('named_headings', namedHeadings.bind(null, md));
}

exports.headerToId = headerToId;
exports.cachedSlugify = cachedSlugify;
