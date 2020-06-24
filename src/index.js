const fs = require('fs-extra');
const visit = require('unist-util-visit');
const utils = require('./utils');

const render = utils.render;
const renderFromFile = utils.renderFromFile;
const getDestinationDir = utils.getDestinationDir;
const createMermaidDiv = utils.createMermaidDiv;
const uniqueName = utils.uniqueName;

const PLUGIN_NAME = 'remark-mermaid';

/**
 * Is this title `mermaid:`?
 *
 * @param  {string} title
 * @return {boolean}
 */
const isMermaid = title => title === 'mermaid:';

/**
 * Given a node which contains a `url` property (eg. Link or Image), follow
 * the link, generate a graph and then replace the link with the link to the
 * generated graph. Checks to ensure node has a title of `mermaid:` before doing.
 *
 * @param   {object}  node
 * @param   {vFile}   vFile
 * @return {object}
 */
function replaceUrlWithGraph(node, vFile) {
  const { title, url, position } = node;
  const { destinationDir } = vFile.data;

  // If the node isn't mermaid, ignore it.
  if (!isMermaid(title)) {
    return node;
  }

  try {
    // eslint-disable-next-line no-param-reassign
    node.url = renderFromFile(`${vFile.dirname}/${url}`, destinationDir);

    vFile.info('mermaid link replaced with link to graph', position, PLUGIN_NAME);
  } catch (error) {
    vFile.message(error, position, PLUGIN_NAME);
  }

  return node;
}

/**
 * Given a link to a mermaid diagram, grab the contents from the link and put it
 * into a div that Mermaid JS can act upon.
 *
 * @param  {object}   node
 * @param  {integer}  index
 * @param  {object}   parent
 * @param  {vFile}    vFile
 * @return {object}
 */
function replaceLinkWithEmbedded(node, index, parent, vFile) {
  const { title, url, position } = node;
  let newNode;

  // If the node isn't mermaid, ignore it.
  if (!isMermaid(title)) {
    return node;
  }

  try {
    const value = fs.readFileSync(`${vFile.dirname}/${url}`, { encoding: 'utf-8' });

    newNode = createMermaidDiv(value);
    parent.children.splice(index, 1, newNode);
    vFile.info('mermaid link replaced with div', position, PLUGIN_NAME);
  } catch (error) {
    vFile.message(error, position, PLUGIN_NAME);
    return node;
  }

  return node;
}

function removeExistingMermaidSummary(parent, index) {
  // delete the summary wrapper and the prefixed image.
  // we will re-create them with more updated values
  if (index + 1 >= parent.children.length || index - 2 < 0) return index;
  const link = parent.children[index - 2];
  const detailsStart = parent.children[index - 1];
  const detailsEnd = parent.children[index + 1];
  const nodeIsInsideSummary = (
    detailsEnd.type === 'html' && detailsEnd.value === '</details>' &&
    detailsStart.type === 'html' && /<details.*?><summary>Mermaid source<\/summary>/.test(detailsStart.value) &&
    link.type === 'paragraph' && link.children.length === 1 && link.children[0].type === 'image' &&
    link.children[0].title === "`mermaid` image"
  );
  if (!nodeIsInsideSummary) return index;

  parent.children.splice(index + 1, 1);
  parent.children.splice(index - 2, 2);
  return index - 2;
}

/**
 * Given the MDAST ast, look for all fenced codeblocks that have a language of
 * `mermaid` and pass that to mermaid.cli to render the image. Replaces the
 * codeblocks with an image of the rendered graph.
 *
 * @param {object}  ast
 * @param {vFile}   vFile
 * @param {object} options
 * @return {function}
 */
function visitCodeBlock(ast, vFile, options) {
  const isSimple = !!options.simple;
  return visit(ast, 'code', (node, index, parent) => {
    const { lang, value, position } = node;
    const destinationDir = getDestinationDir(vFile);
    let newNode;

    // If this codeblock is not mermaid, bail.
    if (!(/mermaid\b/.test(lang))) {
      return node;
    }


    const isComment = /\bcomment/.test(lang);
    const isInline = /\binline/.test(lang);

    if (isComment) {
      index = removeExistingMermaidSummary(parent, index);
      if (parent.children[index] !== node) throw new Error("expected index to be correct");
    }
    // Are we just transforming to a <div>, or replacing with an image?
    if (isSimple) {
      newNode = createMermaidDiv(value);

      vFile.info(`${lang} code block replaced with div`, position, PLUGIN_NAME);
    } else {
      // Otherwise, let's try and generate a graph!
      try {
        newNode = render(value, destinationDir, { inline: isInline, imageDir: options.imageDir });

        if (!isComment) vFile.info(`${lang} code block replaced with graph`, position, PLUGIN_NAME);
      } catch (error) {
        vFile.message(error, position, PLUGIN_NAME);
        return node;
      }

    }

    parent.children.splice(index, 1, newNode);

    if (isComment) {
      parent.children.splice(index + 1, 0, {
        type: 'html',
        value: `<details data-mermaid-hash="${uniqueName(value)}"><summary>Mermaid source</summary>

\`\`\`${lang}
${value}
\`\`\`

</details>`
      });
    }

    return node;
  });
}

/**
 * If links have a title attribute called `mermaid:`, follow the link and
 * depending on `isSimple`, either generate and link to the graph, or simply
 * wrap the graph contents in a div.
 *
 * @param {object}  ast
 * @param {vFile}   vFile
 * @param {object} opts
 * @return {function}
 */
function visitLink(ast, vFile, opts) {
  if (opts.simple) {
    return visit(ast, 'link', (node, index, parent) => replaceLinkWithEmbedded(node, index, parent, vFile));
  }

  return visit(ast, 'link', node => replaceUrlWithGraph(node, vFile));
}

/**
 * If images have a title attribute called `mermaid:`, follow the link and
 * depending on `isSimple`, either generate and link to the graph, or simply
 * wrap the graph contents in a div.
 *
 * @param {object}  ast
 * @param {vFile}   vFile
 * @param {object} opts
 * @return {function}
 */
function visitImage(ast, vFile, opts) {
  if (opts.simple) {
    return visit(ast, 'image', (node, index, parent) => replaceLinkWithEmbedded(node, index, parent, vFile));
  }

  return visit(ast, 'image', node => replaceUrlWithGraph(node, vFile));
}

/**
 * Returns the transformer which acts on the MDAST tree and given VFile.
 *
 * If `options.simple` is passed as a truthy value, the plugin will convert
 * to `<div class="mermaid">` rather than a SVG image.
 *
 * @link https://github.com/unifiedjs/unified#function-transformernode-file-next
 * @link https://github.com/syntax-tree/mdast
 * @link https://github.com/vfile/vfile
 *
 * @param {object} options
 * @return {function}
 */
function mermaid(options = {}) {

  /**
   * @param {object} ast MDAST
   * @param {vFile} vFile
   * @param {function} next
   * @return {object}
   */
  return function transformer(ast, vFile, next) {
    visitCodeBlock(ast, vFile, options);
    visitLink(ast, vFile, options);
    visitImage(ast, vFile, options);

    if (typeof next === 'function') {
      return next(null, ast, vFile);
    }

    return ast;
  };
}

module.exports = mermaid;
