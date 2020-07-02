const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');
const which = require('which');
const execSync = require('child_process').execSync;

const PLUGIN_NAME = 'remark-mermaid';

function uniqueName(source) {
  return crypto.createHmac('sha1', PLUGIN_NAME).update(source).digest('hex');
}

/**
 * Accepts the `source` of the graph as a string, and render an SVG using
 * mermaid.cli. Returns the path to the rendered SVG.
 *
 * @param  {string} source
 * @param  {string} destination
 * @param  {object} opts
 * @return {string}
 */
function render(source, destination, opts = {}) {
  const unique = uniqueName(source);
  const mmdcExecutable = which.sync('mmdc');
  const mmdPath = path.join(destination, `${unique}.mmd`);
  const svgFilename = `${unique}.svg`;
  const svgPath = (
    opts.imageDir ? path.join(destination, opts.imageDir, svgFilename)
    : path.join(destination, svgFilename)
  );

  // Write temporary file
  fs.outputFileSync(mmdPath, source);

  if (opts.imageDir) {
    fs.mkdirp(path.join(destination, opts.imageDir));
  }

  try {
    // Invoke mermaid.cli
    execSync(`${mmdcExecutable} -i ${mmdPath} -o ${svgPath} -b transparent`);
  } catch (err) {
    // rethrow with a clearer message
    throw `In compiling the following diagram
=========
${source}
=========

mermaid encounted the following error:
${err.stdout}
The code-block was left as-is in your file.`;
  } finally {
    // Clean up temporary file
    fs.removeSync(mmdPath);
  }

  const imgUrl = path.join(opts.imageDir || '.', svgFilename);
  return {
    type: 'image',
    title: '`mermaid` image',
    url: imgUrl,
  };
}

/**
 * Accepts the `source` of the graph as a string, and render an SVG using
 * mermaid.cli. Returns the path to the rendered SVG.
 *
 * @param  {string} destination
 * @param  {string} source
 * @return {string}
 */
function renderFromFile(inputFile, destination) {
  const unique = crypto.createHmac('sha1', PLUGIN_NAME).update(inputFile).digest('hex');
  const mmdcExecutable = which.sync('mmdc');
  const svgFilename = `${unique}.svg`;
  const svgPath = path.join(destination, svgFilename);

  // Invoke mermaid.cli
  execSync(`${mmdcExecutable} -i ${inputFile} -o ${svgPath} -b transparent`);

  return svgFilename;
}

/**
 * Returns the destination for the SVG to be rendered at, explicity defined
 * using `vFile.data.destinationDir`, or falling back to the file's current
 * directory.
 *
 * @param {vFile} vFile
 * @return {string}
 */
function getDestinationDir(vFile) {
  if (vFile.data.destinationDir) {
    return vFile.data.destinationDir;
  }

  return vFile.dirname;
}

/**
 * Given the contents, returns a MDAST representation of a HTML node.
 *
 * @param  {string} contents
 * @return {object}
 */
function createMermaidDiv(contents) {
  return {
    type: 'html',
    value: `<div class="mermaid">
  ${contents}
</div>`,
  };
}

module.exports = {
  createMermaidDiv,
  getDestinationDir,
  render,
  renderFromFile,
  uniqueName,
};
