const path = require('path');
const parse = require('remark-parse');
const stringify = require('remark-stringify');
const vfile = require('vfile');
const toVFile = require('to-vfile');
const unified = require('unified');
const mermaid = require('../src/');

const fixturesDir = path.join(__dirname, '/fixtures');
const runtimeDir = path.join(__dirname, '/runtime');
const remark = unified().use(parse).use(stringify).freeze();

// Utility function to add metdata to a vFile.
function addMetadata(vFile, destinationFilePath) {
  vFile.data = {
    destinationFilePath,
    destinationDir: path.dirname(destinationFilePath),
  };
}

describe('remark-mermaid', () => {
  it('it ignores markdown that does not have mermaid references', () => {
    const srcFile = `${fixturesDir}/simple.md`;
    const destFile = `${runtimeDir}/simple.md`;
    const vfile = toVFile.readSync(srcFile);
    addMetadata(vfile, destFile);

    const result = remark().use(mermaid).processSync(vfile).toString();
    expect(result).not.toMatch(/!\[\]\(\w+\.svg/);
    expect(vfile.messages).toHaveLength(0);
  });

  it('can handle code blocks', () => {
    const srcFile = `${fixturesDir}/code-block.md`;
    const destFile = `${runtimeDir}/code-block.md`;
    const vfile = toVFile.readSync(srcFile);
    addMetadata(vfile, destFile);

    const result = remark().use(mermaid).processSync(vfile).toString();
    expect(result).toMatch(/!\[\]\(\w+\.svg/);
    expect(vfile.messages[0].message).toBe('mermaid code block replaced with graph');
  });

  it('can handle code blocks, putting the block into a comment', () => {
    const srcFile = `${fixturesDir}/code-block-comment.md`;
    const destFile = `${runtimeDir}/code-block-comment.md`;
    const vfile = toVFile.readSync(srcFile);
    addMetadata(vfile, destFile);

    const result = remark().use(mermaid).processSync(vfile).toString();
    expect(result).toMatch(/!\[\]\(\w+\.svg/);
    expect(result).toMatch(/graph LR/);
    expect(result).toMatch(/\n```/m);
    expect(result).toMatch(/<summary>Mermaid source<\/summary>/);
    expectFixedPoint(srcFile);
  });

  it('updates the outdated images', () => {
    const srcFile = `${fixturesDir}/outdated-comment.md`;
    const destFile = `${runtimeDir}/outdated-comment.md`;
    const vfile = toVFile.readSync(srcFile);
    addMetadata(vfile, destFile);

    const result = remark().use(mermaid).processSync(vfile).toString();
    expect(result).not.toMatch(/db3c1050564eea0d99f028979a7a2218aa4fa581\.svg/);
    expect(result.match(/<summary>/g)).toHaveLength(1);
    expectFixedPoint(srcFile);
  });

  it('can handle code blocks, putting the svg inline', () => {
    const srcFile = `${fixturesDir}/code-block-inline.md`;
    const destFile = `${runtimeDir}/code-block-inline.md`;
    const vfile = toVFile.readSync(srcFile);
    addMetadata(vfile, destFile);

    const result = remark().use(mermaid).processSync(vfile).toString();
    expect(result).toMatch(/data:image\/svg/);
    expectFixedPoint(srcFile);
  });

  it('can handle code blocks, with both inline and comment applied', () => {
    const srcFile = `${fixturesDir}/code-block-comment-inline.md`;
    const destFile = `${runtimeDir}/code-block-comment-inline.md`;
    const vfile = toVFile.readSync(srcFile);
    addMetadata(vfile, destFile);

    const result = remark().use(mermaid).processSync(vfile).toString();
    expect(result).toMatch(/data:image\/svg/);
    expect(result).toMatch(/graph LR/);
    expect(result).toMatch(/<summary>Mermaid source<\/summary>/);
    expectFixedPoint(srcFile);
  });


  function expectFixedPoint(srcFile) {
    const destFile = `${runtimeDir}/first-output.md`;
    const destFile2 = `${runtimeDir}/second-pass.md`;
    const vfileOne = toVFile.readSync(srcFile);
    addMetadata(vfileOne, destFile);

    const result = remark().use(mermaid).processSync(vfileOne).toString();

    const vfileAgain = vfile(result);
    addMetadata(vfileAgain, destFile2);

    const resultAgain = remark().use(mermaid).processSync(vfileAgain).toString();

    expect(result).toEqual(resultAgain);
  }

  it('can handle mermaid images', () => {
    const srcFile = `${fixturesDir}/image-mermaid.md`;
    const destFile = `${runtimeDir}/image-mermaid.md`;
    const vfile = toVFile.readSync(srcFile);
    addMetadata(vfile, destFile);

    const result = remark().use(mermaid).processSync(vfile).toString();
    expect(result).toMatch(/!\[Example\]\(\w+\.svg/);
    expect(vfile.messages[0].message).toBe('mermaid link replaced with link to graph');
  });

  it('can handle mermaid links', () => {
    const srcFile = `${fixturesDir}/link-mermaid.md`;
    const destFile = `${runtimeDir}/link-mermaid.md`;
    const vfile = toVFile.readSync(srcFile);
    addMetadata(vfile, destFile);

    const result = remark().use(mermaid).processSync(vfile).toString();
    expect(result).toMatch(/\[Example\]\(\w+\.svg/);
    expect(vfile.messages[0].message).toBe('mermaid link replaced with link to graph');
  });

  describe('simple mode', () => {
    it('can handle code blocks in simple mode', () => {
      const srcFile = `${fixturesDir}/code-block.md`;
      const destFile = `${runtimeDir}/code-block.md`;
      const vfile = toVFile.readSync(srcFile);
      addMetadata(vfile, destFile);

      const result = remark().use(mermaid, { simple: true }).processSync(vfile).toString();
      expect(result).toMatch(/class=\"mermaid\"/);
      expect(vfile.messages[0].message).toBe('mermaid code block replaced with div');
    });

    it('can handle mermaid images in simple mode', () => {
      const srcFile = `${fixturesDir}/image-mermaid.md`;
      const destFile = `${runtimeDir}/image-mermaid.md`;
      const vfile = toVFile.readSync(srcFile);
      addMetadata(vfile, destFile);

      const result = remark().use(mermaid, { simple: true }).processSync(vfile).toString();
      expect(result).toMatch(/class=\"mermaid\"/);
      expect(vfile.messages[0].message).toBe('mermaid link replaced with div');
    });

    it('can handle mermaid links in simple mode', () => {
      const srcFile = `${fixturesDir}/link-mermaid.md`;
      const destFile = `${runtimeDir}/link-mermaid.md`;
      const vfile = toVFile.readSync(srcFile);
      addMetadata(vfile, destFile);

      const result = remark().use(mermaid, { simple: true }).processSync(vfile).toString();
      expect(result).toMatch(/class=\"mermaid\"/);
      expect(vfile.messages[0].message).toBe('mermaid link replaced with div');
    });
  });

  describe('imageDir', () => {
    it('can handle code blocks while setting image dir', () => {
      const srcFile = `${fixturesDir}/code-block.md`;
      const destFile = `${runtimeDir}/code-block.md`;
      const vfile = toVFile.readSync(srcFile);
      addMetadata(vfile, destFile);

      const result = remark().use(mermaid, { imageDir: 'images' }).processSync(vfile).toString();
      expect(result).toMatch(/!\[\]\(images\/\w+\.svg/);
      expect(vfile.messages[0].message).toBe('mermaid code block replaced with graph');
    });
  });
});
